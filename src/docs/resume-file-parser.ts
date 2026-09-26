import { createHash } from 'crypto';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { parseResume, type ParsedResume } from './resume-parser.js';

export interface ParsedResumeFile {
  rawText: string;
  parsed: ParsedResume;
  fileHash: string;
  fileType: 'pdf' | 'docx';
}

export class ResumeFileParser {
  /**
   * Parse a PDF or DOCX file buffer into structured resume data
   */
  async parseFile(buffer: Buffer, mimeType: string): Promise<ParsedResumeFile> {
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    let rawText = '';
    let fileType: 'pdf' | 'docx';

    if (mimeType === 'application/pdf') {
      fileType = 'pdf';
      const parser = new PDFParse({ data: buffer });
      try {
        const data = await parser.getText();
        rawText = data.text || '';
      } finally {
        await parser.destroy();
      }
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      fileType = 'docx';
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || '';
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    // Clean up extracted text
    rawText = this.cleanExtractedText(rawText);

    // Parse using the existing text parser
    const parsed = parseResume(rawText);

    return {
      rawText,
      parsed,
      fileHash,
      fileType,
    };
  }

  /**
   * Clean up common PDF/DOCX extraction artifacts
   */
  private cleanExtractedText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      // Remove page numbers, headers/footers artifacts
      .replace(/^\s*\d+\s*$/gm, '')
      // Remove common PDF artifacts
      .replace(/•/g, '•')
      .replace(/●/g, '•')
      .replace(/▪/g, '•')
      .replace(/■/g, '•')
      .trim();
  }

  /**
   * Convert parsed resume data into MasterResumeData format for LaTeX generation
   */
  toMasterResumeData(
    parsed: ParsedResume,
    contact: { fullName: string; email: string; location?: string; github?: string; linkedin?: string },
    additionalData?: {
      summary?: string;
      experience?: Array<{ company: string; role: string; startDate: string; endDate?: string; location?: string; bullets: string[] }>;
      projects?: Array<{ name: string; description?: string; techStack: string[]; bullets: string[] }>;
      education?: Array<{ institution: string; degree: string; graduationDate: string }>;
    }
  ): import('./types.js').MasterResumeData {
    // Build skills categories from parsed skills
    const skillCategories = this.categorizeSkills(parsed.skills);

    // Build experience from additional data or parsed data (zero synthetic fallback)
    const rawExperience = additionalData?.experience || parsed.experience || [];
    const experience = rawExperience.map((exp) => ({
      company: exp.company,
      role: exp.role,
      startDate: exp.startDate,
      endDate: exp.endDate || 'Present',
      location: exp.location,
      bullets: (exp.bullets || []).map(text => ({ text, factId: '' })),
    }));

    // Build projects from additional data or parsed data
    const rawProjects = additionalData?.projects || parsed.projects || [];
    const projects = rawProjects.map(proj => ({
      name: proj.name,
      description: proj.description || '',
      techStack: proj.techStack || [],
      bullets: (proj.bullets || []).map(text => ({ text, factId: '' })),
      link: 'link' in proj ? proj.link : undefined,
    }));

    // Build education from additional data or parsed data
    const rawEducation = additionalData?.education || parsed.education || [];
    const education = rawEducation.map(edu => ({
      institution: edu.institution,
      degree: edu.degree,
      graduationDate: edu.graduationDate,
      location: 'location' in edu ? edu.location : undefined,
    }));

    return {
      contact: {
        fullName: contact.fullName || parsed.contact?.fullName || '',
        email: contact.email || parsed.contact?.email || '',
        location: contact.location || parsed.contact?.location || '',
        github: contact.github || parsed.contact?.github,
        linkedin: contact.linkedin || parsed.contact?.linkedin,
        phone: parsed.contact?.phone,
        portfolio: parsed.contact?.portfolio,
      },
      summary: additionalData?.summary || parsed.summary || '',
      skills: skillCategories,
      experience,
      projects,
      education,
    };
  }

  /**
   * Categorize flat skills list into groups for LaTeX rendering
   */
  private categorizeSkills(skills: string[]): Array<{ category: string; skills: string[]; factIds: string[] }> {
    const categories: Record<string, string[]> = {
      'Languages': [],
      'Frontend': [],
      'Backend': [],
      'Databases': [],
      'Cloud & DevOps': [],
      'Tools & Others': [],
    };

    const skillLower = skills.map(s => s.toLowerCase());

    const categoryMap: Record<string, string> = {
      // Languages
      'javascript': 'Languages', 'typescript': 'Languages', 'python': 'Languages', 'java': 'Languages',
      'c++': 'Languages', 'c#': 'Languages', 'go': 'Languages', 'golang': 'Languages', 'rust': 'Languages',
      'ruby': 'Languages', 'php': 'Languages', 'swift': 'Languages', 'kotlin': 'Languages',
      'scala': 'Languages', 'dart': 'Languages', 'sql': 'Languages', 'bash': 'Languages',
      // Frontend
      'react': 'Frontend', 'next.js': 'Frontend', 'vue': 'Frontend', 'angular': 'Frontend', 'svelte': 'Frontend',
      'redux': 'Frontend', 'tailwind': 'Frontend', 'bootstrap': 'Frontend', 'sass': 'Frontend',
      'webpack': 'Frontend', 'vite': 'Frontend', 'graphql': 'Frontend', 'figma': 'Frontend',
      // Backend
      'node.js': 'Backend', 'express': 'Backend', 'fastify': 'Backend', 'nest.js': 'Backend', 'django': 'Backend',
      'fastapi': 'Backend', 'flask': 'Backend', 'spring': 'Backend', 'gin': 'Backend',
      'asp.net': 'Backend', 'laravel': 'Backend', 'rest api': 'Backend', 'grpc': 'Backend',
      // Databases
      'postgresql': 'Databases', 'mysql': 'Databases', 'mongodb': 'Databases', 'redis': 'Databases',
      'sqlite': 'Databases', 'elasticsearch': 'Databases', 'dynamodb': 'Databases', 'prisma': 'Databases',
      // Cloud & DevOps
      'aws': 'Cloud & DevOps', 'azure': 'Cloud & DevOps', 'gcp': 'Cloud & DevOps', 'docker': 'Cloud & DevOps',
      'kubernetes': 'Cloud & DevOps', 'terraform': 'Cloud & DevOps', 'ansible': 'Cloud & DevOps',
      'ci/cd': 'Cloud & DevOps', 'github actions': 'Cloud & DevOps', 'linux': 'Cloud & DevOps',
      // Tools
      'git': 'Tools & Others', 'jest': 'Tools & Others', 'playwright': 'Tools & Others',
    };

    for (const skill of skills) {
      const lower = skill.toLowerCase();
      const category = categoryMap[lower] || 'Tools & Others';
      if (!categories[category].includes(skill)) {
        categories[category].push(skill);
      }
    }

    // Filter empty categories
    return Object.entries(categories)
      .filter(([, skills]) => skills.length > 0)
      .map(([category, skills]) => ({ category, skills, factIds: [] as string[] }));
  }
}

export const resumeFileParser = new ResumeFileParser();
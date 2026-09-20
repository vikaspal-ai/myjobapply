export interface ResumeBullet {
  text: string;
  factId: string; // Anti-fabrication citation: must link to candidate_facts.id
}

export interface WorkExperienceEntry {
  company: string;
  role: string;
  startDate: string;
  endDate?: string;
  location?: string;
  bullets: ResumeBullet[];
}

export interface SkillCategoryEntry {
  category: string;
  skills: string[];
  factIds: string[];
}

export interface ProjectEntry {
  name: string;
  description: string;
  techStack: string[];
  bullets: ResumeBullet[];
  link?: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  graduationDate: string;
  location?: string;
  factId?: string;
}

export interface MasterResumeData {
  contact: {
    fullName: string;
    email: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  summary: string;
  skills: SkillCategoryEntry[];
  experience: WorkExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
}

export interface ResumePlan {
  factIds: string[]; // Ordered subset of fact IDs selected for this target job
  sectionOrder: Array<'summary' | 'skills' | 'experience' | 'projects' | 'education'>;
  maxBulletsPerRole?: number;
  highlightedSkills?: string[];
  templateName: string; // e.g. 'modern-deedy', 'clean-classic'
}

export interface ArtifactRecord {
  id: string;
  contentHash: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
}

export type ClaimViolationType =
  | 'UNKNOWN_FACT_ID'
  | 'UNVERIFIED_FACT'
  | 'FACT_CANDIDATE_MISMATCH'
  | 'TEXT_HALLUCINATION'
  | 'MISSING_CITATION';

export interface ClaimViolation {
  type: ClaimViolationType;
  factId?: string;
  field: string;
  details: string;
}

export interface ClaimCheckResult {
  valid: boolean;
  violations: ClaimViolation[];
}

export interface TailoredResumeDraft {
  resumeId: string;
  jobId: string;
  candidateId: string;
  plan: ResumePlan;
  data: MasterResumeData;
}

export interface CompanyFactSource {
  companyName: string;
  sourceUrl: string;
  note?: string;
}

export interface CoverLetterResult {
  coverLetterId: string;
  versionId: string;
  versionNo: number;
  contentHash: string;
  markdownContent: string;
  companyFactSources: CompanyFactSource[];
  artifactId: string;
}


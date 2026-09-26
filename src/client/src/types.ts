// React Client Domain & API Types

export interface User {
  id: string;
  email: string;
  fullName: string;
}

export interface CandidateProfile {
  id: string;
  fullName: string;
  email: string;
  preferredLocations: string[];
  currentLocation?: string;
  experienceYears?: number | null;
  currentJob?: string | null;
  currentCompany?: string | null;
  authUserId?: string | null;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CandidateFact {
  id: string;
  candidateId: string;
  category: 'SKILL' | 'EXPERIENCE' | 'PROJECT' | 'EDUCATION';
  factKey?: string;
  statement: string;
  verified: boolean;
}

export interface JobMatch {
  id: string;
  jobId: string;
  title: string;
  companyName: string;
  companyDomain?: string;
  locationDisplay: string;
  fitScore: number;
  atsScore: number;
  salary?: string | null;
  applyUrl: string;
  atsType?: string;
  status?: string;
  isSynthetic?: boolean;
}

export interface ApplicationRun {
  id: string;
  applicationId: string;
  path: 'API' | 'PLAYWRIGHT';
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  screeningAnswers?: Record<string, string>;
  createdAt: string;
}

export interface ApplicationItem {
  id: string;
  candidateId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  location: string;
  status: 'DRAFT' | 'PREPARED' | 'HUMAN_APPROVAL_REQUIRED' | 'APPROVED' | 'SUBMITTED' | 'REJECTED';
  atsScore: number;
  updatedAt: string;
  screeningAnswers?: Record<string, string>;
}

export interface ReferralLead {
  id: string;
  companyName: string;
  personName: string;
  title: string;
  fitScore: number;
  connection: string;
  snippet: string;
  status: 'READY' | 'SENT' | 'REPLIED';
}

export interface FunnelStats {
  discoveredCount: number;
  canonicalCount: number;
  matchedCount: number;
  pendingApprovalCount: number;
}

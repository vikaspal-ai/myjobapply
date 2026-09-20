export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, any>;
}

export interface CandidateDto {
  id: string;
  fullName: string;
  email: string;
  headline?: string;
  createdAt: string;
}

export interface CandidateFactDto {
  id: string;
  candidateId: string;
  category: 'SKILL' | 'EXPERIENCE' | 'EDUCATION' | 'METRIC' | 'PREFERENCE';
  factKey: string;
  factValue: string;
  isVerified: boolean;
  confidenceScore: number;
  sourceDocument?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface JobQueryFilters {
  status?: string;
  atsType?: string;
  search?: string;
  candidateId?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}

export interface JobDto {
  id: string;
  title: string;
  companyName: string;
  location?: string;
  workplaceType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  status: string;
  postingUrl?: string;
  atsType?: string;
  discoveredAt: string;
  requirements?: {
    requiredSkills: string[];
    preferredSkills: string[];
    minYearsExperience?: number;
    educationLevel?: string;
  };
  match?: {
    score: number;
    breakdown: Record<string, any>;
    passedHardFilters: boolean;
  };
}

export interface ApplicationQueryFilters {
  candidateId?: string;
  jobId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ApplicationDto {
  id: string;
  candidateId: string;
  candidateName?: string;
  jobId: string;
  jobTitle?: string;
  companyName?: string;
  resumeVersionId?: string;
  coverLetterVersionId?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  resume?: {
    id: string;
    versionNo: number;
    title: string;
    markdownText?: string;
    pdfArtifactId?: string;
  };
  coverLetter?: {
    id: string;
    markdownText: string;
    companyDiscoveryCitations: Record<string, any>;
  };
  unresolvedFields?: string[];
  runCount?: number;
  lastRunResult?: string;
}

export interface CreateDraftApplicationInput {
  candidateId: string;
  jobId: string;
  resumeVersionId?: string;
  coverLetterVersionId?: string;
  notes?: string;
}

export interface PrepareApplicationInput {
  answers?: Record<string, string>;
}

export interface ApproveApplicationInput {
  approvedBy?: string;
  notes?: string;
}

export interface RunApplicationInput {
  sandbox?: boolean;
}

export interface AnalyticsMetricsDto {
  totalDiscoveredPostings: number;
  totalCanonicalJobs: number;
  totalMatchedOpportunities: number;
  applications: {
    total: number;
    draft: number;
    pendingApproval: number;
    paused: number;
    approved: number;
    submitted: number;
    rejected: number;
    interview: number;
  };
  dailyBudget: {
    targetMaxDailyApplications: number;
    applicationsSubmittedToday: number;
    remainingDailyAllowance: number;
    isBudgetExceeded: boolean;
  };
  atsDistribution: Record<string, number>;
  crawlerHealth: {
    activeDomains: number;
    circuitOpenDomains: number;
  };
}

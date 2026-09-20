export type FormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'hidden';

export type StandardFieldCategory =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'location'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'resume'
  | 'cover_letter'
  | 'work_authorization'
  | 'sponsorship'
  | 'notice_period'
  | 'salary'
  | 'custom';

export interface FormOption {
  label: string;
  value: string;
}

export interface FormField {
  id?: string;
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: FormOption[];
  standardCategory: StandardFieldCategory;
  selector: string;
}

export interface FormInspectionResult {
  formAction?: string;
  formMethod?: string;
  fields: FormField[];
  hasResumeUpload: boolean;
  hasCoverLetterUpload: boolean;
  standardFields: FormField[];
  customQuestions: FormField[];
  detectedAts?: string;
}

export type ApplicationStatus =
  | 'DRAFT'
  | 'PREPARED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'FAILED'
  | 'PAUSED'
  | 'CANCELLED'
  | 'UNCONFIRMED';

export type ApplicationRunPath = 'PLAYWRIGHT' | 'EXTENSION';

export interface ApplicationRecord {
  id: string;
  candidateId: string;
  jobId: string;
  resumeVersionId?: string;
  coverLetterVersionId?: string;
  status: ApplicationStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateAnswerRecord {
  id: string;
  candidateId: string;
  questionPattern: string;
  answerText: string;
  category: 'authorization' | 'sponsorship' | 'compensation' | 'notice_period' | 'demographics' | 'custom';
  verified: boolean;
}

export type FieldResolutionSource =
  | 'CANDIDATE_PROFILE'
  | 'RESUME_ARTIFACT'
  | 'COVER_LETTER_ARTIFACT'
  | 'ANSWER_MEMORY'
  | 'NEEDS_HUMAN_ANSWER';

export interface FilledFormField {
  field: FormField;
  value: string;
  source: FieldResolutionSource;
  confidence: number;
}

export interface AutoFillResult {
  filledFields: FilledFormField[];
  unresolvedFields: FormField[];
  canSubmit: boolean;
  pauseReason?: 'NEEDS_HUMAN_ANSWER' | 'MISSING_REQUIRED_FIELD';
}

export interface ApplicationRunRecord {
  id: string;
  applicationId: string;
  path: ApplicationRunPath;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'SUBMITTED' | 'FAILED';
  formData: Record<string, any>;
  pauseReason?: string;
  approvedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationRunResult {
  runId: string;
  success: boolean;
  status: 'SUBMITTED' | 'PAUSED' | 'FAILED';
  pauseReason?: string;
  error?: string;
  confirmationReceipt?: string;
}

export interface BrowserAutomationDriver {
  fillAndSubmit(
    fields: FilledFormField[],
    applyUrl?: string,
  ): Promise<{
    success: boolean;
    paused?: boolean;
    pauseReason?: 'CAPTCHA_DETECTED' | 'LOGIN_WALL_DETECTED' | 'LAYOUT_CHANGED';
    error?: string;
    receipt?: string;
  }>;
}


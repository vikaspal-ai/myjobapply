export type OutreachMessageStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'BOUNCED'
  | 'REPLIED'
  | 'FAILED'
  | 'CANCELLED';

export interface CompanyContactRecord {
  id: string;
  companyId: string;
  name?: string;
  email: string;
  roleTitle?: string;
  sourceUrl: string;
  confidence: number;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuppressionRecord {
  id: string;
  email?: string;
  domain?: string;
  reason: 'UNSUBSCRIBE' | 'BOUNCE' | 'MANUAL' | 'COMPLAINT' | 'COOLDOWN';
  notes?: string;
  createdAt: Date;
}

export interface OutreachMessageRecord {
  id: string;
  candidateId: string;
  companyId: string;
  contactId?: string;
  jobId?: string;
  resumeVersionId?: string;
  subject: string;
  bodyText: string;
  status: OutreachMessageStatus;
  idempotencyKey: string;
  correlationToken: string;
  approvedAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OutreachThreadRecord {
  id: string;
  messageId: string;
  threadExternalId?: string;
  provider: string;
  lastMessageAt: Date;
  status: 'ACTIVE' | 'CLOSED' | 'NEEDS_ATTENTION';
  createdAt: Date;
}

export interface SendEmailOptions {
  to: string;
  from: string;
  subject: string;
  body: string;
  correlationToken: string;
  replyTo?: string;
  attachmentPaths?: string[];
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
  provider: string;
  threadExternalId?: string;
  timestamp: Date;
}

export interface EmailProvider {
  name: string;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
}

export interface DraftOutreachInput {
  candidateId: string;
  companyId: string;
  contactId?: string;
  jobId?: string;
  resumeVersionId?: string;
  customNotes?: string;
}

export interface DiscoveredContact {
  name?: string;
  email: string;
  roleTitle?: string;
  confidence: number;
  sourceUrl: string;
}

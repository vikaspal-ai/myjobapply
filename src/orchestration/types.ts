export interface ScheduleRecord {
  id: string;
  jobSourceId?: string;
  companyId?: string;
  followupId?: string;
  priority: number;
  baseCadence: string;
  nextDueAt: Date;
  jitter: string;
  backoffUntil?: Date;
  inFlightSince?: Date;
  leaseExpiresAt?: Date;
  lockedBy?: string;
  enabled: boolean;
  lastOutcome?: string;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduleInput {
  jobSourceId?: string;
  companyId?: string;
  followupId?: string;
  priority?: number;
  baseCadenceMinutes?: number;
  jitterMinutes?: number;
  nextDueAt?: Date;
}

export interface CompleteTaskOptions {
  scheduleId: string;
  workerId: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'RATE_LIMITED';
  error?: string;
  backoffMinutes?: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownPeriodMs?: number;
}

export interface RobotsComplianceStatus {
  robots_checked: boolean;
  allowed: boolean;
  crawl_delay_seconds?: number;
  checked_at: string;
  disallowed_paths?: string[];
}

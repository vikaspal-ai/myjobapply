import { sql } from '../db/index.js';
import type { SuppressionRecord } from './types.js';

const db = sql!;

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export class SuppressionService {
  /**
   * Checks if an email address or company domain is suppressed.
   */
  async isSuppressed(email: string, domain?: string): Promise<boolean> {
    if (!db) throw new Error('Database client not initialized');

    const cleanEmail = email.toLowerCase().trim();
    const cleanDomain = domain ? domain.toLowerCase().trim() : cleanEmail.split('@')[1];

    const [match] = await db`
      SELECT id, reason FROM outreach.suppression_list
      WHERE (email = ${cleanEmail})
         OR (domain = ${cleanDomain})
      LIMIT 1
    `;

    return !!match;
  }

  /**
   * Records a suppression target (e.g. bounce, unsubscribe, manual block).
   */
  async addSuppression(params: {
    email?: string;
    domain?: string;
    reason: 'UNSUBSCRIBE' | 'BOUNCE' | 'MANUAL' | 'COMPLAINT' | 'COOLDOWN';
    notes?: string;
  }): Promise<SuppressionRecord> {
    if (!db) throw new Error('Database client not initialized');
    if (!params.email && !params.domain) {
      throw new Error('Must provide either email or domain to suppress');
    }

    const cleanEmail = params.email ? params.email.toLowerCase().trim() : null;
    const cleanDomain = params.domain ? params.domain.toLowerCase().trim() : null;

    const [inserted] = await db`
      INSERT INTO outreach.suppression_list (
        email, domain, reason, notes
      ) VALUES (
        ${cleanEmail}, ${cleanDomain}, ${params.reason}, ${params.notes ?? null}
      )
      RETURNING *
    `;

    return {
      id: inserted.id,
      email: inserted.email,
      domain: inserted.domain,
      reason: inserted.reason,
      notes: inserted.notes,
      createdAt: inserted.created_at,
    };
  }

  /**
   * Verifies if outreach can be safely initiated to a given company contact.
   * Deterministically enforces HLD §23:
   * 1. Global suppression list check
   * 2. Per-company 30-day contact cadence cooldown
   */
  async checkOutreachEligibility(params: {
    candidateId: string;
    companyId: string;
    contactEmail: string;
    cooldownDays?: number;
  }): Promise<EligibilityResult> {
    if (!db) throw new Error('Database client not initialized');

    const cooldownDays = params.cooldownDays ?? 30;

    // 1. Check Global Suppression
    const suppressed = await this.isSuppressed(params.contactEmail);
    if (suppressed) {
      return {
        eligible: false,
        reason: `Target contact or domain is permanently suppressed in outreach.suppression_list`,
      };
    }

    // 2. Check 30-Day Cadence per Company
    const [recentOutreach] = await db`
      SELECT id, sent_at, status FROM outreach.messages
      WHERE candidate_id = ${params.candidateId}
        AND company_id = ${params.companyId}
        AND status IN ('SENT', 'REPLIED')
        AND sent_at > now() - (${cooldownDays} || ' days')::interval
      LIMIT 1
    `;

    if (recentOutreach) {
      return {
        eligible: false,
        reason: `Candidate already reached out to company within ${cooldownDays}-day cooldown window (message id: ${recentOutreach.id})`,
      };
    }

    return { eligible: true };
  }
}

export const suppressionService = new SuppressionService();

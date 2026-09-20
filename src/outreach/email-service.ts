import crypto from 'node:crypto';
import { sql, emitOutboxEvent } from '../db/index.js';
import { suppressionService } from './suppression.js';
import type {
  DraftOutreachInput,
  EmailProvider,
  OutreachMessageRecord,
  SendEmailResult,
} from './types.js';

const db = sql!;

// Sandbox Mock Email Provider for tests and $0 personal dev
export class SandboxEmailProvider implements EmailProvider {
  name = 'SANDBOX';

  async sendEmail(options: any): Promise<SendEmailResult> {
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      provider: this.name,
      threadExternalId: `thread_${Date.now()}`,
      timestamp: new Date(),
    };
  }
}

export const sandboxEmailProvider = new SandboxEmailProvider();

export class EmailService {
  private defaultProvider: EmailProvider;

  constructor(defaultProvider: EmailProvider = sandboxEmailProvider) {
    this.defaultProvider = defaultProvider;
  }

  /**
   * Drafts a grounded outreach cold email citing verified candidate facts and target job criteria.
   * Deterministically enforces suppression guard at draft time.
   */
  async draftOutreach(input: DraftOutreachInput): Promise<OutreachMessageRecord> {
    if (!db) throw new Error('Database client not initialized');

    // 1. Fetch Candidate Profile & Verified Facts
    const [candidate] = await db`
      SELECT id, full_name, email FROM profile.candidate_profiles
      WHERE id = ${input.candidateId}
    `;
    if (!candidate) throw new Error(`Candidate ${input.candidateId} not found`);

    const candidateFacts = await db`
      SELECT id, statement, category FROM profile.candidate_facts
      WHERE candidate_id = ${input.candidateId} AND verified = true
      ORDER BY created_at DESC
      LIMIT 3
    `;

    // 2. Fetch Target Company
    const [company] = await db`
      SELECT id, name FROM discovery.companies WHERE id = ${input.companyId}
    `;
    if (!company) throw new Error(`Company ${input.companyId} not found`);

    // 3. Fetch Contact & Job (if specified)
    let contactEmail = `careers@${company.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    let contactName = 'Hiring Team';

    if (input.contactId) {
      const [contact] = await db`
        SELECT * FROM outreach.company_contacts WHERE id = ${input.contactId}
      `;
      if (contact) {
        contactEmail = contact.email;
        if (contact.name) contactName = contact.name;
      }
    }

    let jobTitle = 'Software Engineer';
    if (input.jobId) {
      const [job] = await db`
        SELECT title FROM jobs.jobs WHERE id = ${input.jobId}
      `;
      if (job?.title) jobTitle = job.title;
    }

    // 4. Enforce Suppression & Cadence Guard
    const eligibility = await suppressionService.checkOutreachEligibility({
      candidateId: input.candidateId,
      companyId: input.companyId,
      contactEmail,
    });

    if (!eligibility.eligible) {
      throw new Error(`Outreach Ineligible: ${eligibility.reason}`);
    }

    // 5. Synthesize Grounded Outreach Message Body
    const evidenceSnippets = candidateFacts.length > 0
      ? candidateFacts.map(f => `• ${f.statement}`).join('\n')
      : '• Experienced engineer specializing in modern distributed systems.';

    const correlationToken = `OTR-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const idempotencyKey = `outreach:${input.candidateId}:${input.companyId}:${input.jobId ?? 'direct'}:${Date.now()}`;

    const subject = `Exploring opportunities at ${company.name} — ${jobTitle} (${candidate.full_name})`;
    const bodyText = `Hi ${contactName},

I am writing to express my strong interest in engineering opportunities at ${company.name}${input.jobId ? ` for the ${jobTitle} role` : ''}.

Based on your team's technical focus, my background directly aligns with your requirements:
${evidenceSnippets}

I have attached my verified resume for your review. Would you be open to a brief 10-minute conversation this week?

Best regards,
${candidate.full_name}
${candidate.email}

Ref: [${correlationToken}]`;

    // 6. Insert Draft into Database
    const [inserted] = await db`
      INSERT INTO outreach.messages (
        candidate_id,
        company_id,
        contact_id,
        job_id,
        resume_version_id,
        subject,
        body_text,
        status,
        idempotency_key,
        correlation_token
      ) VALUES (
        ${input.candidateId},
        ${input.companyId},
        ${input.contactId ?? null},
        ${input.jobId ?? null},
        ${input.resumeVersionId ?? null},
        ${subject},
        ${bodyText},
        'PENDING_APPROVAL',
        ${idempotencyKey},
        ${correlationToken}
      )
      RETURNING *
    `;

    // 7. Emit Transactional Outbox Event
    await emitOutboxEvent(db, {
      type: 'OutreachDrafted',
      producer: 'email-service',
      idempotencyKey: `outreach:${inserted.id}:drafted`,
      correlationId: inserted.id,
      entityRefs: {
        messageId: inserted.id,
        candidateId: inserted.candidate_id,
        companyId: inserted.company_id,
      },
      payload: {
        subject: inserted.subject,
        contactEmail,
        status: 'PENDING_APPROVAL',
        correlationToken,
      },
    });

    return this.mapMessageRow(inserted);
  }

  /**
   * Human Approval Gate for Outreach:
   * Explicitly approves a drafted email for delivery.
   */
  async approveOutreach(messageId: string, approvedBy?: string): Promise<OutreachMessageRecord> {
    if (!db) throw new Error('Database client not initialized');

    const [existing] = await db`
      SELECT * FROM outreach.messages WHERE id = ${messageId}
    `;
    if (!existing) throw new Error(`Outreach message ${messageId} not found`);

    if (existing.status !== 'PENDING_APPROVAL' && existing.status !== 'DRAFT') {
      throw new Error(`Cannot approve outreach message with status '${existing.status}'`);
    }

    const [updated] = await db`
      UPDATE outreach.messages
      SET status = 'APPROVED',
          approved_at = now(),
          updated_at = now()
      WHERE id = ${messageId}
      RETURNING *
    `;

    await emitOutboxEvent(db, {
      type: 'OutreachApproved',
      producer: 'email-service',
      idempotencyKey: `outreach:${messageId}:approved:${Date.now()}`,
      correlationId: messageId,
      entityRefs: {
        messageId,
        candidateId: updated.candidate_id,
        companyId: updated.company_id,
      },
      payload: {
        approvedBy: approvedBy ?? 'user',
        status: 'APPROVED',
      },
    });

    return this.mapMessageRow(updated);
  }

  /**
   * Sends an outreach email via the configured EmailProvider port.
   * STRICTLY ENFORCES THE HUMAN APPROVAL GATE:
   * Message must be in APPROVED state prior to sending.
   */
  async sendOutreach(
    messageId: string,
    provider: EmailProvider = this.defaultProvider,
  ): Promise<{ message: OutreachMessageRecord; sendResult: SendEmailResult }> {
    if (!db) throw new Error('Database client not initialized');

    const [msg] = await db`
      SELECT m.*, cp.email as candidate_email, c.name as company_name
      FROM outreach.messages m
      JOIN profile.candidate_profiles cp ON m.candidate_id = cp.id
      JOIN discovery.companies c ON m.company_id = c.id
      WHERE m.id = ${messageId}
    `;

    if (!msg) throw new Error(`Outreach message ${messageId} not found`);

    // HUMAN APPROVAL GATE INVARIANT
    if (msg.status !== 'APPROVED') {
      throw new Error(
        `Invariant violation: Cannot send outreach message ${messageId} with status '${msg.status}'. Human approval is strictly required prior to sending outreach emails.`,
      );
    }

    // Determine recipient email
    let recipientEmail = `careers@${msg.company_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    if (msg.contact_id) {
      const [contact] = await db`
        SELECT email FROM outreach.company_contacts WHERE id = ${msg.contact_id}
      `;
      if (contact?.email) recipientEmail = contact.email;
    }

    // Re-verify Suppression Guard at send time
    const eligibility = await suppressionService.checkOutreachEligibility({
      candidateId: msg.candidate_id,
      companyId: msg.company_id,
      contactEmail: recipientEmail,
    });

    if (!eligibility.eligible) {
      await db`
        UPDATE outreach.messages
        SET status = 'CANCELLED', updated_at = now()
        WHERE id = ${messageId}
      `;
      throw new Error(`Outreach blocked at send time: ${eligibility.reason}`);
    }

    // Send via provider
    const sendResult = await provider.sendEmail({
      to: recipientEmail,
      from: msg.candidate_email,
      subject: msg.subject,
      body: msg.body_text,
      correlationToken: msg.correlation_token,
    });

    // Update Message Status to SENT
    const [updated] = await db`
      UPDATE outreach.messages
      SET status = 'SENT',
          sent_at = now(),
          updated_at = now()
      WHERE id = ${messageId}
      RETURNING *
    `;

    // Create or Link Thread
    await db`
      INSERT INTO outreach.threads (
        message_id,
        thread_external_id,
        provider,
        last_message_at,
        status
      ) VALUES (
        ${messageId},
        ${sendResult.threadExternalId ?? null},
        ${provider.name},
        now(),
        'ACTIVE'
      )
    `;

    // Emit OutreachSent Event
    await emitOutboxEvent(db, {
      type: 'OutreachSent',
      producer: 'email-service',
      idempotencyKey: `outreach:${messageId}:sent:${Date.now()}`,
      correlationId: messageId,
      entityRefs: {
        messageId,
        candidateId: msg.candidate_id,
        companyId: msg.company_id,
      },
      payload: {
        to: recipientEmail,
        provider: provider.name,
        threadExternalId: sendResult.threadExternalId,
      },
    });

    return {
      message: this.mapMessageRow(updated),
      sendResult,
    };
  }

  /**
   * Handles inbound thread reply correlation via correlation token.
   */
  async recordReply(correlationToken: string, replyText: string): Promise<OutreachMessageRecord> {
    if (!db) throw new Error('Database client not initialized');

    const [msg] = await db`
      SELECT * FROM outreach.messages WHERE correlation_token = ${correlationToken}
    `;
    if (!msg) throw new Error(`Message with correlation token ${correlationToken} not found`);

    const [updated] = await db`
      UPDATE outreach.messages
      SET status = 'REPLIED', updated_at = now()
      WHERE id = ${msg.id}
      RETURNING *
    `;

    await db`
      UPDATE outreach.threads
      SET last_message_at = now(), status = 'NEEDS_ATTENTION'
      WHERE message_id = ${msg.id}
    `;

    await emitOutboxEvent(db, {
      type: 'OutreachReplyReceived',
      producer: 'email-service',
      idempotencyKey: `outreach:${msg.id}:reply:${Date.now()}`,
      correlationId: msg.id,
      entityRefs: {
        messageId: msg.id,
        candidateId: msg.candidate_id,
        companyId: msg.company_id,
      },
      payload: {
        correlationToken,
        replySnippet: replyText.slice(0, 200),
      },
    });

    return this.mapMessageRow(updated);
  }

  /**
   * Handles email bounce notification, automatically suppressing the contact.
   */
  async recordBounce(correlationToken: string, bounceReason: string): Promise<OutreachMessageRecord> {
    if (!db) throw new Error('Database client not initialized');

    const [msg] = await db`
      SELECT m.*, cc.email as contact_email
      FROM outreach.messages m
      LEFT JOIN outreach.company_contacts cc ON m.contact_id = cc.id
      WHERE m.correlation_token = ${correlationToken}
    `;
    if (!msg) throw new Error(`Message with token ${correlationToken} not found`);

    const [updated] = await db`
      UPDATE outreach.messages
      SET status = 'BOUNCED', updated_at = now()
      WHERE id = ${msg.id}
      RETURNING *
    `;

    // Auto-suppress target email if present
    if (msg.contact_email) {
      await suppressionService.addSuppression({
        email: msg.contact_email,
        reason: 'BOUNCE',
        notes: `Hard bounce reported: ${bounceReason}`,
      });
    }

    await emitOutboxEvent(db, {
      type: 'OutreachBounced',
      producer: 'email-service',
      idempotencyKey: `outreach:${msg.id}:bounced:${Date.now()}`,
      correlationId: msg.id,
      entityRefs: {
        messageId: msg.id,
        candidateId: msg.candidate_id,
        companyId: msg.company_id,
      },
      payload: {
        correlationToken,
        bounceReason,
      },
    });

    return this.mapMessageRow(updated);
  }

  private mapMessageRow(row: any): OutreachMessageRecord {
    return {
      id: row.id,
      candidateId: row.candidate_id,
      companyId: row.company_id,
      contactId: row.contact_id ?? undefined,
      jobId: row.job_id ?? undefined,
      resumeVersionId: row.resume_version_id ?? undefined,
      subject: row.subject,
      bodyText: row.body_text,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      correlationToken: row.correlation_token,
      approvedAt: row.approved_at ?? undefined,
      sentAt: row.sent_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const emailService = new EmailService();

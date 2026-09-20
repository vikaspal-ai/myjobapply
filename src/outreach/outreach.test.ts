import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql } from '../db/index.js';
import { contactExtractor } from './contact-extractor.js';
import { suppressionService } from './suppression.js';
import { emailService, SandboxEmailProvider } from './email-service.js';
import { buildApp } from '../api/server.js';

const db = sql!;

describe('Phase 7: Outreach Engine, Public Contact Discovery & Human Approval Gate', () => {
  let app: FastifyInstance;
  let testCandidateId: string;
  let testCompanyId: string;
  let testJobId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Seed candidate profile
    const [candidate] = await db`
      INSERT INTO profile.candidate_profiles (
        full_name, email
      ) VALUES (
        'Evelyn Reed', ${'evelyn.outreach.' + Date.now() + '@example.com'}
      )
      RETURNING id
    `;
    testCandidateId = candidate.id;

    // 2. Seed verified facts
    await db`
      INSERT INTO profile.candidate_facts (
        candidate_id, category, statement, verified
      ) VALUES 
        (${testCandidateId}, 'experience', 'Staff Infrastructure Engineer with 8+ years designing high-throughput Kafka and PostgreSQL pipelines.', true),
        (${testCandidateId}, 'skill', 'Expert in Go, Kubernetes operator development, and zero-downtime database migrations.', true)
    `;

    // 3. Seed company & domain
    const [company] = await db`
      INSERT INTO discovery.companies (name)
      VALUES (${'Nova Systems ' + Date.now()})
      RETURNING id
    `;
    testCompanyId = company.id;

    await db`
      INSERT INTO discovery.company_domains (company_id, domain, verified)
      VALUES (${testCompanyId}, ${'novasystems-' + Date.now() + '.com'}, true)
    `;

    // 4. Seed job
    const [job] = await db`
      INSERT INTO jobs.jobs (
        company_id, title, signature_hash, role_family, seniority, location, description, apply_url
      ) VALUES (
        ${testCompanyId},
        'Staff Infrastructure Engineer',
        ${'sig_outreach_' + Date.now()},
        'Engineering',
        'Staff',
        ${db.json({ type: 'REMOTE' })},
        'Distributed systems, Kafka, PostgreSQL',
        'https://novasystems.com/careers/staff-infra'
      )
      RETURNING id
    `;
    testJobId = job.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Contact Extractor: extracts public recruiting contacts from HTML and saves idempotently', async () => {
    const htmlSnippet = `
      <html>
        <body>
          <h1>Join Nova Systems</h1>
          <p>Questions about open roles? Contact our recruiting team:</p>
          <a href="mailto:talent-acquisition@novasystems.com?subject=Careers">Contact Talent Team</a>
          <a href="mailto:abuse@novasystems.com">Abuse Desk</a>
          <a href="mailto:careers@novasystems.com">General Inquiries</a>
        </body>
      </html>
    `;

    // 1. Extraction from HTML
    const contacts = contactExtractor.extractContactsFromHtml(htmlSnippet, 'https://novasystems.com/careers');
    expect(contacts.length).toBe(2); // talent-acquisition and careers; abuse@ excluded
    expect(contacts.some(c => c.email.includes('talent-acquisition'))).toBe(true);
    expect(contacts.some(c => c.email.includes('abuse'))).toBe(false);

    // 2. Persistence into outreach.company_contacts
    const saved = await contactExtractor.saveDiscoveredContacts(testCompanyId, contacts);
    expect(saved.length).toBe(2);
    expect(saved[0].companyId).toBe(testCompanyId);

    // 3. Idempotent re-save does not duplicate
    const reSaved = await contactExtractor.saveDiscoveredContacts(testCompanyId, contacts);
    expect(reSaved.length).toBe(2);

    const [countRow] = await db`
      SELECT count(*) as cnt FROM outreach.company_contacts WHERE company_id = ${testCompanyId}
    `;
    expect(Number(countRow.cnt)).toBe(2);
  });

  it('Suppression Service: blocks suppressed targets and enforces 30-day company cadence', async () => {
    const testEmail = `optout-${Date.now()}@example.com`;

    // 1. Initial check: not suppressed
    const initiallySuppressed = await suppressionService.isSuppressed(testEmail);
    expect(initiallySuppressed).toBe(false);

    // 2. Add suppression
    await suppressionService.addSuppression({
      email: testEmail,
      reason: 'UNSUBSCRIBE',
      notes: 'User requested opt-out via footer link',
    });

    const nowSuppressed = await suppressionService.isSuppressed(testEmail);
    expect(nowSuppressed).toBe(true);

    // 3. Eligibility check blocks suppressed email
    const eligibility = await suppressionService.checkOutreachEligibility({
      candidateId: testCandidateId,
      companyId: testCompanyId,
      contactEmail: testEmail,
    });
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toContain('permanently suppressed');
  });

  it('Email Service & Approval Gate: drafts grounded cold email, blocks unapproved send, approves, and records replies', async () => {
    const mockProvider = new SandboxEmailProvider();

    // 1. Draft Outreach Email
    const draft = await emailService.draftOutreach({
      candidateId: testCandidateId,
      companyId: testCompanyId,
      jobId: testJobId,
    });

    expect(draft.status).toBe('PENDING_APPROVAL');
    expect(draft.subject).toContain('Staff Infrastructure Engineer');
    expect(draft.bodyText).toContain('Kafka');
    expect(draft.bodyText).toContain('PostgreSQL');
    expect(draft.correlationToken).toMatch(/^OTR-/);

    // 2. UNAPPROVED SEND ATTEMPT MUST FAIL (Human Approval Gate Invariant)
    await expect(emailService.sendOutreach(draft.id, mockProvider)).rejects.toThrow(
      /Human approval is strictly required/,
    );

    // 3. Human Approval Gate
    const approved = await emailService.approveOutreach(draft.id, 'Engineering Director');
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedAt).toBeDefined();

    // 4. Send Approved Email
    const sendResult = await emailService.sendOutreach(draft.id, mockProvider);
    expect(sendResult.message.status).toBe('SENT');
    expect(sendResult.message.sentAt).toBeDefined();
    expect(sendResult.sendResult.success).toBe(true);

    // 5. Inbound Reply Correlation
    const replied = await emailService.recordReply(
      draft.correlationToken,
      'Hi Evelyn, we would love to speak. Does Thursday at 2pm work?',
    );
    expect(replied.status).toBe('REPLIED');

    // 6. Verify Outbox Events Emitted
    const outboxEvents = await db`
      SELECT type FROM platform.outbox_events
      WHERE entity_refs->>'messageId' = ${draft.id}
      ORDER BY created_at ASC
    `;
    const eventTypes = outboxEvents.map(e => e.type);
    expect(eventTypes).toContain('OutreachDrafted');
    expect(eventTypes).toContain('OutreachApproved');
    expect(eventTypes).toContain('OutreachSent');
    expect(eventTypes).toContain('OutreachReplyReceived');
  });

  it('Outreach REST API: enforces human approval gate over HTTP', async () => {
    // Fresh company for HTTP test to respect 30-day cadence
    const [httpCompany] = await db`
      INSERT INTO discovery.companies (name)
      VALUES (${'Aether Labs ' + Date.now()})
      RETURNING id
    `;

    // 1. Draft via POST /api/outreach/draft
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/outreach/draft',
      payload: {
        candidateId: testCandidateId,
        companyId: httpCompany.id,
      },
    });
    expect(draftRes.statusCode).toBe(201);
    const draftBody = JSON.parse(draftRes.payload);
    const messageId = draftBody.data.id;
    expect(draftBody.data.status).toBe('PENDING_APPROVAL');

    // 2. Attempt send without approval -> MUST RETURN 403 Forbidden
    const unapprovedSend = await app.inject({
      method: 'POST',
      url: `/api/outreach/${messageId}/send`,
    });
    expect(unapprovedSend.statusCode).toBe(403);
    const errorBody = JSON.parse(unapprovedSend.payload);
    expect(errorBody.code).toBe('HUMAN_APPROVAL_REQUIRED');

    // 3. Approve via POST /api/outreach/:id/approve
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/outreach/${messageId}/approve`,
      payload: { approvedBy: 'Lead Reviewer' },
    });
    expect(approveRes.statusCode).toBe(200);

    // 4. Send via POST /api/outreach/:id/send -> SUCCEEDS
    const approvedSend = await app.inject({
      method: 'POST',
      url: `/api/outreach/${messageId}/send`,
    });
    expect(approvedSend.statusCode).toBe(200);
    const sendBody = JSON.parse(approvedSend.payload);
    expect(sendBody.data.message.status).toBe('SENT');
  });
});

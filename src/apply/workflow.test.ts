import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from '../db/index.js';
import { ApplicationWorkflowEngine } from './workflow.js';
import type { AutoFillResult } from './types.js';

const db = sql!;

describe('Phase 4.3: Application State Machine, Human Approval Gate & Sandbox Runner', () => {
  const workflow = new ApplicationWorkflowEngine();

  let testCandidateId: string;
  let testCompanyId: string;

  beforeAll(async () => {
    // 1. Seed test candidate
    const [candidate] = await db`
      INSERT INTO profile.candidate_profiles (
        full_name, email
      ) VALUES (
        'Maya Workflow', ${'maya.wf.' + Date.now() + '@example.com'}
      )
      RETURNING id
    `;
    testCandidateId = candidate.id;

    // 2. Seed test company
    const [company] = await db`
      INSERT INTO discovery.companies (name)
      VALUES (${'Company WF ' + Date.now()})
      RETURNING id
    `;
    testCompanyId = company.id;
  });

  async function createTestJob(title: string = 'Senior SRE'): Promise<string> {
    const [job] = await db`
      INSERT INTO jobs.jobs (
        company_id, title, signature_hash, role_family, seniority, location, description, apply_url
      ) VALUES (
        ${testCompanyId},
        ${title},
        ${'sig_wf_' + Date.now() + '_' + Math.random().toString(36).slice(2)},
        'Engineering',
        'Senior',
        ${db.json({ type: 'REMOTE' })},
        'Kubernetes, Terraform, Golang',
        'https://companywf.com/apply'
      )
      RETURNING id
    `;
    return job.id;
  }

  it('creates draft application idempotently and manages lifecycle transitions', async () => {
    const jobId = await createTestJob('Draft Engineer');

    // 1. Create Draft
    const draft1 = await workflow.createDraft({
      candidateId: testCandidateId,
      jobId,
      notes: 'Initial automated draft',
    });

    expect(draft1.id).toBeDefined();
    expect(draft1.status).toBe('DRAFT');
    expect(draft1.candidateId).toBe(testCandidateId);
    expect(draft1.jobId).toBe(jobId);

    // 2. Idempotency verification
    const draft2 = await workflow.createDraft({
      candidateId: testCandidateId,
      jobId,
    });
    expect(draft2.id).toBe(draft1.id);

    // Verify ApplicationCreated event in outbox
    const [event] = await db`
      SELECT * FROM platform.outbox_events
      WHERE idempotency_key = ${`application:${draft1.id}:created`}
    `;
    expect(event).toBeDefined();
    expect(event.type).toBe('ApplicationCreated');
  });

  it('transitions to PAUSED when auto-fill has unanswerable required fields', async () => {
    const jobId = await createTestJob('Clearance Engineer');
    const draft = await workflow.createDraft({
      candidateId: testCandidateId,
      jobId,
    });

    const incompleteAutoFill: AutoFillResult = {
      filledFields: [],
      unresolvedFields: [
        {
          name: 'clearance_level',
          label: 'Security Clearance Level',
          type: 'text',
          required: true,
          standardCategory: 'custom',
          selector: 'input[name="clearance_level"]',
        },
      ],
      canSubmit: false,
      pauseReason: 'NEEDS_HUMAN_ANSWER',
    };

    const prepared = await workflow.prepareApplication(draft.id, incompleteAutoFill);
    expect(prepared.status).toBe('PAUSED');
    expect(prepared.notes).toContain('NEEDS_HUMAN_ANSWER');

    const [event] = await db`
      SELECT * FROM platform.outbox_events
      WHERE entity_refs->>'applicationId' = ${draft.id}
        AND type = 'ApplicationPaused'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(event).toBeDefined();
    expect(event.payload.pauseReason).toBe('NEEDS_HUMAN_ANSWER');
  });

  it('enforces the human review approval gate: blocks submission without explicit approval', async () => {
    const jobId = await createTestJob('Full Stack Engineer');
    const draft = await workflow.createDraft({
      candidateId: testCandidateId,
      jobId,
    });

    const readyAutoFill: AutoFillResult = {
      filledFields: [
        {
          field: {
            name: 'first_name',
            label: 'First Name',
            type: 'text',
            required: true,
            standardCategory: 'first_name',
            selector: 'input[name="first_name"]',
          },
          value: 'Maya',
          source: 'CANDIDATE_PROFILE',
          confidence: 1.0,
        },
      ],
      unresolvedFields: [],
      canSubmit: true,
    };

    // Prepare -> moves to PENDING_APPROVAL
    const readyApp = await workflow.prepareApplication(draft.id, readyAutoFill);
    expect(readyApp.status).toBe('PENDING_APPROVAL');

    // Attempting submission without approval MUST throw invariant error
    await expect(
      workflow.executeApplicationRun(draft.id, {
        autoFillResult: readyAutoFill,
      }),
    ).rejects.toThrow(/Invariant violation: Application .* cannot be submitted because it is in 'PENDING_APPROVAL' status/);

    // Explicit Human Approval
    const approvedApp = await workflow.approveApplication(draft.id, {
      approvedBy: 'maya@example.com',
      notes: 'Reviewed resume tailoring and salary requirements. Approved.',
    });
    expect(approvedApp.status).toBe('APPROVED');

    const [approvedEvent] = await db`
      SELECT * FROM platform.outbox_events
      WHERE entity_refs->>'applicationId' = ${draft.id}
        AND type = 'ApplicationApproved'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(approvedEvent).toBeDefined();
    expect(approvedEvent.type).toBe('ApplicationApproved');
  });

  it('simulates Playwright sandbox with CAPTCHA pause, re-approval, and final submission', async () => {
    const jobId = await createTestJob('DevOps Specialist');
    const draft = await workflow.createDraft({
      candidateId: testCandidateId,
      jobId,
    });

    const autoFillPayload: AutoFillResult = {
      filledFields: [
        {
          field: {
            name: 'email',
            label: 'Email',
            type: 'email',
            required: true,
            standardCategory: 'email',
            selector: 'input[name="email"]',
          },
          value: 'maya@example.com',
          source: 'CANDIDATE_PROFILE',
          confidence: 1.0,
        },
      ],
      unresolvedFields: [],
      canSubmit: true,
    };

    // Prepare and approve
    await workflow.prepareApplication(draft.id, autoFillPayload);
    await workflow.approveApplication(draft.id);

    // 1. Run with simulated CAPTCHA
    const captchaRun = await workflow.executeApplicationRun(draft.id, {
      autoFillResult: autoFillPayload,
      simulateCaptcha: true,
    });

    expect(captchaRun.success).toBe(false);
    expect(captchaRun.status).toBe('PAUSED');
    expect(captchaRun.pauseReason).toBe('CAPTCHA_DETECTED');

    // Verify run record in Supabase
    const appAfterCaptcha = await workflow.getApplication(draft.id);
    expect(appAfterCaptcha?.status).toBe('PAUSED');

    const runs = await workflow.getApplicationRuns(draft.id);
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs[0].status).toBe('PAUSED');
    expect(runs[0].pauseReason).toBe('CAPTCHA_DETECTED');

    // 2. Candidate resolves CAPTCHA and re-approves
    await workflow.approveApplication(draft.id, { notes: 'CAPTCHA solved in sandbox preview' });

    // 3. Successful submission run
    const successRun = await workflow.executeApplicationRun(draft.id, {
      autoFillResult: autoFillPayload,
    });

    expect(successRun.success).toBe(true);
    expect(successRun.status).toBe('SUBMITTED');
    expect(successRun.confirmationReceipt).toBeDefined();

    const finalApp = await workflow.getApplication(draft.id);
    expect(finalApp?.status).toBe('SUBMITTED');

    // Verify ApplicationSubmitted outbox event
    const [submittedEvent] = await db`
      SELECT * FROM platform.outbox_events
      WHERE idempotency_key = ${`application_run:${successRun.runId}:submitted`}
    `;
    expect(submittedEvent).toBeDefined();
    expect(submittedEvent.type).toBe('ApplicationSubmitted');
    expect(submittedEvent.payload.confirmationReceipt).toBe(successRun.confirmationReceipt);
  });
});

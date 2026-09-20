import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './server.js';
import { sql } from '../db/index.js';

const db = sql!;

describe('Phase 6: BFF REST API & Web Dashboard Endpoints', () => {
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
        'Sarah Connor', ${'sarah.api.' + Date.now() + '@example.com'}
      )
      RETURNING id
    `;
    testCandidateId = candidate.id;

    // 2. Seed company
    const [company] = await db`
      INSERT INTO discovery.companies (name)
      VALUES (${'Cyberdyne API ' + Date.now()})
      RETURNING id
    `;
    testCompanyId = company.id;

    await db`
      INSERT INTO discovery.company_domains (company_id, domain, verified)
      VALUES (${testCompanyId}, ${'cyberdyne-' + Date.now() + '.com'}, true)
    `;

    // 3. Seed job
    const [job] = await db`
      INSERT INTO jobs.jobs (
        company_id, title, signature_hash, role_family, seniority, location, description, apply_url, source_attribution
      ) VALUES (
        ${testCompanyId},
        'Principal Security Architect',
        ${'sig_api_' + Date.now() + '_' + Math.random().toString(36).slice(2)},
        'Security',
        'Principal',
        ${db.json({ type: 'REMOTE' })},
        'Zero trust security, Kubernetes hardening, threat modeling',
        'https://cyberdyne.com/careers/sec-arch',
        ${db.json({ ats_name: 'Greenhouse' })}
      )
      RETURNING id
    `;
    testJobId = job.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('myjobapply-bff');
  });

  it('serves dashboard HTML on GET /', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.payload).toContain('Job Hunt Platform');
    expect(res.payload).toContain('Human Review Queue');
  });

  it('Candidate & Facts REST API: lists candidates, creates fact, and toggles verification', async () => {
    // 1. List candidates
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/candidates',
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.success).toBe(true);
    expect(listBody.data.some((c: any) => c.id === testCandidateId)).toBe(true);

    // 2. Create Candidate Fact
    const createFactRes = await app.inject({
      method: 'POST',
      url: `/api/candidates/${testCandidateId}/facts`,
      payload: {
        category: 'skill',
        statement: '10+ years architecting zero-trust Kubernetes clusters',
        verified: true,
      },
    });
    expect(createFactRes.statusCode).toBe(201);
    const createFactBody = JSON.parse(createFactRes.payload);
    expect(createFactBody.data.statement).toContain('zero-trust');
    expect(createFactBody.data.verified).toBe(true);
    const factId = createFactBody.data.id;

    // 3. Toggle Verification to false
    const toggleRes = await app.inject({
      method: 'PATCH',
      url: `/api/candidates/${testCandidateId}/facts/${factId}`,
      payload: {
        verified: false,
      },
    });
    expect(toggleRes.statusCode).toBe(200);
    const toggleBody = JSON.parse(toggleRes.payload);
    expect(toggleBody.data.verified).toBe(false);

    // 4. List Candidate Facts
    const getFactsRes = await app.inject({
      method: 'GET',
      url: `/api/candidates/${testCandidateId}/facts`,
    });
    expect(getFactsRes.statusCode).toBe(200);
    const getFactsBody = JSON.parse(getFactsRes.payload);
    expect(getFactsBody.data.some((f: any) => f.id === factId)).toBe(true);
  });

  it('Jobs REST API: lists canonical jobs and retrieves job details', async () => {
    // 1. List jobs
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/jobs?limit=10',
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.success).toBe(true);
    expect(listBody.data.some((j: any) => j.id === testJobId)).toBe(true);

    // 2. Get single job
    const jobRes = await app.inject({
      method: 'GET',
      url: `/api/jobs/${testJobId}`,
    });
    expect(jobRes.statusCode).toBe(200);
    const jobBody = JSON.parse(jobRes.payload);
    expect(jobBody.data.title).toBe('Principal Security Architect');
    expect(jobBody.data.companyName).toContain('Cyberdyne');
  });

  it('Application Lifecycle via REST: draft -> prepare -> blocks unapproved submission -> approves -> sandbox run', async () => {
    // 1. POST /api/applications/draft
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/applications/draft',
      payload: {
        candidateId: testCandidateId,
        jobId: testJobId,
        notes: 'REST integration test application',
      },
    });
    expect(draftRes.statusCode).toBe(201);
    const draftBody = JSON.parse(draftRes.payload);
    expect(draftBody.data.status).toBe('DRAFT');
    const applicationId = draftBody.data.id;

    // 2. POST /api/applications/:id/prepare
    const prepRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/prepare`,
      payload: {
        canSubmit: true,
        filledFields: [
          { fieldName: 'full_name', value: 'Sarah Connor', verified: true, isSensitive: false },
        ],
      },
    });
    expect(prepRes.statusCode).toBe(200);
    const prepBody = JSON.parse(prepRes.payload);
    expect(prepBody.data.status).toBe('PENDING_APPROVAL');

    // 3. POST /api/applications/:id/run WITHOUT APPROVAL -> MUST FAIL (HTTP 403 Forbidden Gate Invariant)
    const blockedRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/run`,
      payload: {
        path: 'PLAYWRIGHT',
      },
    });
    expect(blockedRes.statusCode).toBe(403);
    const blockedBody = JSON.parse(blockedRes.payload);
    expect(blockedBody.code).toBe('HUMAN_APPROVAL_REQUIRED');

    // 4. POST /api/applications/:id/approve -> Human Approval Gate
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/approve`,
      payload: {
        approvedBy: 'Compliance Lead',
        notes: 'Approved via REST API test',
      },
    });
    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.payload);
    expect(approveBody.data.status).toBe('APPROVED');

    // 5. POST /api/applications/:id/run WITH APPROVAL -> SUCCEEDS and transitions to SUBMITTED
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/run`,
      payload: {
        path: 'PLAYWRIGHT',
        autoSubmit: true,
      },
    });
    expect(runRes.statusCode).toBe(200);
    const runBody = JSON.parse(runRes.payload);
    expect(runBody.data.status).toBe('SUBMITTED');

    // 6. GET /api/applications/:id detail inspection
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}`,
    });
    expect(detailRes.statusCode).toBe(200);
    const detailBody = JSON.parse(detailRes.payload);
    expect(detailBody.data.status).toBe('SUBMITTED');
    expect(detailBody.data.runs.length).toBeGreaterThan(0);
  });

  it('Analytics REST API: returns aggregated metrics, $0 quota meter, and ATS breakdown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/metrics',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    const data = body.data;
    expect(data.totalCanonicalJobs).toBeGreaterThan(0);
    expect(data.dailyBudget).toBeDefined();
    expect(data.dailyBudget.targetMaxDailyApplications).toBe(15);
    expect(typeof data.dailyBudget.applicationsSubmittedToday).toBe('number');
    expect(typeof data.dailyBudget.remainingDailyAllowance).toBe('number');
    expect(data.atsDistribution).toBeDefined();
    expect(data.crawlerHealth).toBeDefined();
  });

  it('Pipeline REST API: returns queue stats and processes outbox batch', async () => {
    // 1. Pipeline Status
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/pipeline/status',
    });
    expect(statusRes.statusCode).toBe(200);
    const statusBody = JSON.parse(statusRes.payload);
    expect(statusBody.data.outbox).toBeDefined();
    expect(statusBody.data.schedules).toBeDefined();
    expect(Array.isArray(statusBody.data.recentEvents)).toBe(true);

    // 2. Trigger outbox consumer
    const consumeRes = await app.inject({
      method: 'POST',
      url: '/api/pipeline/consume',
      payload: { batchSize: 5 },
    });
    expect(consumeRes.statusCode).toBe(200);
    const consumeBody = JSON.parse(consumeRes.payload);
    expect(consumeBody.success).toBe(true);
    expect(typeof consumeBody.data.processedCount).toBe('number');
  });
});

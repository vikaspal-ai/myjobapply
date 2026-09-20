import type { FastifyInstance } from 'fastify';
import { sql } from '../../db/index.js';
import { ApplicationWorkflowEngine } from '../../apply/workflow.js';
import type { AutoFillResult } from '../../apply/types.js';

const db = sql!;
const workflowEngine = new ApplicationWorkflowEngine();

export async function applicationRoutes(app: FastifyInstance) {
  // GET /api/applications - List applications with filters
  app.get<{
    Querystring: {
      candidateId?: string;
      jobId?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/applications', async (req, reply) => {
    const { candidateId, jobId, status, limit = '50', offset = '0' } = req.query;
    const numLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const numOffset = Math.max(0, parseInt(offset, 10) || 0);

    const rows = await db`
      SELECT 
        a.id,
        a.candidate_id,
        a.job_id,
        a.resume_version_id,
        a.cover_letter_version_id,
        a.status,
        a.notes,
        a.created_at,
        a.updated_at,
        cp.full_name as candidate_name,
        cp.email as candidate_email,
        j.title as job_title,
        j.apply_url as job_apply_url,
        c.name as company_name,
        rv.version_no as resume_version_no,
        (SELECT count(*) FROM apply.application_runs ar WHERE ar.application_id = a.id) as run_count
      FROM apply.applications a
      JOIN profile.candidate_profiles cp ON a.candidate_id = cp.id
      JOIN jobs.jobs j ON a.job_id = j.id
      JOIN discovery.companies c ON j.company_id = c.id
      LEFT JOIN docs.resume_versions rv ON a.resume_version_id = rv.id
      WHERE 1=1
        ${candidateId ? db`AND a.candidate_id = ${candidateId}` : db``}
        ${jobId ? db`AND a.job_id = ${jobId}` : db``}
        ${status && status !== 'ALL' ? db`AND a.status = ${status}` : db``}
      ORDER BY a.updated_at DESC
      LIMIT ${numLimit} OFFSET ${numOffset}
    `;

    return reply.send({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        candidateId: r.candidate_id,
        candidateName: r.candidate_name,
        candidateEmail: r.candidate_email,
        jobId: r.job_id,
        jobTitle: r.job_title,
        jobApplyUrl: r.job_apply_url,
        companyName: r.company_name,
        resumeVersionId: r.resume_version_id,
        resumeVersionNo: r.resume_version_no,
        coverLetterVersionId: r.cover_letter_version_id,
        status: r.status,
        notes: r.notes,
        runCount: Number(r.run_count),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  });

  // GET /api/applications/:id - Detailed view for human review
  app.get<{ Params: { id: string } }>('/api/applications/:id', async (req, reply) => {
    try {
      const [appRecord] = await db`
        SELECT 
          a.*,
          cp.full_name as candidate_name,
          cp.email as candidate_email,
          j.title as job_title,
          j.apply_url as job_apply_url,
          j.description as job_description,
          c.name as company_name,
          (SELECT domain FROM discovery.company_domains cd WHERE cd.company_id = c.id LIMIT 1) as company_domain
        FROM apply.applications a
        JOIN profile.candidate_profiles cp ON a.candidate_id = cp.id
        JOIN jobs.jobs j ON a.job_id = j.id
        JOIN discovery.companies c ON j.company_id = c.id
        WHERE a.id = ${req.params.id}
      `;

      if (!appRecord) {
        return reply.code(404).send({ success: false, error: 'Application not found' });
      }

      // Fetch Resume Version if present
      let resume = null;
      if (appRecord.resume_version_id) {
        const [r] = await db`
          SELECT rv.*, a.storage_path
          FROM docs.resume_versions rv
          JOIN docs.artifacts a ON rv.artifact_id = a.id
          WHERE rv.id = ${appRecord.resume_version_id}
        `;
        if (r) {
          resume = {
            id: r.id,
            versionNo: r.version_no,
            title: r.title,
            templateName: r.template_name,
            markdownText: r.markdown_text,
            storagePath: r.storage_path,
          };
        }
      }

      // Fetch Cover Letter Version if present
      let coverLetter = null;
      if (appRecord.cover_letter_version_id) {
        const [cl] = await db`
          SELECT clv.*, a.storage_path
          FROM docs.cover_letter_versions clv
          JOIN docs.artifacts a ON clv.artifact_id = a.id
          WHERE clv.id = ${appRecord.cover_letter_version_id}
        `;
        if (cl) {
          coverLetter = {
            id: cl.id,
            title: cl.title,
            markdownText: cl.markdown_text,
            storagePath: cl.storage_path,
            companyDiscoveryCitations: cl.company_discovery_citations,
            factIds: cl.fact_ids,
          };
        }
      }

      // Fetch Candidate Answers from Memory
      const candidateAnswers = await db`
        SELECT * FROM apply.candidate_answers
        WHERE candidate_id = ${appRecord.candidate_id}
        ORDER BY category ASC
      `;

      // Fetch Application Runs
      const runs = await workflowEngine.getApplicationRuns(appRecord.id);

      // Fetch Job Match Criteria (Evidence Checklist)
      const [match] = await db`
        SELECT id, score, verdict
        FROM jobs.job_matches
        WHERE job_id = ${appRecord.job_id} AND candidate_id = ${appRecord.candidate_id}
      `;

      let criteria: any[] = [];
      if (match) {
        criteria = await db`
          SELECT * FROM jobs.job_match_criteria
          WHERE match_id = ${match.id}
        `;
      }

      return reply.send({
        success: true,
        data: {
          id: appRecord.id,
          candidateId: appRecord.candidate_id,
          candidateName: appRecord.candidate_name,
          candidateEmail: appRecord.candidate_email,
          jobId: appRecord.job_id,
          jobTitle: appRecord.job_title,
          jobDescription: appRecord.job_description,
          jobApplyUrl: appRecord.job_apply_url,
          companyName: appRecord.company_name,
          companyDomain: appRecord.company_domain,
          resumeVersionId: appRecord.resume_version_id,
          coverLetterVersionId: appRecord.cover_letter_version_id,
          status: appRecord.status,
          notes: appRecord.notes,
          createdAt: appRecord.created_at,
          updatedAt: appRecord.updated_at,
          resume,
          coverLetter,
          candidateAnswers: candidateAnswers.map(a => ({
            id: a.id,
            questionPattern: a.question_pattern,
            answerText: a.answer_text,
            category: a.category,
            verified: a.verified,
          })),
          match: match ? {
            score: Number(match.score),
            verdict: match.verdict,
            criteria: criteria.map(c => ({
              criterion: c.criterion,
              result: c.result,
              evidence: c.evidence,
              factIds: c.fact_ids,
            })),
          } : null,
          runs,
        },
      });
    } catch (err: any) {
      console.error('Error in GET /api/applications/:id:', err);
      return reply.code(500).send({ success: false, error: err.message, stack: err.stack });
    }
  });

  // POST /api/applications/draft - Create or get existing draft application
  app.post<{
    Body: {
      candidateId: string;
      jobId: string;
      resumeVersionId?: string;
      coverLetterVersionId?: string;
      notes?: string;
    };
  }>('/api/applications/draft', async (req, reply) => {
    const { candidateId, jobId, resumeVersionId, coverLetterVersionId, notes } = req.body;

    if (!candidateId || !jobId) {
      return reply.code(400).send({
        success: false,
        error: 'candidateId and jobId are required',
      });
    }

    try {
      const draft = await workflowEngine.createDraft({
        candidateId,
        jobId,
        resumeVersionId,
        coverLetterVersionId,
        notes,
      });

      return reply.code(201).send({
        success: true,
        data: draft,
      });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // POST /api/applications/:id/prepare - Prepare application for approval
  app.post<{
    Params: { id: string };
    Body?: {
      canSubmit?: boolean;
      pauseReason?: string;
      filledFields?: any[];
      unresolvedFields?: string[];
    };
  }>('/api/applications/:id/prepare', async (req, reply) => {
    const { id } = req.params;
    const body = req.body || {};

    const autoFillResult: AutoFillResult = {
      canSubmit: body.canSubmit ?? true,
      pauseReason: body.pauseReason as any,
      filledFields: (body.filledFields as any) ?? [
        {
          field: {
            name: 'full_name',
            type: 'text' as any,
            required: true,
            label: 'Full Name',
            standardCategory: 'first_name',
            selector: 'input[name="full_name"]',
          },
          value: 'Candidate',
          confidence: 1.0,
          source: 'PROFILE' as any,
          requiresHumanReview: false,
        },
      ],
      unresolvedFields: (body.unresolvedFields as any) ?? [],
    };

    try {
      const prepared = await workflowEngine.prepareApplication(id, autoFillResult);
      return reply.send({
        success: true,
        data: prepared,
      });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // POST /api/applications/:id/approve - Human Approval Gate
  app.post<{
    Params: { id: string };
    Body?: { approvedBy?: string; notes?: string };
  }>('/api/applications/:id/approve', async (req, reply) => {
    const { id } = req.params;
    const { approvedBy = 'human_reviewer', notes } = req.body || {};

    try {
      const approved = await workflowEngine.approveApplication(id, {
        approvedBy,
        notes: notes ?? 'Approved by human reviewer in Web Dashboard',
      });

      return reply.send({
        success: true,
        data: approved,
      });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // POST /api/applications/:id/pause - Pause application
  app.post<{
    Params: { id: string };
    Body: { reason: string };
  }>('/api/applications/:id/pause', async (req, reply) => {
    const { id } = req.params;
    const { reason } = req.body || {};

    if (!reason) {
      return reply.code(400).send({ success: false, error: 'Pause reason is required' });
    }

    try {
      const paused = await workflowEngine.pauseApplication(id, reason);
      return reply.send({
        success: true,
        data: paused,
      });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // POST /api/applications/:id/run - Execute application run (simulated or automated)
  app.post<{
    Params: { id: string };
    Body?: { path?: 'PLAYWRIGHT' | 'EXTENSION'; autoSubmit?: boolean };
  }>('/api/applications/:id/run', async (req, reply) => {
    const { id } = req.params;
    const { path = 'PLAYWRIGHT', autoSubmit = true } = req.body || {};

    // Mock/Simulated Playwright driver for sandbox runs
    const sandboxDriver = {
      fillAndSubmit: async () => ({
        success: true,
        submitted: autoSubmit,
        confirmationSignal: 'Submission confirmation received (Sandbox simulated)',
        filledFields: ['first_name', 'last_name', 'email', 'resume', 'cover_letter'],
      }),
    };

    const autoFillResult: AutoFillResult = {
      canSubmit: true,
      filledFields: [
        {
          field: {
            name: 'full_name',
            type: 'text' as any,
            required: true,
            label: 'Full Name',
            standardCategory: 'first_name',
            selector: 'input[name="full_name"]',
          },
          value: 'Candidate Name',
          confidence: 1.0,
          source: 'PROFILE' as any,
        },
      ],
      unresolvedFields: [],
    };

    try {
      const result = await workflowEngine.executeApplicationRun(id, {
        path,
        driver: sandboxDriver,
        autoFillResult,
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      // Specifically catch human approval gate invariant violation (HTTP 403 Forbidden)
      if (
        err.message?.includes('Invariant violation') ||
        err.message?.includes('Human approval is strictly required') ||
        err.message?.includes('APPROVAL GATE')
      ) {
        return reply.code(403).send({
          success: false,
          error: err.message,
          code: 'HUMAN_APPROVAL_REQUIRED',
        });
      }

      return reply.code(400).send({ success: false, error: err.message });
    }
  });
}

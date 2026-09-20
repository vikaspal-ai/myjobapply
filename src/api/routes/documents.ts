import type { FastifyInstance } from 'fastify';
import { sql } from '../../db/index.js';

const db = sql!;

export async function documentRoutes(app: FastifyInstance) {
  // GET /api/resumes - List resumes for a candidate
  app.get<{
    Querystring: {
      candidateId?: string;
      jobId?: string;
    };
  }>('/api/resumes', async (req, reply) => {
    const { candidateId, jobId } = req.query;

    const rows = await db`
      SELECT 
        rv.id,
        rv.resume_id,
        rv.version_no,
        rv.parent_version_id,
        rv.job_id,
        rv.template_name,
        rv.content_hash,
        rv.plan,
        rv.created_at,
        r.title,
        r.candidate_id,
        r.is_master,
        a.storage_path,
        a.size_bytes
      FROM docs.resume_versions rv
      JOIN docs.resumes r ON rv.resume_id = r.id
      LEFT JOIN docs.artifacts a ON rv.artifact_id = a.id
      WHERE 1=1
        ${candidateId ? db`AND r.candidate_id = ${candidateId}` : db``}
        ${jobId ? db`AND rv.job_id = ${jobId}` : db``}
      ORDER BY rv.created_at DESC
    `;

    return reply.send({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        resumeId: r.resume_id,
        candidateId: r.candidate_id,
        title: r.title,
        isMaster: r.is_master,
        versionNo: r.version_no,
        jobId: r.job_id,
        templateName: r.template_name,
        contentHash: r.content_hash,
        plan: r.plan,
        storagePath: r.storage_path,
        sizeBytes: r.size_bytes,
        createdAt: r.created_at,
      })),
    });
  });

  // GET /api/resumes/:id - Single resume version with plan and citations
  app.get<{ Params: { id: string } }>('/api/resumes/:id', async (req, reply) => {
    const [row] = await db`
      SELECT 
        rv.*,
        r.title,
        r.candidate_id,
        r.is_master,
        a.storage_path,
        a.size_bytes,
        j.title as job_title,
        c.name as company_name
      FROM docs.resume_versions rv
      JOIN docs.resumes r ON rv.resume_id = r.id
      LEFT JOIN docs.artifacts a ON rv.artifact_id = a.id
      LEFT JOIN jobs.jobs j ON rv.job_id = j.id
      LEFT JOIN discovery.companies c ON j.company_id = c.id
      WHERE rv.id = ${req.params.id}
    `;

    if (!row) {
      return reply.code(404).send({ success: false, error: 'Resume version not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: row.id,
        resumeId: row.resume_id,
        candidateId: row.candidate_id,
        title: row.title,
        isMaster: row.is_master,
        versionNo: row.version_no,
        jobId: row.job_id,
        jobTitle: row.job_title,
        companyName: row.company_name,
        templateName: row.template_name,
        contentHash: row.content_hash,
        plan: row.plan,
        storagePath: row.storage_path,
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
      },
    });
  });

  // GET /api/cover-letters - List cover letters
  app.get<{
    Querystring: {
      candidateId?: string;
      jobId?: string;
    };
  }>('/api/cover-letters', async (req, reply) => {
    const { candidateId, jobId } = req.query;

    const rows = await db`
      SELECT 
        clv.id,
        clv.cover_letter_id,
        clv.version_no,
        clv.job_id,
        clv.markdown_text,
        clv.company_discovery_citations,
        clv.fact_ids,
        clv.created_at,
        cl.title,
        cl.candidate_id,
        j.title as job_title,
        c.name as company_name
      FROM docs.cover_letter_versions clv
      JOIN docs.cover_letters cl ON clv.cover_letter_id = cl.id
      LEFT JOIN jobs.jobs j ON clv.job_id = j.id
      LEFT JOIN discovery.companies c ON j.company_id = c.id
      WHERE 1=1
        ${candidateId ? db`AND cl.candidate_id = ${candidateId}` : db``}
        ${jobId ? db`AND clv.job_id = ${jobId}` : db``}
      ORDER BY clv.created_at DESC
    `;

    return reply.send({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        coverLetterId: r.cover_letter_id,
        candidateId: r.candidate_id,
        title: r.title,
        versionNo: r.version_no,
        jobId: r.job_id,
        jobTitle: r.job_title,
        companyName: r.company_name,
        markdownText: r.markdown_text,
        companyDiscoveryCitations: r.company_discovery_citations,
        factIds: r.fact_ids,
        createdAt: r.created_at,
      })),
    });
  });
}

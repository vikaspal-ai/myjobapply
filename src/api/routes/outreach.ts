import type { FastifyInstance } from 'fastify';
import { sql } from '../../db/index.js';
import { emailService } from '../../outreach/email-service.js';
import { suppressionService } from '../../outreach/suppression.js';
import { contactExtractor } from '../../outreach/contact-extractor.js';

const db = sql!;

export async function outreachRoutes(app: FastifyInstance) {
  // GET /api/outreach/messages - List outreach messages
  app.get<{
    Querystring: {
      candidateId?: string;
      companyId?: string;
      status?: string;
    };
  }>('/api/outreach/messages', async (req, reply) => {
    const { candidateId, companyId, status } = req.query;

    const rows = await db`
      SELECT 
        m.*,
        cp.full_name as candidate_name,
        c.name as company_name,
        cc.email as contact_email,
        cc.name as contact_name
      FROM outreach.messages m
      JOIN profile.candidate_profiles cp ON m.candidate_id = cp.id
      JOIN discovery.companies c ON m.company_id = c.id
      LEFT JOIN outreach.company_contacts cc ON m.contact_id = cc.id
      WHERE 1=1
        ${candidateId ? db`AND m.candidate_id = ${candidateId}` : db``}
        ${companyId ? db`AND m.company_id = ${companyId}` : db``}
        ${status && status !== 'ALL' ? db`AND m.status = ${status}` : db``}
      ORDER BY m.created_at DESC
    `;

    return reply.send({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        candidateId: r.candidate_id,
        candidateName: r.candidate_name,
        companyId: r.company_id,
        companyName: r.company_name,
        contactEmail: r.contact_email,
        contactName: r.contact_name,
        subject: r.subject,
        bodyText: r.body_text,
        status: r.status,
        correlationToken: r.correlation_token,
        approvedAt: r.approved_at,
        sentAt: r.sent_at,
        createdAt: r.created_at,
      })),
    });
  });

  // POST /api/outreach/draft - Draft a personalized outreach cold email
  app.post<{
    Body: {
      candidateId: string;
      companyId: string;
      contactId?: string;
      jobId?: string;
      resumeVersionId?: string;
    };
  }>('/api/outreach/draft', async (req, reply) => {
    const { candidateId, companyId, contactId, jobId, resumeVersionId } = req.body;

    if (!candidateId || !companyId) {
      return reply.code(400).send({
        success: false,
        error: 'candidateId and companyId are required',
      });
    }

    try {
      const draft = await emailService.draftOutreach({
        candidateId,
        companyId,
        contactId,
        jobId,
        resumeVersionId,
      });

      return reply.code(201).send({
        success: true,
        data: draft,
      });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // POST /api/outreach/:id/approve - Human Approval Gate
  app.post<{
    Params: { id: string };
    Body?: { approvedBy?: string };
  }>('/api/outreach/:id/approve', async (req, reply) => {
    const { id } = req.params;
    const { approvedBy = 'user' } = req.body || {};

    try {
      const approved = await emailService.approveOutreach(id, approvedBy);
      return reply.send({
        success: true,
        data: approved,
      });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // POST /api/outreach/:id/send - Send email via provider port
  app.post<{
    Params: { id: string };
  }>('/api/outreach/:id/send', async (req, reply) => {
    const { id } = req.params;

    try {
      const result = await emailService.sendOutreach(id);
      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err.message?.includes('Human approval is strictly required') || err.message?.includes('Invariant violation')) {
        return reply.code(403).send({
          success: false,
          error: err.message,
          code: 'HUMAN_APPROVAL_REQUIRED',
        });
      }
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // POST /api/outreach/contacts/extract - Extract public contacts from HTML
  app.post<{
    Body: { companyId: string; html: string; sourceUrl: string };
  }>('/api/outreach/contacts/extract', async (req, reply) => {
    const { companyId, html, sourceUrl } = req.body;

    if (!companyId || !html || !sourceUrl) {
      return reply.code(400).send({
        success: false,
        error: 'companyId, html, and sourceUrl are required',
      });
    }

    try {
      const contacts = contactExtractor.extractContactsFromHtml(html, sourceUrl);
      const saved = await contactExtractor.saveDiscoveredContacts(companyId, contacts);
      return reply.send({
        success: true,
        data: {
          extractedCount: contacts.length,
          savedCount: saved.length,
          contacts: saved,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // GET /api/outreach/suppression - List suppressed targets
  app.get('/api/outreach/suppression', async (_req, reply) => {
    const items = await db`
      SELECT * FROM outreach.suppression_list
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return reply.send({
      success: true,
      data: items,
    });
  });

  // POST /api/outreach/suppression - Add suppression record
  app.post<{
    Body: {
      email?: string;
      domain?: string;
      reason: 'UNSUBSCRIBE' | 'BOUNCE' | 'MANUAL' | 'COMPLAINT' | 'COOLDOWN';
      notes?: string;
    };
  }>('/api/outreach/suppression', async (req, reply) => {
    const { email, domain, reason, notes } = req.body;

    try {
      const record = await suppressionService.addSuppression({ email, domain, reason, notes });
      return reply.code(201).send({
        success: true,
        data: record,
      });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });
}

import type { FastifyInstance } from 'fastify';
import { sql } from '../../db/index.js';

const db = sql!;

export async function candidateRoutes(app: FastifyInstance) {
  // GET /api/candidates - List all candidate profiles
  app.get('/api/candidates', async (_req, reply) => {
    const candidates = await db`
      SELECT id, full_name, email, created_at, updated_at
      FROM profile.candidate_profiles
      ORDER BY created_at DESC
    `;

    return reply.send({
      success: true,
      data: candidates.map(c => ({
        id: c.id,
        fullName: c.full_name,
        email: c.email,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  });

  // GET /api/candidates/:id - Get specific candidate profile
  app.get<{ Params: { id: string } }>('/api/candidates/:id', async (req, reply) => {
    const [candidate] = await db`
      SELECT id, full_name, email, created_at, updated_at
      FROM profile.candidate_profiles
      WHERE id = ${req.params.id}
    `;

    if (!candidate) {
      return reply.code(404).send({ success: false, error: 'Candidate not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: candidate.id,
        fullName: candidate.full_name,
        email: candidate.email,
        createdAt: candidate.created_at,
        updatedAt: candidate.updated_at,
      },
    });
  });

  // GET /api/candidates/:id/facts - List facts for a candidate
  app.get<{ Params: { id: string }; Querystring: { category?: string; verifiedOnly?: string } }>(
    '/api/candidates/:id/facts',
    async (req, reply) => {
      const { category, verifiedOnly } = req.query;

      let query = db`
        SELECT id, candidate_id, category, statement, verified, created_at
        FROM profile.candidate_facts
        WHERE candidate_id = ${req.params.id}
      `;

      if (category) {
        query = db`${query} AND category = ${category}`;
      }

      if (verifiedOnly === 'true') {
        query = db`${query} AND verified = true`;
      }

      const facts = await db`
        ${query}
        ORDER BY category ASC, created_at DESC
      `;

      return reply.send({
        success: true,
        data: facts.map(f => ({
          id: f.id,
          candidateId: f.candidate_id,
          category: f.category,
          statement: f.statement,
          verified: f.verified,
          createdAt: f.created_at,
        })),
      });
    },
  );

  // POST /api/candidates/:id/facts - Create a new verified/unverified fact
  app.post<{
    Params: { id: string };
    Body: { category: string; statement: string; verified?: boolean };
  }>('/api/candidates/:id/facts', async (req, reply) => {
    const { category, statement, verified = true } = req.body;

    const validCategories = ['skill', 'experience', 'education', 'project', 'certification'];
    if (!category || !validCategories.includes(category.toLowerCase())) {
      return reply.code(400).send({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    if (!statement || statement.trim().length === 0) {
      return reply.code(400).send({ success: false, error: 'Statement cannot be empty' });
    }

    const [inserted] = await db`
      INSERT INTO profile.candidate_facts (
        candidate_id,
        category,
        statement,
        verified
      ) VALUES (
        ${req.params.id},
        ${category.toLowerCase()},
        ${statement.trim()},
        ${verified}
      )
      RETURNING *
    `;

    return reply.code(201).send({
      success: true,
      data: {
        id: inserted.id,
        candidateId: inserted.candidate_id,
        category: inserted.category,
        statement: inserted.statement,
        verified: inserted.verified,
        createdAt: inserted.created_at,
      },
    });
  });

  // PATCH /api/candidates/:id/facts/:factId - Update verification status or statement
  app.patch<{
    Params: { id: string; factId: string };
    Body: { verified?: boolean; statement?: string };
  }>('/api/candidates/:id/facts/:factId', async (req, reply) => {
    const { verified, statement } = req.body;

    const [existing] = await db`
      SELECT * FROM profile.candidate_facts
      WHERE id = ${req.params.factId} AND candidate_id = ${req.params.id}
    `;

    if (!existing) {
      return reply.code(404).send({ success: false, error: 'Fact not found' });
    }

    const newVerified = verified !== undefined ? verified : existing.verified;
    const newStatement = statement !== undefined ? statement.trim() : existing.statement;

    const [updated] = await db`
      UPDATE profile.candidate_facts
      SET verified = ${newVerified},
          statement = ${newStatement}
      WHERE id = ${req.params.factId}
      RETURNING *
    `;

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        candidateId: updated.candidate_id,
        category: updated.category,
        statement: updated.statement,
        verified: updated.verified,
        createdAt: updated.created_at,
      },
    });
  });
}

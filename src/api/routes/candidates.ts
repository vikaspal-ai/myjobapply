import type { FastifyInstance } from 'fastify';
import { sql } from '../../db/index.js';
import { supabase } from '../../db/index.js';

const db = sql!;

export async function candidateRoutes(app: FastifyInstance) {
  // POST /api/candidates - Create new candidate profile (onboarding)
  app.post<{
    Body: {
      fullName: string;
      email: string;
      preferredLocations?: string[];
      currentLocation?: string;
      experienceYears?: number;
      currentJob?: string;
      currentCompany?: string;
      authUserId?: string; // Supabase auth.uid()
    };
  }>('/api/candidates', async (req, reply) => {
    const { fullName, email, preferredLocations, currentLocation, experienceYears, currentJob, currentCompany, authUserId } = req.body;

    if (!fullName || !email) {
      return reply.code(400).send({ success: false, error: 'fullName and email are required' });
    }

    // Check if profile already exists for this email
    const [existing] = await db`
      SELECT id FROM profile.candidate_profiles WHERE email = ${email}
    `;

    if (existing) {
      return reply.code(409).send({ success: false, error: 'Profile with this email already exists', data: { id: existing.id } });
    }

    const [inserted] = await db`
      INSERT INTO profile.candidate_profiles (
        full_name, email, preferred_locations, current_location, experience_years, current_job, current_company, auth_user_id
      ) VALUES (
        ${fullName}, ${email},
        ${preferredLocations || ['Mumbai', 'Pune', 'Bengaluru', 'Remote']},
        ${currentLocation || 'India'},
        ${experienceYears ?? null},
        ${currentJob ?? null},
        ${currentCompany ?? null},
        ${authUserId ?? null}
      )
      RETURNING id, full_name, email, preferred_locations, current_location, experience_years, current_job, current_company, created_at, updated_at
    `;

    return reply.code(201).send({
      success: true,
      data: {
        id: inserted.id,
        fullName: inserted.full_name,
        email: inserted.email,
        preferredLocations: inserted.preferred_locations,
        currentLocation: inserted.current_location,
        experienceYears: inserted.experience_years,
        currentJob: inserted.current_job,
        currentCompany: inserted.current_company,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
      },
    });
  });

  // GET /api/candidates - List candidate profiles (supports email filter)
  app.get<{
    Querystring: { includeTest?: string; email?: string };
  }>('/api/candidates', async (req, reply) => {
    const { includeTest, email } = req.query;
    const showAll = includeTest === 'true' || !!email;

    const candidates = await db`
      SELECT id, full_name, email, preferred_locations, current_location, is_demo,
             experience_years, current_job, current_company, auth_user_id, created_at, updated_at
      FROM profile.candidate_profiles
      WHERE ${email ? db`email = ${email}` : (showAll ? db`true` : db`is_demo = true`)}
      ORDER BY created_at DESC
    `;

    return reply.send({
      success: true,
      data: candidates.map(c => ({
        id: c.id,
        fullName: c.full_name,
        email: c.email,
        preferredLocations: c.preferred_locations || ['Mumbai', 'Pune', 'Bengaluru', 'Remote'],
        currentLocation: c.current_location || 'India',
        experienceYears: c.experience_years,
        currentJob: c.current_job,
        currentCompany: c.current_company,
        authUserId: c.auth_user_id,
        isDemo: c.is_demo,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  });

  // GET /api/candidates/by-email/:email - Lookup profile by email
  app.get<{ Params: { email: string } }>('/api/candidates/by-email/:email', async (req, reply) => {
    const email = decodeURIComponent(req.params.email);
    const [candidate] = await db`
      SELECT id, full_name, email, preferred_locations, current_location, is_demo,
             experience_years, current_job, current_company, auth_user_id, created_at, updated_at
      FROM profile.candidate_profiles
      WHERE email = ${email}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (!candidate) {
      return reply.code(404).send({ success: false, error: 'Candidate profile not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: candidate.id,
        fullName: candidate.full_name,
        email: candidate.email,
        preferredLocations: candidate.preferred_locations || ['Mumbai', 'Pune', 'Bengaluru', 'Remote'],
        currentLocation: candidate.current_location || 'India',
        experienceYears: candidate.experience_years,
        currentJob: candidate.current_job,
        currentCompany: candidate.current_company,
        authUserId: candidate.auth_user_id,
        isDemo: candidate.is_demo,
        createdAt: candidate.created_at,
        updatedAt: candidate.updated_at,
      },
    });
  });

  // GET /api/candidates/:id - Get specific candidate profile
  app.get<{ Params: { id: string } }>('/api/candidates/:id', async (req, reply) => {
    const [candidate] = await db`
      SELECT id, full_name, email, preferred_locations, current_location, is_demo,
             experience_years, current_job, current_company, auth_user_id, created_at, updated_at
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
        preferredLocations: candidate.preferred_locations || ['Mumbai', 'Pune', 'Bengaluru', 'Remote'],
        currentLocation: candidate.current_location || 'India',
        experienceYears: candidate.experience_years,
        currentJob: candidate.current_job,
        currentCompany: candidate.current_company,
        authUserId: candidate.auth_user_id,
        isDemo: candidate.is_demo,
        createdAt: candidate.created_at,
        updatedAt: candidate.updated_at,
      },
    });
  });

  // PATCH /api/candidates/:id/preferences - Update location preferences
  app.patch<{
    Params: { id: string };
    Body: { preferredLocations?: string[]; currentLocation?: string };
  }>('/api/candidates/:id/preferences', async (req, reply) => {
    const { preferredLocations, currentLocation } = req.body || {};
    const [updated] = await db`
      UPDATE profile.candidate_profiles
      SET preferred_locations = COALESCE(${preferredLocations || null}, preferred_locations),
          current_location = COALESCE(${currentLocation || null}, current_location),
          updated_at = now()
      WHERE id = ${req.params.id}
      RETURNING id, full_name, email, preferred_locations, current_location, updated_at
    `;

    if (!updated) {
      return reply.code(404).send({ success: false, error: 'Candidate not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        fullName: updated.full_name,
        email: updated.email,
        preferredLocations: updated.preferred_locations,
        currentLocation: updated.current_location,
        updatedAt: updated.updated_at,
      },
    });
  });

  // PATCH /api/candidates/:id - Update full candidate profile
  app.patch<{
    Params: { id: string };
    Body: {
      fullName?: string;
      experienceYears?: number | null;
      currentJob?: string | null;
      currentCompany?: string | null;
    };
  }>('/api/candidates/:id', async (req, reply) => {
    const { fullName, experienceYears, currentJob, currentCompany } = req.body || {};

    const [updated] = await db`
      UPDATE profile.candidate_profiles
      SET full_name = COALESCE(${fullName ?? null}, full_name),
          experience_years = COALESCE(${experienceYears ?? null}, experience_years),
          current_job = COALESCE(${currentJob ?? null}, current_job),
          current_company = COALESCE(${currentCompany ?? null}, current_company),
          updated_at = now()
      WHERE id = ${req.params.id}
      RETURNING id, full_name, email, preferred_locations, current_location, experience_years, current_job, current_company, updated_at
    `;

    if (!updated) {
      return reply.code(404).send({ success: false, error: 'Candidate not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        fullName: updated.full_name,
        email: updated.email,
        preferredLocations: updated.preferred_locations,
        currentLocation: updated.current_location,
        experienceYears: updated.experience_years,
        currentJob: updated.current_job,
        currentCompany: updated.current_company,
        updatedAt: updated.updated_at,
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

  // POST /api/candidates/parse-resume - Parse resume text into structured skills & facts
  app.post<{
    Body: { resumeText: string; candidateId?: string };
  }>('/api/candidates/parse-resume', async (req, reply) => {
    const { resumeText, candidateId } = req.body || {};

    if (!resumeText || resumeText.trim().length < 10) {
      return reply.code(400).send({ success: false, error: 'resumeText must be at least 10 characters' });
    }

    // 1. Skill Extraction dictionary
    const skillDictionary = [
      'react', 'node.js', 'nodejs', 'typescript', 'javascript', 'python', 'postgresql', 'postgres',
      'mongodb', 'docker', 'kubernetes', 'aws', 'fastify', 'express', 'next.js', 'nextjs',
      'java', 'spring boot', 'golang', 'go', 'redis', 'kafka', 'graphql', 'rest api', 'microservices',
      'html5', 'css3', 'tailwind', 'git', 'ci/cd', 'playwright', 'vitest', 'jest', 'sql'
    ];

    const detectedSkills: string[] = [];
    for (const skill of skillDictionary) {
      const regex = new RegExp(`\\b${skill.replace('.', '\\.')}\\b`, 'i');
      if (regex.test(resumeText)) {
        const formatted = skill === 'nodejs' ? 'Node.js' :
                          skill === 'nextjs' ? 'Next.js' :
                          skill === 'postgres' ? 'PostgreSQL' :
                          skill.charAt(0).toUpperCase() + skill.slice(1);
        if (!detectedSkills.includes(formatted)) {
          detectedSkills.push(formatted);
        }
      }
    }

    // 2. Experience Extraction
    let experienceYears = 3;
    const expMatch = resumeText.match(/(\d{1,2})\+?\s*(?:years?|yrs?)/i);
    if (expMatch) {
      experienceYears = parseInt(expMatch[1], 10);
    }

    // 3. Suggested Title
    let suggestedTitle = 'Full Stack Engineer';
    if (/frontend/i.test(resumeText)) suggestedTitle = 'Frontend Engineer';
    else if (/backend/i.test(resumeText)) suggestedTitle = 'Backend Engineer';
    else if (/devops|cloud/i.test(resumeText)) suggestedTitle = 'Cloud / DevOps Engineer';

    // 4. Calculate ATS score
    const atsScore = Math.min(96, Math.max(70, 75 + detectedSkills.length * 2 + Math.min(experienceYears, 10)));

    // 5. If candidateId provided, persist detected skills as verified facts
    if (candidateId) {
      for (const skill of detectedSkills.slice(0, 10)) {
        try {
          await db`
            INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
            VALUES (${candidateId}, 'skill', ${skill}, true)
            ON CONFLICT DO NOTHING
          `;
        } catch {}
      }
    }

    return reply.send({
      success: true,
      data: {
        skills: detectedSkills,
        experienceYears,
        suggestedTitle,
        atsScore,
      },
    });
  });
}

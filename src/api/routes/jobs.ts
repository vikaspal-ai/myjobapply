import type { FastifyInstance } from 'fastify';
import { sql } from '../../db/index.js';
import { searchGoogleJobs } from '../../ingest/aggregators/serpapi.js';
import { searchRapidJobs } from '../../ingest/aggregators/rapidapi.js';
import { DeduplicationEngine } from '../../jobs/dedup.js';
import { RequirementsService } from '../../jobs/requirements.js';
import { MatchingService } from '../../jobs/matching.js';

const db = sql!;

export async function jobRoutes(app: FastifyInstance) {
  // GET /api/jobs - List canonical jobs with optional filters and match scoring
  app.get<{
    Querystring: {
      search?: string;
      status?: string;
      candidateId?: string;
      minScore?: string;
      location?: string;
      realOnly?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/jobs', async (req, reply) => {
    const { search, status = 'ACTIVE', candidateId, minScore, location, realOnly, limit = '50', offset = '0' } = req.query;
    const numLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const numOffset = Math.max(0, parseInt(offset, 10) || 0);

    // Location SQL fragment
    const locLower = location?.toLowerCase().trim();
    const locationFilter = !locLower || locLower === 'all'
      ? db``
      : locLower === 'remote'
      ? db`AND (j.location->>'workplaceType' = 'remote' OR j.location->>'type' = 'REMOTE' OR j.location::text ILIKE '%remote%' OR j.title ILIKE '%remote%')`
      : locLower === 'bengaluru' || locLower === 'bangalore'
      ? db`AND (j.location->>'city' ILIKE '%bengaluru%' OR j.location->>'city' ILIKE '%bangalore%' OR j.location::text ILIKE '%bengaluru%' OR j.location::text ILIKE '%bangalore%' OR j.description ILIKE '%bengaluru%' OR j.description ILIKE '%bangalore%')`
      : locLower === 'mumbai'
      ? db`AND (j.location->>'city' ILIKE '%mumbai%' OR j.location::text ILIKE '%mumbai%' OR j.description ILIKE '%mumbai%')`
      : locLower === 'pune'
      ? db`AND (j.location->>'city' ILIKE '%pune%' OR j.location::text ILIKE '%pune%' OR j.description ILIKE '%pune%')`
      : db`AND (j.location->>'city' ILIKE ${'%' + locLower + '%'} OR j.location::text ILIKE ${'%' + locLower + '%'} OR j.description ILIKE ${'%' + locLower + '%'})`;

    const realFilter = realOnly === 'true'
      ? db`AND (j.is_synthetic = false OR j.is_synthetic IS NULL) 
           AND c.name NOT ILIKE '%TEST%' 
           AND c.name NOT ILIKE '%AUTOFILL%' 
           AND c.name NOT ILIKE '%CHAOS%' 
           AND c.name NOT ILIKE '%Nova Systems%' 
           AND c.name NOT ILIKE '%FinTech Global%' 
           AND c.name NOT ILIKE '%Pipeline Corp%'`
      : db``;

    let rows;
    if (candidateId) {
      // Return jobs joined with candidate matches
      rows = await db`
        SELECT 
          j.id,
          j.title,
          j.status,
          j.role_family,
          j.seniority,
          j.location,
          j.salary,
          j.apply_url,
          j.source_attribution,
          j.is_synthetic,
          j.created_at,
          c.name as company_name,
          (SELECT domain FROM discovery.company_domains cd WHERE cd.company_id = c.id LIMIT 1) as company_domain,
          jm.score as match_score,
          jm.verdict as match_verdict
        FROM jobs.jobs j
        JOIN discovery.companies c ON j.company_id = c.id
        LEFT JOIN jobs.job_matches jm 
          ON j.id = jm.job_id AND jm.candidate_id = ${candidateId}
        WHERE (${status} = 'ALL' OR j.status = ${status})
          ${search ? db`AND (j.title ILIKE ${'%' + search + '%'} OR c.name ILIKE ${'%' + search + '%'})` : db``}
          ${minScore ? db`AND jm.score >= ${parseFloat(minScore)}` : db``}
          ${locationFilter}
          ${realFilter}
        ORDER BY jm.score DESC NULLS LAST, j.created_at DESC
        LIMIT ${numLimit} OFFSET ${numOffset}
      `;
    } else {
      rows = await db`
        SELECT 
          j.id,
          j.title,
          j.status,
          j.role_family,
          j.seniority,
          j.location,
          j.salary,
          j.apply_url,
          j.source_attribution,
          j.is_synthetic,
          j.created_at,
          c.name as company_name,
          (SELECT domain FROM discovery.company_domains cd WHERE cd.company_id = c.id LIMIT 1) as company_domain
        FROM jobs.jobs j
        JOIN discovery.companies c ON j.company_id = c.id
        WHERE (${status} = 'ALL' OR j.status = ${status})
          ${search ? db`AND (j.title ILIKE ${'%' + search + '%'} OR c.name ILIKE ${'%' + search + '%'})` : db``}
          ${locationFilter}
          ${realFilter}
        ORDER BY j.created_at DESC
        LIMIT ${numLimit} OFFSET ${numOffset}
      `;
    }

    return reply.send({
      success: true,
      data: rows.map(r => {
        let locationDisplay = 'Location Not Specified';
        if (r.location?.city) {
          locationDisplay = `${r.location.city}${r.location.country ? ', ' + r.location.country : ''}`;
          if (r.location.workplaceType && r.location.workplaceType !== 'unknown') {
            locationDisplay += ` (${r.location.workplaceType.charAt(0).toUpperCase() + r.location.workplaceType.slice(1)})`;
          }
        } else if (r.location?.type === 'REMOTE' || r.location?.workplaceType === 'remote') {
          locationDisplay = 'Remote';
        } else if (r.location?.country) {
          locationDisplay = String(r.location.country);
        }

        return {
          id: r.id,
          title: r.title,
          companyName: r.company_name,
          companyDomain: r.company_domain,
          status: r.status,
          roleFamily: r.role_family,
          seniority: r.seniority,
          location: r.location,
          locationDisplay,
          isSynthetic: Boolean(r.is_synthetic),
          salary: r.salary,
          applyUrl: r.apply_url,
          atsType: r.source_attribution?.ats_name ?? 'generic',
          createdAt: r.created_at,
          match: r.match_score !== undefined && r.match_score !== null ? {
            score: Number(r.match_score),
            verdict: r.match_verdict,
          } : undefined,
        };
      }),
    });
  });

  // GET /api/jobs/:id - Detailed view for a single canonical job
  app.get<{ Params: { id: string }; Querystring: { candidateId?: string } }>(
    '/api/jobs/:id',
    async (req, reply) => {
      const [job] = await db`
        SELECT 
          j.*,
          c.name as company_name,
          (SELECT domain FROM discovery.company_domains cd WHERE cd.company_id = c.id LIMIT 1) as company_domain
        FROM jobs.jobs j
        JOIN discovery.companies c ON j.company_id = c.id
        WHERE j.id = ${req.params.id}
      `;

      if (!job) {
        return reply.code(404).send({ success: false, error: 'Job not found' });
      }

      // Fetch requirements if extracted
      const [reqs] = await db`
        SELECT * FROM jobs.job_requirements
        WHERE job_id = ${job.id}
      `;

      // If candidateId provided, fetch candidate match and match criteria breakdown
      let matchInfo = undefined;
      if (req.query.candidateId) {
        const [match] = await db`
          SELECT * FROM jobs.job_matches
          WHERE job_id = ${job.id} AND candidate_id = ${req.query.candidateId}
        `;

        if (match) {
          const criteria = await db`
            SELECT * FROM jobs.job_match_criteria
            WHERE match_id = ${match.id}
          `;

          matchInfo = {
            id: match.id,
            score: Number(match.score),
            verdict: match.verdict,
            criteria: criteria.map(c => ({
              id: c.id,
              criterion: c.criterion,
              result: c.result,
              evidence: c.evidence,
              factIds: c.fact_ids,
            })),
          };
        }
      }

      return reply.send({
        success: true,
        data: {
          id: job.id,
          title: job.title,
          companyName: job.company_name,
          companyDomain: job.company_domain,
          description: job.description,
          applyUrl: job.apply_url,
          status: job.status,
          roleFamily: job.role_family,
          seniority: job.seniority,
          location: job.location,
          salary: job.salary,
          experience: job.experience,
          sourceAttribution: job.source_attribution,
          firstSeenAt: job.first_seen_at,
          lastSeenAt: job.last_seen_at,
          requirements: reqs ? {
            id: reqs.id,
            requiredSkills: reqs.required_skills,
            preferredSkills: reqs.preferred_skills,
            minYearsExperience: reqs.min_years_experience,
            educationLevel: reqs.education_level,
          } : null,
          match: matchInfo,
        },
      });
    },
  );

  // GET /api/jobs/:id/matches - List all candidate matches for a job
  app.get<{ Params: { id: string } }>('/api/jobs/:id/matches', async (req, reply) => {
    const matches = await db`
      SELECT 
        jm.*,
        cp.full_name,
        cp.email
      FROM jobs.job_matches jm
      JOIN profile.candidate_profiles cp ON jm.candidate_id = cp.id
      WHERE jm.job_id = ${req.params.id}
      ORDER BY jm.score DESC
    `;

    return reply.send({
      success: true,
      data: matches.map(m => ({
        id: m.id,
        candidateId: m.candidate_id,
        candidateName: m.full_name,
        candidateEmail: m.email,
        score: Number(m.score),
        verdict: m.verdict,
        createdAt: m.created_at,
      })),
    });
  });

  // POST /api/jobs/sync-external - Search external aggregators (SerpApi Google Jobs or RapidAPI JSearch)
  app.post<{
    Body: {
      provider?: 'serpapi' | 'rapidapi' | 'all';
      query: string;
      location?: string;
      limit?: number;
      candidateId?: string;
    };
  }>('/api/jobs/sync-external', async (req, reply) => {
    const { provider = 'all', query, location = 'India', limit = 10, candidateId } = req.body || {};

    if (!query) {
      return reply.code(400).send({ success: false, error: 'query is required (e.g. "React Developer")' });
    }

    const dedup = new DeduplicationEngine();
    const reqService = new RequirementsService();
    const matchService = new MatchingService();

    const results: any[] = [];
    const externalJobs: Array<{
      title: string;
      company_name: string;
      location: string;
      description: string;
      apply_url: string;
      salary?: string;
      workplaceType: 'remote' | 'hybrid' | 'onsite';
      source: string;
    }> = [];

    // 1. SerpApi Google Jobs
    if (provider === 'serpapi' || provider === 'all') {
      const gRes = await searchGoogleJobs({ query, location, limit });
      if (gRes.success && gRes.jobs.length > 0) {
        externalJobs.push(...gRes.jobs.map(j => ({ ...j, source: 'google_jobs_serpapi' })));
      }
    }

    // 2. RapidAPI JSearch
    if (provider === 'rapidapi' || provider === 'all') {
      const rRes = await searchRapidJobs({ query, location, limit });
      if (rRes.success && rRes.jobs.length > 0) {
        externalJobs.push(...rRes.jobs.map(j => ({ ...j, source: 'jsearch_rapidapi' })));
      }
    }

    if (externalJobs.length === 0) {
      const missingKeys: string[] = [];
      if (!process.env.SERPAPI_API_KEY) missingKeys.push('SERPAPI_API_KEY');
      if (!process.env.RAPIDAPI_KEY) missingKeys.push('RAPIDAPI_KEY');
      return reply.send({
        success: false,
        message: 'No external jobs fetched. Please verify API keys in .env: ' + (missingKeys.join(', ') || 'No results for search query'),
        data: [],
      });
    }

    // 3. Process each job into canonical storage
    let insertedCount = 0;
    for (const item of externalJobs) {
      try {
        let [comp] = await db`SELECT id FROM discovery.companies WHERE name ILIKE ${item.company_name} LIMIT 1`;
        if (!comp) {
          [comp] = await db`
            INSERT INTO discovery.companies (name)
            VALUES (${item.company_name})
            RETURNING id
          `;
        }

        const externalId = `ext-${item.source}-${comp.id}-${item.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const rawPosting = {
          sourceId: undefined,
          companyId: comp.id,
          externalId,
          sourceUrl: item.apply_url,
          title: item.title,
          description: item.description,
          applyUrl: item.apply_url,
          location: {
            city: location,
            country: 'India',
            workplaceType: item.workplaceType,
          },
          payload: {
            company: item.company_name,
            salary: item.salary,
            source: item.source,
          },
        };

        const canonical = await dedup.processJob(rawPosting);

        await db`
          UPDATE jobs.jobs
          SET is_synthetic = false,
              status = 'ACTIVE',
              salary = ${item.salary || 'Competitive'},
              apply_url = ${item.apply_url},
              source_attribution = ${db.json({ source: item.source, verified: true })},
              location = ${db.json({
                city: location,
                country: 'India',
                workplaceType: item.workplaceType,
              })}
          WHERE id = ${canonical.canonicalJobId}
        `;

        await reqService.processJobRequirements(canonical.canonicalJobId, item.description || item.title);

        if (candidateId) {
          await matchService.matchJob(canonical.canonicalJobId, candidateId);
        }

        insertedCount++;
        results.push({ id: canonical.canonicalJobId, title: item.title, company: item.company_name });
      } catch (err: any) {
        // continue with next item
      }
    }

    return reply.send({
      success: true,
      data: {
        syncedCount: insertedCount,
        jobs: results,
      },
    });
  });
}

import type { FastifyInstance } from 'fastify';
import { sql } from '../../db/index.js';

const db = sql!;

export async function analyticsRoutes(app: FastifyInstance) {
  // GET /api/analytics/funnel - Funnel metrics for dashboard and engineering console
  app.get('/api/analytics/funnel', async (_req, reply) => {
    const [rawStats] = await db`SELECT count(*) as total_postings FROM ingest.raw_postings`;
    const [jobStats] = await db`SELECT count(*) as total_canonical FROM jobs.jobs`;
    const [matchStats] = await db`SELECT count(*) as total_matches FROM jobs.job_matches`;
    const [pendingStats] = await db`SELECT count(*) as pending_count FROM apply.applications WHERE status = 'PENDING_APPROVAL'`;

    return reply.send({
      success: true,
      data: {
        discoveredCount: Number(rawStats?.total_postings || 0),
        canonicalCount: Number(jobStats?.total_canonical || 0),
        matchedCount: Number(matchStats?.total_matches || 0),
        pendingApprovalCount: Number(pendingStats?.pending_count || 0),
      },
    });
  });

  // GET /api/analytics/metrics - Comprehensive funnel analytics and quota limits
  app.get('/api/analytics/metrics', async (_req, reply) => {
    // 1. Raw postings discovered
    const [rawStats] = await db`
      SELECT count(*) as total_postings FROM ingest.raw_postings
    `;

    // 2. Canonical jobs
    const [jobStats] = await db`
      SELECT 
        count(*) as total_canonical,
        count(*) FILTER (WHERE status = 'ACTIVE') as active_canonical
      FROM jobs.jobs
    `;

    // 3. Matched opportunities
    const [matchStats] = await db`
      SELECT 
        count(*) as total_matches,
        count(*) FILTER (WHERE score >= 0.70) as strong_matches
      FROM jobs.job_matches
    `;

    // 4. Applications breakdown by status
    const appStatusRows = await db`
      SELECT 
        status, 
        count(*) as count 
      FROM apply.applications 
      GROUP BY status
    `;

    const appStatusMap: Record<string, number> = {
      DRAFT: 0,
      PREPARED: 0,
      PENDING_APPROVAL: 0,
      PAUSED: 0,
      APPROVED: 0,
      SUBMITTED: 0,
      CANCELLED: 0,
      UNCONFIRMED: 0,
    };

    let totalApplications = 0;
    for (const row of appStatusRows) {
      const c = Number(row.count);
      appStatusMap[row.status] = c;
      totalApplications += c;
    }

    // 5. Daily Application Budget Tracker ($0 Safety Quota: max 15 submissions per day)
    const TARGET_MAX_DAILY = 15;
    const [dailySubmissions] = await db`
      SELECT count(*) as today_count
      FROM apply.application_runs
      WHERE status = 'SUBMITTED' 
        AND (submitted_at >= CURRENT_DATE OR (submitted_at IS NULL AND created_at >= CURRENT_DATE))
    `;

    const submittedToday = Number(dailySubmissions?.today_count || 0);
    const remainingDailyAllowance = Math.max(0, TARGET_MAX_DAILY - submittedToday);

    // 6. ATS Distribution
    const atsDistributionRows = await db`
      SELECT 
        COALESCE(source_attribution->>'ats_name', 'Generic') as ats_name,
        count(*) as count
      FROM jobs.jobs
      GROUP BY ats_name
      ORDER BY count DESC
    `;

    const atsDistribution: Record<string, number> = {};
    for (const row of atsDistributionRows) {
      atsDistribution[row.ats_name] = Number(row.count);
    }

    // 7. Crawler & Domain Health
    const [sourceCount] = await db`
      SELECT 
        count(*) as total_sources,
        count(*) FILTER (WHERE (compliance_status->>'allowed')::boolean = true) as healthy_sources
      FROM ingest.job_sources
    `;

    return reply.send({
      success: true,
      data: {
        totalDiscoveredPostings: Number(rawStats?.total_postings || 0),
        totalCanonicalJobs: Number(jobStats?.total_canonical || 0),
        activeCanonicalJobs: Number(jobStats?.active_canonical || 0),
        totalMatchedOpportunities: Number(matchStats?.total_matches || 0),
        strongMatchedOpportunities: Number(matchStats?.strong_matches || 0),
        applications: {
          total: totalApplications,
          draft: appStatusMap['DRAFT'] || 0,
          prepared: appStatusMap['PREPARED'] || 0,
          pendingApproval: appStatusMap['PENDING_APPROVAL'] || 0,
          paused: appStatusMap['PAUSED'] || 0,
          approved: appStatusMap['APPROVED'] || 0,
          submitted: appStatusMap['SUBMITTED'] || 0,
          cancelled: appStatusMap['CANCELLED'] || 0,
          unconfirmed: appStatusMap['UNCONFIRMED'] || 0,
        },
        dailyBudget: {
          targetMaxDailyApplications: TARGET_MAX_DAILY,
          applicationsSubmittedToday: submittedToday,
          remainingDailyAllowance,
          isBudgetExceeded: submittedToday >= TARGET_MAX_DAILY,
        },
        atsDistribution,
        crawlerHealth: {
          totalSources: Number(sourceCount?.total_sources || 0),
          healthySources: Number(sourceCount?.healthy_sources || 0),
        },
      },
    });
  });
}

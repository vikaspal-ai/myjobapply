/**
 * Purge Synthetic / Test Job Fixtures
 *
 * The integration tests write fixtures directly into the shared cloud Postgres
 * database (they do not use a throwaway test schema). Fixtures are named with a
 * `Date.now()` suffix (e.g. `Company WF 1790436699214`), which makes them
 * detectable, but they are inserted with `is_synthetic = false` (the column
 * default) so they leak into the live jobs feed.
 *
 * This module detects those fixtures and removes them in FK-safe order so the
 * feed only ever shows genuine postings.
 *
 * Usage:
 *   - Programmatically: `await purgeTestFixtures({ commit: true })`
 *   - CLI: `npm run db:purge-fixtures -- --apply`
 */

import type postgres from 'postgres';

/**
 * SQL predicate identifying a test-fixture company.
 *
 * A company is treated as a fixture when it either:
 *   1. ends with a 13-digit epoch-millis suffix (every `... ${Date.now()}` fixture), or
 *   2. starts with `Test Company` (the API integration test naming style).
 *
 * Real postings that come from the verified seeders (Databricks, MongoDB,
 * Airbnb, Samsara, GitLab, Cloudflare, Razorpay, ...) never match this.
 */
export const TEST_COMPANY_PREDICATE = `(
    c.name ~ '[0-9]{13}[[:space:]]*$'
    OR c.name ILIKE 'Test Company%'
  )`;

/** Ordered, FK-safe delete plan for fixture companies/jobs. Each entry is [label, SQL]. */
export function buildCompanyFixtureDeletePlan(): Array<[string, string]> {
  const companies = `SELECT id FROM discovery.companies c WHERE ${TEST_COMPANY_PREDICATE}`;
  const jobs = `SELECT id FROM jobs.jobs WHERE company_id IN (${companies})`;
  const sources = `SELECT id FROM ingest.job_sources WHERE company_id IN (${companies})`;
  const careerPages = `SELECT id FROM discovery.career_pages WHERE company_id IN (${companies})`;

  return [
    // --- Dependents of the fixture jobs ---
    ['apply.application_runs', `DELETE FROM apply.application_runs WHERE application_id IN (SELECT id FROM apply.applications WHERE job_id IN (${jobs}))`],
    ['apply.applications', `DELETE FROM apply.applications WHERE job_id IN (${jobs})`],
    ['outreach.threads', `DELETE FROM outreach.threads WHERE message_id IN (SELECT id FROM outreach.messages WHERE job_id IN (${jobs}) OR company_id IN (${companies}))`],
    ['outreach.messages (by job)', `DELETE FROM outreach.messages WHERE job_id IN (${jobs})`],
    ['outreach.messages (by company)', `DELETE FROM outreach.messages WHERE company_id IN (${companies})`],
    // Self-referencing version chains: children first to satisfy ON DELETE RESTRICT.
    ['docs.cover_letter_versions (children)', `DELETE FROM docs.cover_letter_versions WHERE parent_version_id IS NOT NULL AND job_id IN (${jobs})`],
    ['docs.cover_letter_versions', `DELETE FROM docs.cover_letter_versions WHERE job_id IN (${jobs})`],
    ['docs.resume_versions (children)', `DELETE FROM docs.resume_versions WHERE parent_version_id IS NOT NULL AND job_id IN (${jobs})`],
    ['docs.resume_versions', `DELETE FROM docs.resume_versions WHERE job_id IN (${jobs})`],
    ['jobs.job_match_criteria', `DELETE FROM jobs.job_match_criteria WHERE match_id IN (SELECT id FROM jobs.job_matches WHERE job_id IN (${jobs}))`],
    ['jobs.job_matches', `DELETE FROM jobs.job_matches WHERE job_id IN (${jobs})`],
    ['jobs.job_requirements', `DELETE FROM jobs.job_requirements WHERE job_id IN (${jobs})`],
    ['jobs.job_embeddings', `DELETE FROM jobs.job_embeddings WHERE job_id IN (${jobs})`],
    ['jobs.job_source_links', `DELETE FROM jobs.job_source_links WHERE job_id IN (${jobs})`],
    ['jobs.jobs', `DELETE FROM jobs.jobs WHERE company_id IN (${companies})`],

    // --- Fixture companies themselves ---
    ['outreach.company_contacts', `DELETE FROM outreach.company_contacts WHERE company_id IN (${companies})`],
    ['sched.schedules', `DELETE FROM sched.schedules WHERE company_id IN (${companies})`],
    ['ingest.raw_postings', `DELETE FROM ingest.raw_postings WHERE source_id IN (${sources})`],
    ['ingest.crawl_runs', `DELETE FROM ingest.crawl_runs WHERE job_source_id IN (${sources})`],
    ['ingest.job_sources', `DELETE FROM ingest.job_sources WHERE company_id IN (${companies})`],
    ['discovery.ats_fingerprints', `DELETE FROM discovery.ats_fingerprints WHERE career_page_id IN (${careerPages})`],
    ['discovery.site_profiles', `DELETE FROM discovery.site_profiles WHERE career_page_id IN (${careerPages})`],
    ['discovery.career_pages (children)', `DELETE FROM discovery.career_pages WHERE parent_page_id IS NOT NULL AND company_id IN (${companies})`],
    ['discovery.career_pages', `DELETE FROM discovery.career_pages WHERE company_id IN (${companies})`],
    ['discovery.company_domains', `DELETE FROM discovery.company_domains WHERE company_id IN (${companies})`],
    ['discovery.companies', `DELETE FROM discovery.companies WHERE id IN (${companies})`],
  ];
}

export interface PurgeResult {
  dryRun: boolean;
  fixturesFound: number;
  deleted: Array<{ table: string; rows: number }>;
  totalDeleted: number;
}

/** Executes an ordered delete plan inside an existing transaction, reporting row counts. */
export async function runDeletePlan(
  tx: any,
  plan: Array<[string, string]>,
  deleted: Array<{ table: string; rows: number }>
): Promise<number> {
  let total = 0;
  for (const [table, statement] of plan) {
    const res: any = await tx.unsafe(statement);
    const rows = Number(res.count ?? 0);
    deleted.push({ table, rows });
    total += rows;
  }
  return total;
}

/** Lists the test-fixture companies currently present in the database. */
export async function listTestFixtures(db: postgres.Sql) {
  return db.unsafe(`
    SELECT c.name, c.id, count(j.id)::int AS jobs
    FROM discovery.companies c
    LEFT JOIN jobs.jobs j ON j.company_id = c.id
    WHERE ${TEST_COMPANY_PREDICATE}
    GROUP BY c.name, c.id
    ORDER BY c.name
  `) as unknown as Promise<Array<{ name: string; id: string; jobs: number }>>;
}

/**
 * Deletes every detected test fixture (jobs, companies and all rows that
 * reference them) in FK-safe order, inside a single transaction.
 *
 * @param options.commit - `true` executes the deletes, `false` reports only.
 * @param options.db     - Postgres client (defaults to the shared `sql` pool).
 */
export async function purgeTestFixtures(
  options: { commit?: boolean; db?: postgres.Sql } = {}
): Promise<PurgeResult> {
  const commit = options.commit ?? false;
  const db = options.db ?? (await import('../db/index.js')).sql;

  if (!db) {
    throw new Error('Database is not configured (check DATABASE_URL in .env)');
  }

  const fixtures = await listTestFixtures(db);
  const deleted: Array<{ table: string; rows: number }> = [];

  if (!commit) {
    return { dryRun: true, fixturesFound: fixtures.length, deleted, totalDeleted: 0 };
  }

  const plan = buildCompanyFixtureDeletePlan();
  await db.begin(async (tx) => {
    await runDeletePlan(tx, plan, deleted);
  });

  const totalDeleted = deleted.reduce((sum, d) => sum + d.rows, 0);
  return { dryRun: false, fixturesFound: fixtures.length, deleted, totalDeleted };
}

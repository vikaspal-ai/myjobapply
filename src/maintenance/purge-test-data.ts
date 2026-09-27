/**
 * Purge ALL Test Data
 *
 * This project's vitest suite and manual UI testing write directly into the
 * shared cloud Postgres database. Over time that leaves behind:
 *
 *   • ~350 throwaway candidate profiles (`*@example.com`)
 *   • fixture companies/jobs (`Company WF 1790436699214`, `Clearance Engineer`, ...)
 *   • orphan company stubs created by failed/partial sync runs
 *   • internal plumbing residue (outbox events, notifications, dead letters)
 *   • orphaned document artifacts
 *
 * This module removes all of it inside a single transaction.
 *
 * SAFETY: anything that looks like a real account is preserved.
 *   - A candidate is only removed when its email is a reserved test domain
 *     (`@example.com`). Real logins (e.g. Supabase `auth.users` accounts such as
 *     `vikas.pal@strategicerp.com`) are never matched.
 *   - Demo seed users (`@demo.jobsapply`) are kept unless `includeDemo` is set.
 *   - Companies are only removed when they are recognised fixtures, or when they
 *     are completely empty stubs (no jobs, no domains, no sources).
 *
 * Usage:
 *   Programmatic: await purgeAllTestData({ commit: true })
 *   CLI:          npm run db:purge-test-data -- --apply
 */

import type postgres from 'postgres';
import {
  TEST_COMPANY_PREDICATE,
  buildCompanyFixtureDeletePlan,
  runDeletePlan,
} from '../jobs/purge-fixtures.js';

/** Candidates created by tests / manual UI churn use the reserved `@example.com` domain. */
export const TEST_CANDIDATE_PREDICATE = `email ILIKE '%@example.com'`;

/** Demo seed users (created by `npm run seed:demo`) — kept unless explicitly purged. */
export const DEMO_CANDIDATE_PREDICATE = `is_demo = true`;

function candidateIds(includeDemo: boolean) {
  const predicate = includeDemo
    ? `(${TEST_CANDIDATE_PREDICATE} OR ${DEMO_CANDIDATE_PREDICATE})`
    : `(${TEST_CANDIDATE_PREDICATE})`;
  return `SELECT id FROM profile.candidate_profiles WHERE ${predicate}`;
}

function candidateIdsText(includeDemo: boolean) {
  return `SELECT id::text FROM profile.candidate_profiles WHERE ${
    includeDemo ? `(${TEST_CANDIDATE_PREDICATE} OR ${DEMO_CANDIDATE_PREDICATE})` : `(${TEST_CANDIDATE_PREDICATE})`
  }`;
}

/**
 * Internal plumbing residue (notifications, dead letters, outbox/processed events)
 * that references test entities. Runs BEFORE the entity deletes so the predicates
 * can still resolve.
 */
function buildResidueDeletePlan(includeDemo: boolean, includeEvents: boolean): Array<[string, string]> {
  if (!includeEvents) return [];

  const candsText = candidateIdsText(includeDemo);
  const companies = `SELECT id FROM discovery.companies c WHERE ${TEST_COMPANY_PREDICATE}`;
  const jobs = `SELECT id FROM jobs.jobs WHERE company_id IN (${companies})`;

  return [
    ['platform.notifications', `DELETE FROM platform.notifications
       WHERE (payload->>'candidateId') IN (${candsText})
          OR (payload->>'jobId') IN (${jobs})`],
    ['platform.dead_letters', `DELETE FROM platform.dead_letters`],
    ['platform.processed_events', `DELETE FROM platform.processed_events
       WHERE event_id IN (
         SELECT id FROM platform.outbox_events e
         WHERE (e.entity_refs->>'candidateId') IN (${candsText})
            OR (e.entity_refs->>'jobId') IN (${jobs})
            OR (e.entity_refs->>'companyId') IN (${companies})
       )`],
    ['platform.outbox_events', `DELETE FROM platform.outbox_events e
       WHERE (e.entity_refs->>'candidateId') IN (${candsText})
          OR (e.entity_refs->>'jobId') IN (${jobs})
          OR (e.entity_refs->>'companyId') IN (${companies})`],
  ];
}

/**
 * Everything owned by a test candidate, in FK-safe order.
 * `outreach.messages` and `apply.applications` reference document versions, so they
 * are removed before those versions.
 */
function buildCandidateDeletePlan(includeDemo: boolean): Array<[string, string]> {
  const cands = candidateIds(includeDemo);
  const resumes = `SELECT id FROM docs.resumes WHERE candidate_id IN (${cands})`;
  const coverLetters = `SELECT id FROM docs.cover_letters WHERE candidate_id IN (${cands})`;
  const facts = `SELECT id FROM profile.candidate_facts WHERE candidate_id IN (${cands})`;

  return [
    ['outreach.threads', `DELETE FROM outreach.threads
       WHERE message_id IN (SELECT id FROM outreach.messages WHERE candidate_id IN (${cands}))`],
    ['outreach.messages', `DELETE FROM outreach.messages WHERE candidate_id IN (${cands})`],
    ['apply.application_runs', `DELETE FROM apply.application_runs
       WHERE application_id IN (SELECT id FROM apply.applications WHERE candidate_id IN (${cands}))`],
    ['apply.applications', `DELETE FROM apply.applications WHERE candidate_id IN (${cands})`],
    ['apply.candidate_answers', `DELETE FROM apply.candidate_answers WHERE candidate_id IN (${cands})`],
    ['jobs.job_match_criteria', `DELETE FROM jobs.job_match_criteria
       WHERE match_id IN (SELECT id FROM jobs.job_matches WHERE candidate_id IN (${cands}))`],
    ['jobs.job_matches', `DELETE FROM jobs.job_matches WHERE candidate_id IN (${cands})`],
    ['docs.cover_letter_versions (children)', `DELETE FROM docs.cover_letter_versions
       WHERE parent_version_id IS NOT NULL AND cover_letter_id IN (${coverLetters})`],
    ['docs.cover_letter_versions', `DELETE FROM docs.cover_letter_versions WHERE cover_letter_id IN (${coverLetters})`],
    ['docs.cover_letters', `DELETE FROM docs.cover_letters WHERE candidate_id IN (${cands})`],
    ['docs.resume_versions (children)', `DELETE FROM docs.resume_versions
       WHERE parent_version_id IS NOT NULL AND resume_id IN (${resumes})`],
    ['docs.resume_versions', `DELETE FROM docs.resume_versions WHERE resume_id IN (${resumes})`],
    ['docs.resumes', `DELETE FROM docs.resumes WHERE candidate_id IN (${cands})`],
    ['profile.fact_embeddings', `DELETE FROM profile.fact_embeddings WHERE fact_id IN (${facts})`],
    ['profile.candidate_facts', `DELETE FROM profile.candidate_facts WHERE candidate_id IN (${cands})`],
    ['profile.candidate_profiles', `DELETE FROM profile.candidate_profiles WHERE id IN (${cands})`],
  ];
}

/**
 * Leftovers that only become orphans once the entities above are gone.
 * NOTE: the artifacts delete must run AFTER the version deletes.
 */
function buildOrphanDeletePlan(): Array<[string, string]> {
  return [
    ['outreach.suppression_list', `DELETE FROM outreach.suppression_list WHERE email ILIKE '%@example.com'`],
    ['discovery.companies (empty stubs)', `DELETE FROM discovery.companies c
       WHERE NOT EXISTS (SELECT 1 FROM jobs.jobs j WHERE j.company_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM discovery.company_domains d WHERE d.company_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM ingest.job_sources s WHERE s.company_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM discovery.career_pages p WHERE p.company_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM outreach.messages m WHERE m.company_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM outreach.company_contacts cc WHERE cc.company_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM sched.schedules sc WHERE sc.company_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM ingest.raw_postings rp WHERE rp.source_id IN (
               SELECT id FROM ingest.job_sources WHERE company_id = c.id))`],
    ['docs.artifacts (orphans)', `DELETE FROM docs.artifacts a
       WHERE NOT EXISTS (SELECT 1 FROM docs.resume_versions rv WHERE rv.artifact_id = a.id)
         AND NOT EXISTS (SELECT 1 FROM docs.cover_letter_versions clv WHERE clv.artifact_id = a.id)`],
  ];
}

export interface PurgeTestDataOptions {
  /** `true` executes the deletes, `false` (default) reports only. */
  commit?: boolean;
  /** Also remove demo seed users (`@demo.jobsapply`). Default false. */
  includeDemo?: boolean;
  /** Also remove internal plumbing residue (outbox/processed events, notifications, dead letters). Default true. */
  includeEvents?: boolean;
  /** Postgres client (defaults to the shared `sql` pool). */
  db?: postgres.Sql;
}

export interface PurgeTestDataResult {
  dryRun: boolean;
  summary: Record<string, number>;
  deleted: Array<{ table: string; rows: number }>;
  totalDeleted: number;
  preserved: Array<{ full_name: string; email: string }>;
}

/** Counts of everything that would be removed (used for the dry-run report). */
export async function previewTestData(db: postgres.Sql, includeDemo = false) {
  const candPredicate = includeDemo
    ? `(${TEST_CANDIDATE_PREDICATE} OR ${DEMO_CANDIDATE_PREDICATE})`
    : `(${TEST_CANDIDATE_PREDICATE})`;

  const [row] = (await db.unsafe(`
    SELECT
      (SELECT count(*) FROM profile.candidate_profiles WHERE ${candPredicate})::int AS test_candidates,
      (SELECT count(*) FROM profile.candidate_facts WHERE candidate_id IN (SELECT id FROM profile.candidate_profiles WHERE ${candPredicate}))::int AS candidate_facts,
      (SELECT count(*) FROM docs.resumes WHERE candidate_id IN (SELECT id FROM profile.candidate_profiles WHERE ${candPredicate}))::int AS resumes,
      (SELECT count(*) FROM docs.cover_letters WHERE candidate_id IN (SELECT id FROM profile.candidate_profiles WHERE ${candPredicate}))::int AS cover_letters,
      (SELECT count(*) FROM apply.candidate_answers WHERE candidate_id IN (SELECT id FROM profile.candidate_profiles WHERE ${candPredicate}))::int AS candidate_answers,
      (SELECT count(*) FROM jobs.job_matches WHERE candidate_id IN (SELECT id FROM profile.candidate_profiles WHERE ${candPredicate}))::int AS job_matches,
      (SELECT count(*) FROM platform.outbox_events)::int AS outbox_events,
      (SELECT count(*) FROM platform.notifications)::int AS notifications,
      (SELECT count(*) FROM platform.dead_letters)::int AS dead_letters,
      (SELECT count(*) FROM outreach.suppression_list WHERE email ILIKE '%@example.com')::int AS suppression_rows,
      (SELECT count(*) FROM docs.artifacts)::int AS artifacts,
      (SELECT count(*) FROM discovery.companies c WHERE ${TEST_COMPANY_PREDICATE})::int AS fixture_companies
  `)) as any[];

  const emptyStubs = await db.unsafe(`
    SELECT count(*)::int AS n FROM discovery.companies c
    WHERE NOT EXISTS (SELECT 1 FROM jobs.jobs j WHERE j.company_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM discovery.company_domains d WHERE d.company_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM ingest.job_sources s WHERE s.company_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM discovery.career_pages p WHERE p.company_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM outreach.messages m WHERE m.company_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM outreach.company_contacts cc WHERE cc.company_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM sched.schedules sc WHERE sc.company_id = c.id)
  `) as any[];

  const preserved = await db.unsafe(`
    SELECT full_name, email FROM profile.candidate_profiles
    WHERE NOT ${candPredicate}
    ORDER BY created_at
  `) as any[];

  return { ...row, empty_company_stubs: emptyStubs[0].n, preserved };
}


/**
 * Removes every piece of test data from the database inside a single transaction.
 *
 * Order matters:
 *   1. plumbing residue (needs the entity predicates to still resolve)
 *   2. test candidates + everything they own
 *   3. fixture companies/jobs
 *   4. orphan companies / artifacts / suppression rows left behind
 */
export async function purgeAllTestData(
  options: PurgeTestDataOptions = {}
): Promise<PurgeTestDataResult> {
  const commit = options.commit ?? false;
  const includeDemo = options.includeDemo ?? false;
  const includeEvents = options.includeEvents ?? true;
  const db = options.db ?? (await import('../db/index.js')).sql;

  if (!db) {
    throw new Error('Database is not configured (check DATABASE_URL in .env)');
  }

  const preview = await previewTestData(db, includeDemo);
  const { preserved, ...summary } = preview;

  if (!commit) {
    return { dryRun: true, summary, deleted: [], totalDeleted: 0, preserved };
  }

  const deleted: Array<{ table: string; rows: number }> = [];
  const plan: Array<[string, string]> = [
    ...buildResidueDeletePlan(includeDemo, includeEvents),
    ...buildCandidateDeletePlan(includeDemo),
    ...buildCompanyFixtureDeletePlan(),
  ];

  await db.begin(async (tx) => {
    await runDeletePlan(tx, plan, deleted);
    // Orphans only exist once the parents above are gone, so they run last but
    // still inside the same transaction.
    await runDeletePlan(tx, buildOrphanDeletePlan(), deleted);
  });

  const totalDeleted = deleted.reduce((sum, d) => sum + d.rows, 0);
  return { dryRun: false, summary, deleted, totalDeleted, preserved };
}


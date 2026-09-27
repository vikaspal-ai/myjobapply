/**
 * SCRIPT: Purge Synthetic / Test Job Fixtures
 *
 * The vitest integration suite writes fixtures straight into the shared cloud
 * Postgres database using `Date.now()` suffixed company names
 * (e.g. `Company WF 1790436699214` / `Clearance Engineer`). Because those rows
 * are inserted with `is_synthetic = false`, they leak into the live jobs feed.
 *
 * This script detects and removes them (jobs, companies and all dependent rows)
 * in FK-safe order.
 *
 * Usage:
 *   npx tsx src/scripts/purge-synthetic-jobs.ts           # dry run (report only)
 *   npx tsx src/scripts/purge-synthetic-jobs.ts --apply   # actually delete
 */

import { sql } from '../db/index.js';
import { purgeTestFixtures, listTestFixtures } from '../jobs/purge-fixtures.js';

async function main() {
  if (!sql) {
    console.error('❌ Database not configured. Check DATABASE_URL in .env');
    process.exit(1);
  }

  const apply = process.argv.includes('--apply');

  const fixtures = await listTestFixtures(sql);
  if (fixtures.length === 0) {
    console.log('✅ No synthetic test fixtures found. Feed is clean.');
    await sql.end();
    return;
  }

  console.log(`🔎 Found ${fixtures.length} synthetic fixture company(ies):\n`);
  for (const f of fixtures) {
    console.log(`   • ${f.name}  (${f.jobs} job${f.jobs === 1 ? '' : 's'})`);
  }

  if (!apply) {
    console.log('\nℹ️  Dry run only. Re-run with --apply to delete these fixtures.');
    await sql.end();
    return;
  }

  const result = await purgeTestFixtures({ commit: true, db: sql });

  console.log('\n🧹 Deleted rows:');
  for (const row of result.deleted) {
    if (row.rows > 0) console.log(`   ${String(row.rows).padStart(4)}  ${row.table}`);
  }
  console.log(`\n🎉 Removed ${result.fixturesFound} fixture companies (${result.totalDeleted} rows total).`);

  await sql.end();
}

main().catch(async (err) => {
  console.error('❌ Purge failed:', err);
  process.exit(1);
});

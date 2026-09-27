/**
 * SCRIPT: Purge ALL Test Data
 *
 * Removes every trace of test/manual-testing data from the shared cloud database:
 * throwaway candidate profiles (`*@example.com`), fixture companies/jobs
 * (`Company WF 1790436699214`, `Clearance Engineer`, ...), orphan company stubs,
 * orphaned document artifacts, suppression rows and internal plumbing residue.
 *
 * Real accounts are never touched:
 *   - Your authenticated profile (`vikas.pal@strategicerp.com`) is preserved.
 *   - Demo seed users (`@demo.jobsapply`) are preserved unless `--include-demo`.
 *
 * Usage:
 *   npx tsx src/scripts/purge-test-data.ts                    # dry run (report only)
 *   npx tsx src/scripts/purge-test-data.ts --apply            # delete
 *   npx tsx src/scripts/purge-test-data.ts --apply --include-demo
 *   npx tsx src/scripts/purge-test-data.ts --apply --no-events   # keep outbox/notification history
 */

import { sql } from '../db/index.js';
import { purgeAllTestData, previewTestData } from '../maintenance/purge-test-data.js';

async function main() {
  if (!sql) {
    console.error('❌ Database not configured. Check DATABASE_URL in .env');
    process.exit(1);
  }

  const apply = process.argv.includes('--apply');
  const includeDemo = process.argv.includes('--include-demo');
  const includeEvents = !process.argv.includes('--no-events');

  const preview = await previewTestData(sql, includeDemo);

  console.log('🔎 Test-data inventory\n');
  for (const [k, v] of Object.entries(preview)) {
    if (k === 'preserved') continue;
    console.log(`   ${String(v).padStart(6)}  ${k}`);
  }

  console.log('\n🛡️  Profiles that will be PRESERVED:');
  for (const p of preview.preserved) {
    console.log(`   • ${p.full_name} <${p.email}>`);
  }

  if (!apply) {
    console.log('\nℹ️  Dry run only. Re-run with --apply to delete the test data above.');
    console.log('    Flags: --include-demo (also remove demo users), --no-events (keep outbox/notification history)');
    await sql.end();
    return;
  }

  const result = await purgeAllTestData({ commit: true, includeDemo, includeEvents, db: sql });

  console.log('\n🧹 Deleted rows:');
  for (const row of result.deleted) {
    if (row.rows > 0) console.log(`   ${String(row.rows).padStart(6)}  ${row.table}`);
  }
  console.log(`\n🎉 Purge complete — ${result.totalDeleted} rows removed.`);

  console.log('\n🛡️  Still preserved:');
  for (const p of result.preserved) {
    console.log(`   • ${p.full_name} <${p.email}>`);
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error('❌ Purge failed:', err);
  process.exit(1);
});

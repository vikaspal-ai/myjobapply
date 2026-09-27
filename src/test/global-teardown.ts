/**
 * Vitest global setup / teardown.
 *
 * The integration suite runs against the shared cloud Postgres database, so any
 * fixtures it creates (companies named `<Name> ${Date.now()}`, their jobs,
 * matches, applications, ...) would otherwise leak into the live jobs feed.
 *
 * Vitest runs the returned function once, after every test file has finished.
 */
import { sql } from '../db/index.js';
import { purgeTestFixtures } from '../jobs/purge-fixtures.js';

export default async function globalSetup() {
  return async () => {
    if (!sql) return;
    try {
      const result = await purgeTestFixtures({ commit: true, db: sql });
      if (result.fixturesFound > 0) {
        console.log(
          `\n🧹 Test teardown: removed ${result.fixturesFound} synthetic fixture company(ies) (${result.totalDeleted} rows).`
        );
      }
      await sql.end();
    } catch (err) {
      console.warn('⚠️  Test teardown: failed to purge synthetic fixtures:', err);
    }
  };
}

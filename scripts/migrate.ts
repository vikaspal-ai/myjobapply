import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { sql } from '../src/db/index.js';

async function main() {
  if (!sql) {
    console.error('Database connection not available');
    process.exit(1);
  }

  // 1. Ensure migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS platform.schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `;

  // Seed prior applied migrations if not already present
  await sql`
    INSERT INTO platform.schema_migrations (name)
    VALUES ('001_initial_schema.sql'), ('002_docs_schema.sql')
    ON CONFLICT (name) DO NOTHING
  `;

  const appliedRows = await sql<{ name: string }[]>`
    SELECT name FROM platform.schema_migrations
  `;
  const appliedSet = new Set(appliedRows.map((r) => r.name));

  const migrationsDir = resolve('./migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`⏭️  Skipping already applied migration: ${file}`);
      continue;
    }

    const filePath = resolve(migrationsDir, file);
    console.log(`\nExecuting migration: ${file}...`);
    const ddl = readFileSync(filePath, 'utf-8');

    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`
        INSERT INTO platform.schema_migrations (name)
        VALUES (${file})
      `;
    });

    console.log(`✅ ${file} applied successfully.`);
  }

  const tables = await sql<{ table_schema: string; table_name: string }[]>`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema IN ('platform', 'discovery', 'ingest', 'sched', 'profile', 'jobs', 'docs', 'apply')
    ORDER BY table_schema, table_name;
  `;

  console.log(`\nVerified Database Tables (${tables.length} tables total):`);
  for (const t of tables) {
    console.log(` • ${t.table_schema}.${t.table_name}`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

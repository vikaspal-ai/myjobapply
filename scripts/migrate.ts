import { readFileSync } from 'fs';
import { resolve } from 'path';
import { sql } from '../src/db/index.js';

async function main() {
  if (!sql) {
    console.error('Database connection not available');
    process.exit(1);
  }

  const migrationPath = resolve('./migrations/002_docs_schema.sql');
  console.log(`Reading migration: ${migrationPath}`);
  const ddl = readFileSync(migrationPath, 'utf-8');

  console.log('Executing 002_docs_schema.sql against Supabase...');
  await sql.unsafe(ddl);
  console.log('Migration executed successfully!');

  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'docs'
    ORDER BY table_name;
  `;

  console.log('Created tables in docs schema:');
  for (const t of tables) {
    console.log(` - docs.${t.table_name}`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

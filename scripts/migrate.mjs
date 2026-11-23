import pg from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) { console.error('DATABASE_URL is required'); process.exit(1); }
const client = new pg.Client({connectionString});
await client.connect();
try {
 await client.query('SELECT pg_advisory_lock(71803347)');
 await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
 for (const filename of (await readdir('migrations')).filter(x => /^\d+.*\.sql$/.test(x)).sort()) {
  const exists=await client.query('SELECT 1 FROM schema_migrations WHERE filename=$1',[filename]);
  if (exists.rowCount) continue;
  const sql=await readFile(join('migrations',filename),'utf8');
  await client.query('BEGIN');
  try { await client.query(sql); await client.query('INSERT INTO schema_migrations(filename) VALUES($1)',[filename]); await client.query('COMMIT'); }
  catch(e){await client.query('ROLLBACK');throw e;}
  console.log('Applied',filename);
 }
} finally { await client.query('SELECT pg_advisory_unlock(71803347)'); await client.end(); }

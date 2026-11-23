import { Pool } from 'pg';
const globalForDb = globalThis as typeof globalThis & { journalPool?: Pool };
export function db(): Pool {
  if (!globalForDb.journalPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
    globalForDb.journalPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return globalForDb.journalPool;
}

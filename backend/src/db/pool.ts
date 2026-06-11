import { Pool } from 'pg';

/**
 * PostgreSQL connection pool.
 * Connects using DATABASE_URL environment variable.
 * Falls back to null if DATABASE_URL is not set (in-memory mode for tests).
 */

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('[DB] DATABASE_URL not set — running in in-memory mode');
    return null;
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
  });

  console.log('[DB] PostgreSQL connection pool created');
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] PostgreSQL connection pool closed');
  }
}

/**
 * Test the database connection.
 */
export async function testConnection(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;

  try {
    const result = await p.query('SELECT NOW()');
    console.log('[DB] Connection test successful:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('[DB] Connection test failed:', (err as Error).message);
    return false;
  }
}

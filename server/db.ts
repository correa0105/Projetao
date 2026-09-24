import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL no arquivo .env.');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
pool.on('error', (error) => console.error('PostgreSQL pool:', error.message));
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

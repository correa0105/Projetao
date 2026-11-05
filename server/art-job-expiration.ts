import type { Pool, PoolClient } from 'pg';
import { pool } from './db.js';
import { ART_GENERATION_TIMEOUT_MESSAGE } from './art-generation-deadline.js';

export async function expireArtJobs(db: Pool | PoolClient = pool, userId?: string) {
  // No input, checkpoint or equipment is discarded. A retry explicitly requested
  // by the owner receives a new deadline; automatic retries keep the old one.
  await db.query(`UPDATE character_art_jobs SET status='failed',last_error_code='generation_deadline',
    next_attempt_at=NULL,completed_at=now(),error=$1
    WHERE status IN('queued','running') AND deadline_at<=clock_timestamp()
    AND ($2::text IS NULL OR user_id=$2)`, [ART_GENERATION_TIMEOUT_MESSAGE, userId ?? null]);
  await db.query(`UPDATE companion_art_jobs SET status='failed',completed_at=now(),error=$1
    WHERE status IN('queued','running') AND deadline_at<=clock_timestamp()
    AND ($2::text IS NULL OR user_id=$2)`, [ART_GENERATION_TIMEOUT_MESSAGE, userId ?? null]);
}

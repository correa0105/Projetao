import { z } from 'zod';
import { pool, transaction } from './db.js';
import { IllustratorError } from './codex-illustrator.js';
import { AppError } from './services.js';

// Review failures need another render, never a relaxed publication check.
// Invalid input and explicit refusals require a corrected request instead.
export function characterArtFailure(error: unknown) {
  const code = error instanceof IllustratorError ? error.code
    : error instanceof z.ZodError ? 'invalid_request'
    : error instanceof AppError ? 'image_validation' : 'internal';
  const retry = !(error instanceof z.ZodError) &&
    !(error instanceof AppError && error.status !== 400 && error.status < 500) &&
    !['content_refused', 'missing_reference', 'image_path', 'token_path', 'token_style'].includes(code);
  const message = error instanceof IllustratorError || error instanceof AppError
    ? error.message : 'Não foi possível finalizar a arte.';
  return { code, retry, message };
}

export async function retryCharacterArt(jobId: string, error: unknown) {
  const failure = characterArtFailure(error);
  // One conditional update makes repeated error handling idempotent. Retain every
  // input and approved checkpoint, including replacement/equipment requests.
  return (await pool.query(
    `UPDATE character_art_jobs SET status=$2, retry_count=retry_count+1,
      next_attempt_at=CASE WHEN $2='queued' THEN now()+make_interval(secs =>
        CASE WHEN $3='usage_limit' THEN 3600 WHEN $3='authentication' THEN 60
          ELSE LEAST(300,15*power(2,LEAST(retry_count,5)))::int END) ELSE NULL END,
      last_error_code=$3,error=$4,completed_at=NULL
      WHERE id=$1 AND status='running'
      RETURNING id,status,retry_count,next_attempt_at`,
    [jobId, failure.retry ? 'queued' : 'failed', failure.code,
      failure.retry
        ? 'O ilustrador vai continuar automaticamente. Seu progresso e sua cota estão preservados.'
        : `${failure.message} Sua cota foi preservada.`],
  )).rows[0];
}

// Called only after acquiring the exclusive worker lease. Historical failed or
// archived drafts stay untouched; only interrupted active requests are resumed.
export async function recoverInterruptedCharacterArt() {
  const jobs = (await pool.query("SELECT id FROM character_art_jobs WHERE status='running'")).rows;
  for (const job of jobs)
    await retryCharacterArt(job.id, new IllustratorError('interrupted', 'A geração foi interrompida.'));
}

export async function claimNextArtJob() {
  return transaction(async (client) => {
    // Delayed retries cannot block new characters or the companion queue.
    const candidate = (await client.query(
      `SELECT id,COALESCE(next_attempt_at,created_at) AS due_at,created_at,'character' AS queue_kind
       FROM character_art_jobs WHERE status='queued' AND COALESCE(next_attempt_at,created_at)<=now()
       UNION ALL SELECT id,created_at,created_at,'companion' FROM companion_art_jobs WHERE status='queued'
       ORDER BY due_at,created_at,id LIMIT 1`,
    )).rows[0];
    if (!candidate) return;
    if (candidate.queue_kind === 'companion') {
      const next = (await client.query(
        "SELECT * FROM companion_art_jobs WHERE id=$1 AND status='queued' FOR UPDATE SKIP LOCKED",
        [candidate.id],
      )).rows[0];
      if (next) await client.query("UPDATE companion_art_jobs SET status='running',started_at=now() WHERE id=$1", [next.id]);
      return next ? { ...next, queue_kind: 'companion' } : undefined;
    }
    const next = (await client.query(
      `SELECT j.*,COALESCE(c.race,j.creation->>'race') AS race,COALESCE(c.class,j.creation->>'class') AS class,
       COALESCE(s.choices,j.creation->'choices') AS choices FROM character_art_jobs j
       LEFT JOIN characters c ON c.id=j.character_id LEFT JOIN character_sheets s ON s.character_id=c.id
       WHERE j.id=$1 AND j.status='queued' AND COALESCE(j.next_attempt_at,j.created_at)<=now()
       FOR UPDATE OF j SKIP LOCKED`, [candidate.id],
    )).rows[0];
    if (next) await client.query("UPDATE character_art_jobs SET status='running',started_at=now(),next_attempt_at=NULL WHERE id=$1", [next.id]);
    return next;
  });
}

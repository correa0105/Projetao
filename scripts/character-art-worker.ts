import 'dotenv/config';
import { pool } from '../server/db.js';
import { claimNextArtJob, recoverInterruptedCharacterArt, retryCharacterArt } from '../server/character-art-retries.js';
import { completeArt } from '../server/character-art.js';
import {
  generateCharacterArtPair,
  generateCompanionArtPair,
} from '../server/character-token-illustrator.js';
import { completeCompanionArt } from '../server/companion-equipment.js';
import { checkCodexLogin, IllustratorError } from '../server/codex-illustrator.js';
import { AppError } from '../server/services.js';

const lock = await pool.connect();
await lock.query(
  "SET application_name='alvorada-illustrator-lease'; SET idle_session_timeout='60s'",
);
const {
  rows: [locked],
} = await lock.query('SELECT pg_try_advisory_lock(71503215) AS acquired');
if (!locked.acquired) {
  console.error('Já existe um ilustrador ativo.');
  lock.release();
  await pool.end();
  process.exit(1);
}
let stopping = false;
lock.on('error', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});
let heartbeat: ReturnType<typeof setInterval> | undefined;
try {
  await checkCodexLogin();
  await recoverInterruptedCharacterArt();
  await pool.query(
    "UPDATE companion_art_jobs SET status='failed',reference=NULL,error='A geração foi interrompida. A tentativa não consumiu a cota.' WHERE status='running'",
  );
  await pool.query(
    "DELETE FROM companion_art_equipment WHERE job_id IN(SELECT id FROM companion_art_jobs WHERE status IN('failed','stale'))",
  );
  // Keep the lease connection alive too: a pooled heartbeat could otherwise
  // advertise availability while the session holding the worker lock is stale.
  const heartbeatQuery = {
    text: 'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),$1) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=EXCLUDED.available',
    query_timeout: 15000,
  };
  let available = true;
  let checking: Promise<void> | undefined;
  const beat = () => {
    if (checking) return checking;
    checking = (async () => {
      let ready = false;
      try { await checkCodexLogin(); ready = true; } catch { /* Keep queued requests until the CLI recovers. */ }
      await lock.query({ ...heartbeatQuery, values: [ready] });
      if (ready !== available)
        console.log(ready ? 'Ilustrador reconectado.' : 'Ilustrador indisponível; fila preservada.');
      available = ready;
    })().finally(() => { checking = undefined; });
    return checking;
  };
  await beat();
  heartbeat = setInterval(
    () =>
      void beat().catch(() => {
        stopping = true;
      }),
    10_000,
  );
  console.log('Ilustrador ativo — sessão ChatGPT do Codex, sem API key. Ctrl+C para parar.');
  do {
    if (!available) {
      if (process.argv.includes('--once')) break;
      await new Promise(resolve => setTimeout(resolve, 2500));
      continue;
    }
    const job = await claimNextArtJob();
    if (job) {
      try {
        const companion = job.queue_kind === 'companion';
        const { rows: equipment } = await pool.query(
          `SELECT slot,item_id,name,image FROM ${companion ? 'companion_art_equipment' : 'character_art_equipment'} WHERE job_id=$1 ORDER BY slot`,
          [job.id],
        );
        job.equipment = equipment;
        if (companion) {
          const result = await completeCompanionArt(job.id, await generateCompanionArtPair(job));
          console.log(
            result.status === 'stale'
              ? `Arte descartada por equipamento alterado: ${job.id}. Cota preservada.`
              : `Arte concluída: ${job.id}`,
          );
        } else {
          await completeArt(
            job.id,
            await generateCharacterArtPair(
              job,
              !job.character_id || job.replacement_revision != null
                ? async (portrait) => {
                    await completeArt(job.id, { portrait });
                  }
                : undefined,
            ),
          );
          console.log(`Arte concluída: ${job.id}`);
        }
      } catch (error) {
        const code =
          error instanceof IllustratorError
            ? error.code
            : error instanceof AppError
              ? 'image_validation'
              : 'internal';
        const message =
          error instanceof IllustratorError || error instanceof AppError
            ? error.message
            : 'Não foi possível finalizar a arte. Tente novamente.';
        if (job.queue_kind === 'companion') {
          await pool.query("UPDATE companion_art_jobs SET status='failed',reference=NULL,error=$2 WHERE id=$1 AND status='running'", [job.id, `${message} Sua cota foi preservada.`]);
          await pool.query('DELETE FROM companion_art_equipment WHERE job_id=$1', [job.id]);
          console.error(`Falha de geração: ${job.id}. Motivo: ${code}. Cota preservada.`);
        } else {
          const resumed = await retryCharacterArt(job.id, error);
          console.error(`Geração ${resumed?.status === 'queued' ? 'aguardando retomada automática' : 'não concluída'}: ${job.id}. Motivo: ${code}. Cota preservada.`);
        }
      }
    } else if (!process.argv.includes('--once'))
      await new Promise((resolve) => setTimeout(resolve, 2500));
  } while (!stopping && !process.argv.includes('--once'));
} finally {
  if (heartbeat) clearInterval(heartbeat);
  await pool.query('UPDATE character_art_worker SET available=false WHERE id=true').catch(() => {});
  await lock.query('SELECT pg_advisory_unlock(71503215)');
  lock.release();
  await pool.end();
}

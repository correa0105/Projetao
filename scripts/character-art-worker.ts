import 'dotenv/config';
import { pool, transaction } from '../server/db.js';
import { completeArt } from '../server/character-art.js';
import { completeCompanionArt } from '../server/companion-equipment.js';
import {
  checkCodexLogin,
  generateCharacterArt,
  generateCompanionArt,
  IllustratorError,
} from '../server/codex-illustrator.js';
import { AppError } from '../server/services.js';

const lock = await pool.connect();
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
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});
let heartbeat: ReturnType<typeof setInterval> | undefined;
try {
  await checkCodexLogin();
  // A previous process may have stopped while rendering. Do not charge or retry invisibly.
  await pool.query(
    "UPDATE character_art_jobs SET status='failed',reference=NULL,error='A geração foi interrompida. Envie a referência novamente; a tentativa não consumiu a cota.' WHERE status='running'",
  );
  await pool.query(
    "UPDATE companion_art_jobs SET status='failed',reference=NULL,error='A geração foi interrompida. A tentativa não consumiu a cota.' WHERE status='running'",
  );
  await pool.query(
    "DELETE FROM companion_art_equipment WHERE job_id IN(SELECT id FROM companion_art_jobs WHERE status IN('failed','stale'))",
  );
  const beat = () =>
    pool.query(
      'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
    );
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
    const job = await transaction(async (client) => {
      const candidate = (
        await client.query(
          "SELECT id,created_at,'character' AS queue_kind FROM character_art_jobs WHERE status='queued' UNION ALL SELECT id,created_at,'companion' FROM companion_art_jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1",
        )
      ).rows[0];
      if (candidate?.queue_kind === 'companion') {
        const next = (
          await client.query(
            "SELECT * FROM companion_art_jobs WHERE id=$1 AND status='queued' FOR UPDATE SKIP LOCKED",
            [candidate.id],
          )
        ).rows[0];
        if (next)
          await client.query(
            "UPDATE companion_art_jobs SET status='running',started_at=now() WHERE id=$1",
            [next.id],
          );
        return next ? { ...next, queue_kind: 'companion' } : undefined;
      }
      const {
        rows: [next],
      } = await client.query(
        "SELECT j.*,COALESCE(c.race,j.creation->>'race') AS race,COALESCE(c.class,j.creation->>'class') AS class,COALESCE(s.choices,j.creation->'choices') AS choices FROM character_art_jobs j LEFT JOIN characters c ON c.id=j.character_id LEFT JOIN character_sheets s ON s.character_id=c.id WHERE j.status='queued' ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1",
      );
      if (next)
        await client.query(
          "UPDATE character_art_jobs SET status='running',started_at=now() WHERE id=$1",
          [next.id],
        );
      return next;
    });
    if (job) {
      try {
        const companion = job.queue_kind === 'companion';
        const { rows: equipment } = await pool.query(
          `SELECT slot,item_id,name,image FROM ${companion ? 'companion_art_equipment' : 'character_art_equipment'} WHERE job_id=$1 ORDER BY slot`,
          [job.id],
        );
        job.equipment = equipment;
        if (companion) {
          const result = await completeCompanionArt(job.id, await generateCompanionArt(job));
          console.log(
            result.status === 'stale'
              ? `Arte descartada por equipamento alterado: ${job.id}. Cota preservada.`
              : `Arte concluída: ${job.id}`,
          );
        } else {
          await completeArt(job.id, await generateCharacterArt(job));
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
        await pool.query(
          `UPDATE ${job.queue_kind === 'companion' ? 'companion_art_jobs' : 'character_art_jobs'} SET status='failed',reference=NULL,error=$2 WHERE id=$1 AND status='running'`,
          [job.id, `${message} Sua cota foi preservada.`],
        );
        if (job.queue_kind === 'companion')
          await pool.query('DELETE FROM companion_art_equipment WHERE job_id=$1', [job.id]);
        console.error(`Falha de geração: ${job.id}. Motivo: ${code}. Cota preservada.`);
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

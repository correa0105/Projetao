import sharp from 'sharp';
import { pool } from '../server/db.js';
import { completeArt } from '../server/character-art.js';

export async function lockTestIllustrator() {
  const client = await pool.connect();
  const {
    rows: [result],
  } = await client.query('SELECT pg_try_advisory_lock(71503215) AS acquired');
  if (!result.acquired) {
    client.release();
    throw new Error('Pare o ilustrador local antes de executar os testes de imagens.');
  }
  return async () => {
    await pool.query('UPDATE character_art_worker SET available=false');
    await client.query('SELECT pg_advisory_unlock(71503215)');
    client.release();
  };
}

export async function testArtImage() {
  return sharp({
    create: {
      width: 512,
      height: 768,
      channels: 4,
      background: { r: 140, g: 120, b: 90, alpha: 0.7 },
    },
  })
    .png()
    .toBuffer();
}
export async function finishTestArt(id: string, image?: Buffer) {
  // The fake renderer is test-only; no production HTTP endpoint can mark a job complete.
  const {
    rows: [job],
  } = await pool.query(
    'SELECT u.email FROM character_art_jobs j JOIN "user" u ON u.id=j.user_id WHERE j.id=$1',
    [id],
  );
  if (!job?.email.endsWith('@example.test'))
    throw new Error('Fixture restrita a usuários de teste.');
  await pool.query(
    "UPDATE character_art_jobs SET status='running' WHERE id=$1 AND status='queued'",
    [id],
  );
  return completeArt(id, image || (await testArtImage()));
}
export async function createLegacyTestCharacter(userId: string, name = 'Explorador de teste') {
  const {
    rows: [user],
  } = await pool.query('SELECT email FROM "user" WHERE id=$1', [userId]);
  if (!user?.email.endsWith('@example.test'))
    throw new Error('Fixture restrita a usuários de teste.');
  const {
    rows: [character],
  } = await pool.query(
    `INSERT INTO characters(user_id,name,race,class,hp,armor_class) VALUES($1,$2,'Elfo','Guerreiro',11,12) RETURNING *`,
    [userId, name],
  );
  return character;
}

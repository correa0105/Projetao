import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { rollCharacterAbilities } from './ability-rolls.js';
import type { CharacterSlotRolls } from '../shared/character-slot-rolls.js';
type DB = Pick<PoolClient, 'query'>;
type PoolRow = {
  slot: number;
  generation: number;
  rolls: number[][] | null;
  minimum: number;
  revealed: number;
  character_id: string | null;
  matured: boolean;
};
export async function readCharacterSlots(db: DB, user: string): Promise<CharacterSlotRolls[]> {
  const rows = (
    await db.query(
      `SELECT p.slot,p.generation,p.rolls,p.minimum,p.revealed,p.matured,(c.id IS NOT NULL) AS occupied,c.name,
 EXISTS(SELECT 1 FROM character_art_jobs j WHERE j.user_id=p.user_id AND j.creation_slot=p.slot AND j.character_id IS NULL AND j.status IN('queued','running')) AS pending
 FROM character_slot_rolls p LEFT JOIN characters c ON c.user_id=p.user_id AND c.creation_slot=p.slot AND c.deleted_at IS NULL WHERE p.user_id=$1 ORDER BY p.slot`,
      [user],
    )
  ).rows;
  return rows.map(({ matured, ...p }) =>
    matured && !p.occupied && !p.pending
      ? { ...p, generation: p.generation + 1, rolls: null, minimum: 8, revealed: 0 }
      : p,
  );
}
export async function ensureCharacterSlots(db: DB, user: string) {
  await db.query(
    'INSERT INTO character_slot_rolls(user_id,slot) SELECT $1,n FROM generate_series(1,2)n ON CONFLICT DO NOTHING',
    [user],
  );
}
export async function freeCharacterSlot(
  db: DB,
  user: string,
  requested?: number,
  excludeJob?: string,
  ready = false,
) {
  await ensureCharacterSlots(db, user);
  const available = (
    await db.query(
      `SELECT p.* FROM character_slot_rolls p WHERE p.user_id=$1 AND($2::smallint IS NULL OR p.slot=$2)
 AND NOT EXISTS(SELECT 1 FROM characters c WHERE c.user_id=p.user_id AND c.creation_slot=p.slot AND c.deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM character_art_jobs j WHERE j.user_id=p.user_id AND j.creation_slot=p.slot AND j.character_id IS NULL AND j.status IN('queued','running') AND j.id IS DISTINCT FROM $3::uuid)
 ORDER BY p.slot LIMIT 1 FOR UPDATE OF p`,
      [user, requested ?? null, excludeJob ?? null],
    )
  ).rows[0] as PoolRow | undefined;
  if (!available)
    throw new AppError(
      409,
      'Este slot está ocupado por um personagem ou uma imagem em preparação.',
    );
  if (available.matured) {
    await db.query(
      'UPDATE character_slot_rolls SET generation=generation+1,rolls=NULL,minimum=8,revealed=0,character_id=NULL,matured=false,updated_at=now() WHERE user_id=$1 AND slot=$2',
      [user, available.slot],
    );
    Object.assign(available, {
      generation: available.generation + 1,
      rolls: null,
      minimum: 8,
      revealed: 0,
      character_id: null,
      matured: false,
    });
  }
  if (ready && (!available.rolls || available.revealed !== 6))
    throw new AppError(
      409,
      'Role e confirme os seis atributos deste slot antes de criar a aparência.',
    );
  return available;
}
export async function characterSlotPool(
  db: DB,
  c: { id: string; user_id: string; creation_slot: number | null },
) {
  await ensureCharacterSlots(db, c.user_id);
  if (!c.creation_slot) {
    const available = await freeCharacterSlot(db, c.user_id);
    c.creation_slot = available.slot;
    await db.query('UPDATE characters SET creation_slot=$2 WHERE id=$1', [c.id, c.creation_slot]);
  }
  return (
    await db.query('SELECT * FROM character_slot_rolls WHERE user_id=$1 AND slot=$2 FOR UPDATE', [
      c.user_id,
      c.creation_slot,
    ])
  ).rows[0] as PoolRow;
}
export function characterSlotRollsRouter() {
  const r = Router(),
    slot = z.coerce.number().int().min(1).max(2);
  r.get('/character-slots', async (_req, res) => {
    await ensureCharacterSlots(pool, res.locals.user.id);
    res.set('Cache-Control', 'no-store').json(await readCharacterSlots(pool, res.locals.user.id));
  });
  r.post('/character-slots/:slot/roll', async (req, res) => {
    const user = res.locals.user.id,
      n = slot.parse(req.params.slot);
    await transaction(async (db) => {
      await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user]);
      const p = await freeCharacterSlot(db, user, n);
      if (!p.rolls)
        await db.query(
          'UPDATE character_slot_rolls SET rolls=$3,minimum=8,revealed=0,updated_at=now() WHERE user_id=$1 AND slot=$2',
          [user, n, JSON.stringify(rollCharacterAbilities())],
        );
    });
    res.json((await readCharacterSlots(pool, user)).find((p) => p.slot === n));
  });
  r.post('/character-slots/:slot/reveal', async (req, res) => {
    const user = res.locals.user.id,
      n = slot.parse(req.params.slot),
      revealed = z
        .object({ revealed: z.number().int().min(0).max(6) })
        .strict()
        .parse(req.body).revealed;
    await transaction(async (db) => {
      await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user]);
      const p = await freeCharacterSlot(db, user, n);
      if (!p.rolls || revealed > p.revealed + 1)
        throw new AppError(409, 'Confirme uma rolagem por vez.');
      await db.query(
        'UPDATE character_slot_rolls SET revealed=greatest(revealed,$3),updated_at=now() WHERE user_id=$1 AND slot=$2',
        [user, n, revealed],
      );
    });
    res.json((await readCharacterSlots(pool, user)).find((p) => p.slot === n));
  });
  return r;
}

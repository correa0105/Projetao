import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import {
  DEFAULT_CHARACTER_CAPACITY,
  type CharacterCampState,
} from '../shared/character-account.js';
type DB = Pick<PoolClient, 'query'>;
export async function characterCapacity(db: DB, user: string): Promise<number> {
  return (
    (
      await db.query('SELECT max_characters FROM character_account_settings WHERE user_id=$1', [
        user,
      ])
    ).rows[0]?.max_characters ?? DEFAULT_CHARACTER_CAPACITY
  );
}
export async function characterCampState(db: DB, user: string): Promise<CharacterCampState> {
  const setting = (
    await db.query('SELECT * FROM character_account_settings WHERE user_id=$1', [user])
  ).rows[0];
  const owned = (
    await db.query(
      'SELECT id FROM characters WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at,id',
      [user],
    )
  ).rows.map((c) => c.id);
  const ids = setting?.camp_character_ids ?? owned.slice(0, 2);
  return {
    limit: setting?.max_characters ?? DEFAULT_CHARACTER_CAPACITY,
    revision: setting?.revision ?? 0,
    positions: [0, 1].map((i) =>
      owned.includes(ids[i]) ? ids[i] : null,
    ) as CharacterCampState['positions'],
  };
}
export function characterAccountRouter() {
  const router = Router();
  router.get('/character-camp', async (_req, res) =>
    res.set('Cache-Control', 'no-store').json(await characterCampState(pool, res.locals.user.id)),
  );
  router.post('/character-camp', async (req, res) => {
    const user = res.locals.user.id,
      body = z
        .object({
          positions: z.tuple([z.string().uuid().nullable(), z.string().uuid().nullable()]),
          revision: z.number().int().min(0),
        })
        .strict()
        .parse(req.body);
    const ids = body.positions.filter((id): id is string => !!id);
    if (new Set(ids).size !== ids.length)
      throw new AppError(400, 'Escolha personagens diferentes para os dois lugares.');
    await transaction(async (db) => {
      await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user]);
      const old = (
        await db.query(
          'SELECT revision FROM character_account_settings WHERE user_id=$1 FOR UPDATE',
          [user],
        )
      ).rows[0];
      if ((old?.revision ?? 0) !== body.revision)
        throw new AppError(409, 'O acampamento mudou em outra janela. Atualize antes de trocar.');
      if (
        (
          await db.query(
            'SELECT id FROM characters WHERE user_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL',
            [user, ids],
          )
        ).rowCount !== ids.length
      )
        throw new AppError(404, 'Escolha um personagem da sua conta.');
      await db.query(
        'INSERT INTO character_account_settings(user_id,camp_character_ids,revision)VALUES($1,$2,1)ON CONFLICT(user_id)DO UPDATE SET camp_character_ids=excluded.camp_character_ids,revision=character_account_settings.revision+1,updated_at=now()',
        [user, body.positions],
      );
    });
    res.json(await characterCampState(pool, user));
  });
  return router;
}

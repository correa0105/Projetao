import { Router } from 'express';
import { z } from 'zod';
import { transaction } from './db.js';
import { isAdministrator } from './administrators.js';
import { AppError } from './services.js';
import { applyTokenDeath, type VttDocument, type VttScene, type VttToken } from '../shared/vtt.js';
import type { PoolClient } from 'pg';
import { applyTokenBlood } from '../shared/vtt-blood.js';
type DB = Pick<PoolClient, 'query'>;
type Room = { owner_id: string; document: VttDocument; role?: string | null };
export function vttDamageRouter(
  access: (db: DB, id: string, user: string, lock?: boolean) => Promise<Room>,
  visible: (token: VttToken, scene: VttScene, user: string) => boolean,
  state: (id: string, user: string) => Promise<unknown>,
) {
  const router = Router();
  router.post('/vtt/rooms/:id/damage', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    const input = z
      .object({
        token_id: z.string().uuid(),
        message_ids: z
          .array(z.string().regex(/^\d{1,19}$/))
          .min(1)
          .max(100),
      })
      .strict()
      .parse(req.body);
    if (new Set(input.message_ids).size !== input.message_ids.length)
      throw new AppError(400, 'Rolagem repetida.');
    await transaction(async (db) => {
      const r = await access(db, id, user, true);
      const gm = r.owner_id === user && (await isAdministrator(user, db as PoolClient));
      if (r.role === 'spectator')
        throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
      const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
      const target = scene.tokens.find((t) => t.id === input.token_id && t.layer === 'tokens');
      if (!target || (!gm && !visible(target, scene, user)))
        throw new AppError(404, 'Alvo não disponível neste mapa.');
      if (!gm && target.controller !== user)
        throw new AppError(403, 'Somente o mestre ou o dono do personagem aplica dano nele.');
      const { rows } = await db.query(
        `SELECT id::text,roll,damage,private,author_id,discarded FROM vtt_messages
        WHERE room_id=$1 AND id=ANY($2::bigint[]) ORDER BY id FOR UPDATE`,
        [id, input.message_ids],
      );
      if (rows.length !== input.message_ids.length)
        throw new AppError(404, 'Rolagem não encontrada nesta mesa.');
      const previous = await db.query(
        'SELECT message_id::text FROM vtt_damage_applications WHERE room_id=$1 AND token_id=$2 AND message_id=ANY($3::bigint[])',
        [id, target.id, input.message_ids],
      );
      const applied = new Set(previous.rows.map((a) => a.message_id));
      let amount = 0;
      for (const message of rows) {
        if (message.discarded) throw new AppError(400, 'Este dano foi descartado.');
        if (message.private && !gm && message.author_id !== user)
          throw new AppError(403, 'Esta rolagem é privada.');
        if (message.damage && message.damage.target_id !== target.id)
          throw new AppError(400, 'O dano foi rolado para outro alvo.');
        const value = message.roll?.total;
        if (!Number.isInteger(value) || value <= 0 || value > 100000)
          throw new AppError(400, 'Escolha uma rolagem com dano inteiro positivo.');
        if (applied.has(message.id)) continue;
        amount += value;
        if (amount > 100000) throw new AppError(400, 'Dano acima do limite.');
        await db.query(
          'INSERT INTO vtt_damage_applications(message_id,token_id,room_id,amount,applied_by)VALUES($1,$2,$3,$4,$5)',
          [message.id, target.id, id, value, user],
        );
      }
      if (!amount) return;
      const old = structuredClone(target);
      const hp = target.hp;
      target.hp = Math.max(0, hp - amount);
      applyTokenDeath(target, hp);
      applyTokenBlood(scene, target, old);
      await db.query(
        'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
        [id, JSON.stringify(r.document)],
      );
      await db.query(
        'INSERT INTO vtt_messages(room_id,author_id,author,text,private)VALUES($1,$2,$3,$4,$5)',
        [
          id,
          user,
          res.locals.user.name,
          `${target.name} recebeu ${amount} de dano · PV ${target.hp}/${target.maxHp}.`,
          rows.some((m) => m.private) || target.hidden,
        ],
      );
    });
    res.json(await state(id, user));
  });
  router.post('/vtt/rooms/:id/damage/discard', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    const input = z
      .object({
        message_ids: z
          .array(z.string().regex(/^\d{1,19}$/))
          .min(1)
          .max(100),
      })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      const r = await access(db, id, user, true),
        gm = r.owner_id === user && (await isAdministrator(user, db as PoolClient));
      if (r.role === 'spectator')
        throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
      const { rows } = await db.query(
        'SELECT id,author_id FROM vtt_messages WHERE room_id=$1 AND id=ANY($2::bigint[]) FOR UPDATE',
        [id, input.message_ids],
      );
      if (rows.length !== new Set(input.message_ids).size)
        throw new AppError(404, 'Rolagem não encontrada.');
      if (!gm && rows.some((m) => m.author_id !== user))
        throw new AppError(403, 'Você não pode descartar o dano de outro jogador.');
      const applied = await db.query(
        'SELECT 1 FROM vtt_damage_applications WHERE room_id=$1 AND message_id=ANY($2::bigint[]) LIMIT 1',
        [id, input.message_ids],
      );
      if (applied.rowCount) throw new AppError(409, 'Este dano já foi aplicado.');
      await db.query(
        'UPDATE vtt_messages SET discarded=true WHERE room_id=$1 AND id=ANY($2::bigint[])',
        [id, input.message_ids],
      );
    });
    res.json(await state(id, user));
  });
  return router;
}

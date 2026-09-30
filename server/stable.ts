import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { mounts } from '../shared/mounts.js';

export function stableRouter() {
  const router = Router();
  router.get('/stable/:characterId', async (req, res) => {
    const id = z.string().uuid().parse(req.params.characterId);
    const character = await pool.query('SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [id, res.locals.user.id]);
    if (!character.rowCount) throw new AppError(404, 'Personagem não encontrado.');
    const { rows } = await pool.query('SELECT id,mount_id,name,price_cp,created_at FROM character_mounts WHERE character_id=$1 ORDER BY created_at DESC,id', [id]);
    res.json(rows);
  });
  router.post('/stable/purchase', async (req, res) => {
    const data = z.object({
      character_id: z.string().uuid(), mount_id: z.string(),
      name: z.string().trim().min(1).max(40).regex(/^[\p{L}\p{M}\p{N} '\-]+$/u, 'Use letras, números, espaços, apóstrofo ou hífen no nome.'),
      idempotency_key: z.string().uuid(),
    }).parse(req.body);
    const mount = mounts.find(m => m.id === data.mount_id);
    if (!mount) throw new AppError(400, 'Montaria indisponível.');
    const result = await transaction(async client => {
      const { rows: [character] } = await client.query('SELECT id,gold_cp FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE', [data.character_id, res.locals.user.id]);
      if (!character) throw new AppError(404, 'Personagem não encontrado.');
      const { rows: [previous] } = await client.query('SELECT * FROM character_mounts WHERE character_id=$1 AND idempotency_key=$2', [character.id, data.idempotency_key]);
      if (previous) {
        if (previous.mount_id !== mount.id || previous.name !== data.name) throw new AppError(409, 'Esta compra já foi registrada com outros dados.');
        return { mount: previous, gold_cp: character.gold_cp, replayed: true };
      }
      if (character.gold_cp < mount.price_cp) throw new AppError(409, 'Ouro insuficiente para comprar esta montaria.');
      await client.query('UPDATE characters SET gold_cp=gold_cp-$2 WHERE id=$1', [character.id, mount.price_cp]);
      const { rows: [owned] } = await client.query('INSERT INTO character_mounts(character_id,mount_id,name,price_cp,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING *', [character.id, mount.id, data.name, mount.price_cp, data.idempotency_key]);
      return { mount: owned, gold_cp: character.gold_cp - mount.price_cp, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });
  return router;
}

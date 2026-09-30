import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { stableGear } from '../shared/stable-gear.js';
import { mounts } from '../shared/mounts.js';

export function stableRouter() {
  const router = Router();
  router.get('/stable/:characterId', async (req, res) => {
    const id = z.string().uuid().parse(req.params.characterId);
    const character = await pool.query('SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [id, res.locals.user.id]);
    if (!character.rowCount) throw new AppError(404, 'Personagem não encontrado.');
    const { rows } = await pool.query('SELECT id,mount_id,coat,name,price_cp,equipment,equipment_price_cp,created_at FROM character_mounts WHERE character_id=$1 ORDER BY created_at DESC,id', [id]);
    res.json(rows);
  });
  router.post('/stable/purchase', async (req, res) => {
    const data = z.object({
      character_id: z.string().uuid(), mount_id: z.string(), coat: z.enum(['original', 'alternate']).default('original'),
      name: z.string().trim().min(1).max(40).regex(/^[\p{L}\p{M}\p{N} '\-]+$/u, 'Use letras, números, espaços, apóstrofo ou hífen no nome.'),
      equipment: z.array(z.string()).max(3).default([]),
      idempotency_key: z.string().uuid(),
    }).parse(req.body);
    const mount = mounts.find(m => m.id === data.mount_id);
    if (!mount) throw new AppError(400, 'Montaria indisponível.');
    const equipment = [...data.equipment].sort();
    const gear = equipment.map(id => stableGear.find(g => g.id === id));
    if (gear.some(g => !g) || new Set(gear.map(g => g?.slot)).size !== gear.length) throw new AppError(400, 'Selecione apenas um equipamento de cada tipo.');
    const equipmentPrice = gear.reduce((sum,g) => sum + g!.price_cp, 0);
    const total = mount.price_cp + equipmentPrice;
    const result = await transaction(async client => {
      const { rows: [character] } = await client.query('SELECT id,gold_cp FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE', [data.character_id, res.locals.user.id]);
      if (!character) throw new AppError(404, 'Personagem não encontrado.');
      const { rows: [previous] } = await client.query('SELECT * FROM character_mounts WHERE character_id=$1 AND idempotency_key=$2', [character.id, data.idempotency_key]);
      if (previous) {
        if (previous.mount_id !== mount.id || previous.name !== data.name || previous.coat !== data.coat || JSON.stringify(previous.equipment) !== JSON.stringify(equipment)) throw new AppError(409, 'Esta compra já foi registrada com outros dados.');
        return { mount: previous, gold_cp: character.gold_cp, replayed: true };
      }
      if (character.gold_cp < total) throw new AppError(409, 'Ouro insuficiente para comprar esta montaria.');
      await client.query('UPDATE characters SET gold_cp=gold_cp-$2 WHERE id=$1', [character.id, total]);
      const { rows: [owned] } = await client.query('INSERT INTO character_mounts(character_id,mount_id,name,price_cp,idempotency_key,coat,equipment,equipment_price_cp) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [character.id, mount.id, data.name, mount.price_cp, data.idempotency_key, data.coat, JSON.stringify(equipment), equipmentPrice]);
      return { mount: owned, gold_cp: character.gold_cp - total, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });
  return router;
}

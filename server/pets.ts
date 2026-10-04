import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { pets, petAppearance } from '../shared/pets.js';

export function petsRouter() {
  const router = Router();
  router.get('/pets/:characterId', async (req, res) => {
    const id = z.string().uuid().parse(req.params.characterId);
    const character = await pool.query(
      'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
      [id, res.locals.user.id],
    );
    if (!character.rowCount) throw new AppError(404, 'Personagem não encontrado.');
    res.json(
      (
        await pool.query(
          'SELECT id,pet_id,name,appearance,price_cp,created_at FROM character_pets WHERE character_id=$1 ORDER BY created_at DESC,id',
          [id],
        )
      ).rows,
    );
  });
  router.post('/pets/purchase', async (req, res) => {
    const input = z
      .object({
        character_id: z.string().uuid(),
        pet_id: z.string(),
        appearance: z.string().max(40).default('original'),
        name: z.string().trim().min(1).max(40),
        idempotency_key: z.string().uuid(),
      })
      .strict()
      .parse(req.body);
    const pet = pets.find((item) => item.id === input.pet_id);
    if (!pet) throw new AppError(400, 'Mascote indisponível.');
    if (input.appearance !== 'original' && !petAppearance(pet.id, input.appearance))
      throw new AppError(400, 'Aparência indisponível para este mascote.');
    const result = await transaction(async (client) => {
      const {
        rows: [character],
      } = await client.query(
        'SELECT id,gold_cp FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [input.character_id, res.locals.user.id],
      );
      if (!character) throw new AppError(404, 'Personagem não encontrado.');
      const {
        rows: [previous],
      } = await client.query(
        'SELECT * FROM character_pets WHERE character_id=$1 AND idempotency_key=$2',
        [character.id, input.idempotency_key],
      );
      if (previous) {
        if (
          previous.pet_id !== pet.id ||
          previous.name !== input.name ||
          previous.appearance !== input.appearance
        )
          throw new AppError(409, 'Esta compra já foi registrada com outra escolha.');
        return { pet: previous, gold_cp: character.gold_cp, replayed: true };
      }
      if (character.gold_cp < pet.price_cp)
        throw new AppError(409, 'Ouro insuficiente para comprar este mascote.');
      await client.query('UPDATE characters SET gold_cp=gold_cp-$2 WHERE id=$1', [
        character.id,
        pet.price_cp,
      ]);
      const {
        rows: [owned],
      } = await client.query(
        'INSERT INTO character_pets(character_id,pet_id,name,price_cp,idempotency_key,appearance) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,pet_id,name,appearance,price_cp,created_at',
        [character.id, pet.id, input.name, pet.price_cp, input.idempotency_key, input.appearance],
      );
      return { pet: owned, gold_cp: character.gold_cp - pet.price_cp, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });
  return router;
}

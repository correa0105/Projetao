import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { pets, petAppearance, defaultPetBreeds } from '../shared/pets.js';
import { requireAdministrator, isAdministrator } from './administrators.js';
import { withCompanionImages } from './companion-images.js';
import { currentGoldUnlimited, spendGold } from './gold.js';

export function petsRouter() {
  const router = Router();
  router.get('/pets/catalog', async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT pet_id,appearance,name,revision FROM pet_breed_names',
    );
    res.json({
      breeds: defaultPetBreeds().map(
        (breed) =>
          rows.find((row) => row.pet_id === breed.pet_id && row.appearance === breed.appearance) ||
          breed,
      ),
      can_edit: await isAdministrator(res.locals.user.id),
    });
  });
  router.put('/pets/catalog/:petId/:appearance', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const { name, revision } = z
      .object({ name: z.string().trim().min(1).max(80), revision: z.number().int().min(0) })
      .strict()
      .parse(req.body);
    const breed = defaultPetBreeds().find(
      (item) => item.pet_id === req.params.petId && item.appearance === req.params.appearance,
    );
    if (!breed) throw new AppError(404, 'Raça não encontrada.');
    const result = await transaction(async (client) => {
      await requireAdministrator(res.locals.user.id, client);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `pet-breed:${breed.pet_id}:${breed.appearance}`,
      ]);
      const {
        rows: [current],
      } = await client.query(
        'SELECT revision FROM pet_breed_names WHERE pet_id=$1 AND appearance=$2',
        [breed.pet_id, breed.appearance],
      );
      if ((current?.revision || 0) !== revision)
        throw new AppError(409, 'Esta raça foi editada por outra pessoa. Atualize a página.');
      const {
        rows: [saved],
      } = await client.query(
        'INSERT INTO pet_breed_names(pet_id,appearance,name,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(pet_id,appearance) DO UPDATE SET name=EXCLUDED.name,updated_by=EXCLUDED.updated_by,updated_at=now(),revision=pet_breed_names.revision+1 RETURNING pet_id,appearance,name,revision',
        [breed.pet_id, breed.appearance, name, res.locals.user.id],
      );
      return saved;
    });
    res.json(result);
  });
  router.get('/pets/:characterId', async (req, res) => {
    const id = z.string().uuid().parse(req.params.characterId);
    const character = await pool.query(
      'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
      [id, res.locals.user.id],
    );
    if (!character.rowCount) throw new AppError(404, 'Personagem não encontrado.');
    res.json(
      await withCompanionImages(
        pool,
        id,
        (
          await pool.query(
            'SELECT id,pet_id,name,appearance,price_cp,created_at,displayed FROM character_pets WHERE character_id=$1 ORDER BY created_at DESC,id',
            [id],
          )
        ).rows,
      ),
    );
  });
  router.put('/pets/:characterId/display', async (req, res) => {
    const id = z.string().uuid().parse(req.params.characterId);
    const { pet_id } = z.object({ pet_id: z.string().uuid().nullable() }).strict().parse(req.body);
    await transaction(async (client) => {
      const character = await client.query(
        'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [id, res.locals.user.id],
      );
      if (!character.rowCount) throw new AppError(404, 'Personagem não encontrado.');
      if (
        pet_id &&
        !(
          await client.query('SELECT id FROM character_pets WHERE id=$1 AND character_id=$2', [
            pet_id,
            id,
          ])
        ).rowCount
      )
        throw new AppError(404, 'Este mascote não pertence a este personagem.');
      await client.query(
        'UPDATE character_pets SET displayed=false WHERE character_id=$1 AND displayed',
        [id],
      );
      if (pet_id)
        await client.query(
          'UPDATE character_pets SET displayed=true WHERE id=$1 AND character_id=$2',
          [pet_id, id],
        );
    });
    res.json({ pet_id });
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
      const gold_unlimited = await currentGoldUnlimited(client, res.locals.user.id);
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
        return { pet: previous, gold_cp: character.gold_cp, gold_unlimited, replayed: true };
      }
      const gold_cp = await spendGold(
        client,
        character,
        pet.price_cp,
        gold_unlimited,
        'Ouro insuficiente para comprar este mascote.',
      );
      const {
        rows: [owned],
      } = await client.query(
        'INSERT INTO character_pets(character_id,pet_id,name,price_cp,idempotency_key,appearance,displayed) VALUES($1,$2,$3,$4,$5,$6,NOT EXISTS(SELECT 1 FROM character_pets WHERE character_id=$1)) RETURNING id,pet_id,name,appearance,price_cp,created_at,displayed',
        [character.id, pet.id, input.name, pet.price_cp, input.idempotency_key, input.appearance],
      );
      return { pet: owned, gold_cp, gold_unlimited, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });
  return router;
}

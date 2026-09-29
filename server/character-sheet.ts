import { Router } from 'express';
import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import {
  validateChoices,
  deriveSheet,
  racialBonuses,
  startingGold,
  validateRestChoices,
  classRules,
  spellOptions,
  type SheetRecord,
} from '../shared/character-sheet.js';

async function owned(client: Pick<PoolClient, 'query'>, id: string, userId: string, lock = false) {
  const {
    rows: [c],
  } = await client.query(
    `SELECT * FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
    [id, userId],
  );
  if (!c) throw new AppError(404, 'Personagem não encontrado.');
  return c;
}
function validated(race: string, cls: string, value: unknown) {
  try {
    return validateChoices(race, cls, value);
  } catch (e) {
    throw new AppError(
      400,
      e instanceof z.ZodError ? 'Confira as escolhas da ficha.' : (e as Error).message,
    );
  }
}
async function result(id: string, user: string) {
  const c = await owned(pool, id, user);
  const {
    rows: [sheet],
  } = await pool.query('SELECT * FROM character_sheets WHERE character_id=$1', [id]);
  return {
    sheet: sheet || null,
    derived: sheet?.finalized_at ? deriveSheet(c, sheet.choices) : null,
  };
}
export function characterSheetRouter() {
  const router = Router();
  router.get('/characters/:id/sheet', async (req, res) =>
    res.json(await result(z.string().uuid().parse(req.params.id), res.locals.user.id)),
  );
  router.post('/characters/:id/sheet/choices', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      // A patente pode evoluir antes da revisão da origem legada. A rolagem existente,
      // não o nível atual, impede reescolher a origem de uma ficha já confirmada.
      const {
        rows: [sheet],
      } = await client.query('SELECT rolls,choices FROM character_sheets WHERE character_id=$1', [
        id,
      ]);
      if (sheet?.rolls && sheet.choices?.version === 2)
        throw new AppError(409, 'As escolhas ficam fixas após a rolagem.');
      const species = sheet && !sheet.choices ? req.body.species : c.race;
      const choices = validated(species, c.class, req.body);
      await client.query('UPDATE characters SET race=$2,background=$3 WHERE id=$1', [
        id,
        choices.species,
        choices.backgroundType,
      ]);
      await client.query(
        `INSERT INTO character_sheets(character_id,choices) VALUES($1,$2) ON CONFLICT(character_id) DO UPDATE SET choices=$2,rules_version='5.2.1',updated_at=now()`,
        [id, JSON.stringify(choices)],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/roll', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    await transaction(async (client) => {
      await owned(client, id, user, true);
      const {
        rows: [sheet],
      } = await client.query('SELECT * FROM character_sheets WHERE character_id=$1', [id]);
      if (!sheet?.choices) throw new AppError(409, 'Complete as escolhas da ficha antes de rolar.');
      if (sheet.rolls) return; // Retry/double click returns the same persisted dice, never a new draw.
      const rolls = Array.from({ length: 6 }, () =>
        Array.from({ length: 4 }, () => randomInt(1, 7)),
      );
      await client.query(
        'UPDATE character_sheets SET rolls=$2,updated_at=now() WHERE character_id=$1',
        [id, JSON.stringify(rolls)],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/finalize', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    const { assignment } = z
      .object({
        assignment: z
          .array(z.number().int().min(0).max(5))
          .length(6)
          .refine((v) => new Set(v).size === 6, 'Use cada resultado uma vez.'),
      })
      .parse(req.body);
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      const {
        rows: [sheet],
      } = await client.query<SheetRecord>('SELECT * FROM character_sheets WHERE character_id=$1', [
        id,
      ]);
      if (!sheet?.rolls || !sheet.choices) throw new AppError(409, 'Role os atributos primeiro.');
      if (sheet.finalized_at) {
        if (JSON.stringify(sheet.assignment) !== JSON.stringify(assignment))
          throw new AppError(409, 'A distribuição já foi confirmada.');
        return;
      }
      const bonuses = racialBonuses(c.race, sheet.choices);
      const stats = assignment.map(
        (roll, i) =>
          sheet.rolls![roll].reduce((a, b) => a + b, 0) -
          Math.min(...sheet.rolls![roll]) +
          bonuses[i],
      );
      const d = deriveSheet({ ...c, stats }, sheet.choices);
      if (!c.starting_wealth_granted)
        await client.query(
          'UPDATE characters SET gold_cp=gold_cp+$2,starting_wealth_granted=true WHERE id=$1',
          [id, startingGold(c.class, sheet.choices)],
        );
      await client.query(
        'UPDATE characters SET stats=$3,hp=$4,armor_class=$5 WHERE id=$1 AND user_id=$2',
        [id, user, JSON.stringify(stats), d.hp, d.armorClass],
      );
      await client.query(
        'UPDATE character_sheets SET assignment=$2,finalized_at=now(),current_hp=$3,updated_at=now() WHERE character_id=$1',
        [id, JSON.stringify(assignment), d.hp],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/state', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    const body = z
      .object({
        prepared: z.array(z.string()).max(10),
        notes: z.string().max(8000),
        current_hp: z.number().int().min(0),
        temp_hp: z.number().int().min(0).max(999),
        inspiration: z.boolean(),
        death_success: z.number().int().min(0).max(3),
        death_failure: z.number().int().min(0).max(3),
        slots_used: z.number().int().min(0),
        hit_dice_used: z.number().int().min(0),
      })
      .parse(req.body);
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      const {
        rows: [s],
      } = await client.query('SELECT * FROM character_sheets WHERE character_id=$1', [id]);
      if (!s?.finalized_at) throw new AppError(409, 'Conclua a ficha primeiro.');
      const d = deriveSheet(c, s.choices),
        k = classRules[c.class];
      const allowed = k.prepared
        ? c.class === 'Mago'
          ? s.choices.spells
          : spellOptions(c.class, 1).map((x) => x.id)
        : [];
      if (
        body.prepared.length > d.prepareCount ||
        new Set(body.prepared).size !== body.prepared.length ||
        body.prepared.some((x) => !allowed.includes(x)) ||
        body.current_hp > c.hp ||
        body.slots_used > d.slots ||
        body.hit_dice_used > c.level
      )
        throw new AppError(
          400,
          'Confira os limites de PV, dados de vida, espaços e magias preparadas.',
        );
      await client.query(
        `UPDATE character_sheets SET prepared=$2,notes=$3,current_hp=$4,temp_hp=$5,inspiration=$6,death_success=$7,death_failure=$8,slots_used=$9,hit_dice_used=$10,updated_at=now() WHERE character_id=$1`,
        [
          id,
          JSON.stringify(body.prepared),
          body.notes,
          body.current_hp,
          body.temp_hp,
          body.inspiration,
          body.death_success,
          body.death_failure,
          body.slots_used,
          body.hit_dice_used,
        ],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/rest-choices', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      const {
        rows: [sheet],
      } = await client.query('SELECT * FROM character_sheets WHERE character_id=$1', [id]);
      if (!sheet?.finalized_at || !sheet.choices)
        throw new AppError(409, 'Conclua a ficha primeiro.');
      let choices;
      try {
        choices = validateRestChoices(c.race, c.class, sheet.choices, req.body);
      } catch (e) {
        throw new AppError(400, (e as Error).message);
      }
      await client.query(
        'UPDATE character_sheets SET choices=$2,updated_at=now() WHERE character_id=$1',
        [id, JSON.stringify(choices)],
      );
    });
    res.json(await result(id, user));
  });
  return router;
}

import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import {
  gardenActionSchema,
  gardenComposts,
  gardenCrops,
  gardenHealingItem,
  type GardenAction,
  type HouseGarden,
} from '../shared/house-garden.js';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';

const uuid = z.string().uuid();
const gardenRequest = z
  .object({
    character_id: uuid,
    request_id: uuid,
    operation: gardenActionSchema,
  })
  .strict();
const hour = 3_600_000;
type GardenState = Pick<HouseGarden, 'crop' | 'fertilized' | 'compost'> & {
  ready_at: Date | null;
  watered_at: Date | null;
  compost_ready_at: Date | null;
};
const emptyGarden: GardenState = {
  crop: null,
  ready_at: null,
  watered_at: null,
  fertilized: false,
  compost: null,
  compost_ready_at: null,
};

function gardenReward(state: GardenState, operation: GardenAction, now: Date) {
  let gold = 0;
  let item: string | null = null;
  switch (operation.action) {
    case 'plant':
      if (state.crop) throw new AppError(409, 'O canteiro já está ocupado.');
      state.crop = operation.crop;
      gold = -gardenCrops[operation.crop].seedCp;
      break;
    case 'water':
      if (!state.crop || state.ready_at)
        throw new AppError(409, 'Plante uma semente que ainda precise de água.');
      state.ready_at = new Date(now.getTime() + gardenCrops[state.crop].hours * hour);
      state.watered_at = now;
      break;
    case 'ferment':
      if (state.compost) throw new AppError(409, 'O fermentador já tem um lote.');
      state.compost = operation.compost;
      state.compost_ready_at = new Date(
        now.getTime() + gardenComposts[operation.compost].hours * hour,
      );
      gold = -gardenComposts[operation.compost].costCp;
      break;
    case 'fertilize':
      if (!state.ready_at || state.ready_at <= now || state.fertilized)
        throw new AppError(
          409,
          'O adubo só pode ser aplicado uma vez em uma planta que esteja crescendo.',
        );
      if (!state.compost || !state.compost_ready_at || state.compost_ready_at > now)
        throw new AppError(409, 'A fermentação ainda não terminou.');
      state.ready_at = new Date(
        Math.max(
          now.getTime(),
          state.ready_at.getTime() - gardenComposts[state.compost].reductionHours * hour,
        ),
      );
      state.fertilized = true;
      state.compost = state.compost_ready_at = null;
      break;
    case 'harvest':
      if (!state.crop || !state.ready_at || state.ready_at > now)
        throw new AppError(409, 'A planta ainda não está pronta para colher.');
      if (operation.destination === 'healing') {
        if (!gardenCrops[state.crop].healing)
          throw new AppError(409, 'Essa colheita está disponível para venda.');
        item = gardenHealingItem;
      } else gold = gardenCrops[state.crop].saleCp;
      state.crop = state.ready_at = null;
      state.watered_at = null;
      state.fertilized = false;
      break;
  }
  return { gold, item };
}

function serialize(state: GardenState, gold: number, now: Date): HouseGarden {
  return {
    ...state,
    gold_cp: gold,
    server_time: now.toISOString(),
    ready_at: state.ready_at?.toISOString() ?? null,
    watered_at: state.watered_at?.toISOString() ?? null,
    compost_ready_at: state.compost_ready_at?.toISOString() ?? null,
  };
}

async function lockedGarden(db: PoolClient, userId: string, plotId: string, characterId: string) {
  const character = (
    await db.query<{ gold_cp: number }>(
      'SELECT gold_cp FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
      [characterId, userId],
    )
  ).rows[0];
  if (!character) throw new AppError(404, 'Personagem não encontrado.');
  const plot = await db.query(
    'SELECT id FROM house2_plots WHERE id=$1 AND character_id=$2 AND retired_at IS NULL AND house_id IS NOT NULL FOR UPDATE',
    [plotId, characterId],
  );
  if (!plot.rowCount) throw new AppError(404, 'Horta disponível somente em uma casa sua.');
  const garden = (
    await db.query<GardenState>(
      'SELECT crop,ready_at,watered_at,fertilized,compost,compost_ready_at FROM house2_gardens WHERE plot_id=$1 AND character_id=$2',
      [plotId, characterId],
    )
  ).rows[0];
  const now = (await db.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0].now;
  return { state: garden ?? { ...emptyGarden }, gold: character.gold_cp, now };
}

export function houseGardenRouter() {
  const router = Router();
  const path = '/house-v2/plots/:plot/garden';
  router.post(path + '/items', async (req, res) => {
    const plot = uuid.parse(req.params.plot);
    const { character_id: character } = z.object({ character_id: uuid }).strict().parse(req.body);
    res.json(await transaction(async db => {
      await lockedGarden(db, res.locals.user.id, plot, character);
      await db.query(
        `INSERT INTO house2_items(user_id,catalog_id,garden_plot_id,garden_role)
         SELECT $1,CASE role WHEN 'bed' THEN 'h2-garden-bed' ELSE 'h2-garden-compost' END,$2,role
         FROM (VALUES ('bed'),('compost')) AS roles(role)
         ON CONFLICT(garden_plot_id,garden_role) DO NOTHING`,
        [res.locals.user.id,plot],
      );
      return { items: (await db.query('SELECT * FROM house2_items WHERE garden_plot_id=$1 ORDER BY garden_role',[plot])).rows };
    }));
  });
  router.get(path, async (req, res) => {
    const plot = uuid.parse(req.params.plot);
    const row = (
      await pool.query<GardenState & { gold_cp: number; now: Date }>(
        `SELECT g.crop,g.ready_at,g.watered_at,coalesce(g.fertilized,false) AS fertilized,g.compost,g.compost_ready_at,c.gold_cp,clock_timestamp() AS now
       FROM house2_plots p JOIN characters c ON c.id=p.character_id
       LEFT JOIN house2_gardens g ON g.plot_id=p.id AND g.character_id=c.id
       WHERE p.id=$1 AND p.retired_at IS NULL AND p.house_id IS NOT NULL AND c.user_id=$2 AND c.deleted_at IS NULL`,
        [plot, res.locals.user.id],
      )
    ).rows[0];
    if (!row) throw new AppError(404, 'Horta disponível somente em uma casa sua.');
    const { gold_cp, now, ...state } = row;
    res.set('Cache-Control', 'no-store').json(serialize(state, gold_cp, now));
  });
  router.post(path, async (req, res) => {
    const plot = uuid.parse(req.params.plot);
    const {
      character_id: character,
      request_id: request,
      operation,
    } = gardenRequest.parse(req.body);
    const payload = JSON.stringify(operation);
    res.json(
      await transaction(async (db) => {
        const { state, gold, now } = await lockedGarden(db, res.locals.user.id, plot, character);
        const prior = (
          await db.query<{ same: boolean; gold_delta_cp: number; item_id: string | null }>(
            'SELECT plot_id=$3 AND action=$4::jsonb AS same,gold_delta_cp,item_id FROM house2_garden_actions WHERE character_id=$1 AND request_id=$2',
            [character, request, plot, payload],
          )
        ).rows[0];
        if (prior) {
          if (!prior.same)
            throw new AppError(409, 'Este pedido já foi usado em outra ação da horta.');
          return {
            garden: serialize(state, gold, now),
            gold_delta_cp: prior.gold_delta_cp,
            item_id: prior.item_id,
          };
        }
        const reward = gardenReward(state, operation, now);
        const balance = gold + reward.gold;
        if (balance < 0) throw new AppError(409, 'O personagem tem ouro insuficiente.');
        if (balance > 2147483647) throw new AppError(409, 'O personagem atingiu o limite de ouro.');
        if (reward.gold)
          await db.query('UPDATE characters SET gold_cp=$2 WHERE id=$1', [character, balance]);
        if (reward.item)
          await db.query(
            'INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,1) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+1',
            [character, reward.item],
          );
        await db.query(
          `INSERT INTO house2_gardens(plot_id,character_id,crop,ready_at,fertilized,compost,compost_ready_at,watered_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(plot_id,character_id) DO UPDATE SET
         crop=EXCLUDED.crop,ready_at=EXCLUDED.ready_at,fertilized=EXCLUDED.fertilized,
         compost=EXCLUDED.compost,compost_ready_at=EXCLUDED.compost_ready_at,watered_at=EXCLUDED.watered_at`,
          [
            plot,
            character,
            state.crop,
            state.ready_at,
            state.fertilized,
            state.compost,
            state.compost_ready_at,
            state.watered_at,
          ],
        );
        await db.query(
          'INSERT INTO house2_garden_actions(character_id,request_id,plot_id,action,gold_delta_cp,item_id) VALUES($1,$2,$3,$4,$5,$6)',
          [character, request, plot, payload, reward.gold, reward.item],
        );
        return {
          garden: serialize(state, balance, now),
          gold_delta_cp: reward.gold,
          item_id: reward.item,
        };
      }),
    );
  });
  return router;
}

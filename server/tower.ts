import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { isAdministrator, requireAdministrator } from './administrators.js';
import { AppError } from './services.js';
import { towerBaseReward, towerTreasure, towerFloorCount } from '../shared/tower.js';
import { monsterArt } from '../shared/vtt-monster-art.js';
import { purchaseContents } from '../shared/armor-bundles.js';
const uuid = z.string().uuid();
const floorNumber = z.coerce.number().int().min(1).max(towerFloorCount);
const floorInput = z
  .object({
    revision: z.number().int().min(0),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(3000),
    challenge: z.string().trim().max(3000),
    hazard: z.string().trim().max(3000),
    traps: z.string().trim().max(3000),
    creatures: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            art: z
              .string()
              .trim()
              .max(100)
              .refine(
                (value) => !value || !!monsterArt('', value),
                'Escolha uma arte do catálogo.',
              ),
          })
          .strict(),
      )
      .max(30),
    boss: z.boolean(),
    boss_name: z.string().trim().max(100),
    base_gold_cp: z.number().int().min(0).max(100000000).nullable(),
    base_crystals: z.number().int().min(0).max(1000000).nullable(),
  })
  .strict();
const rewardInput = z
  .object({
    revision: z.number().int().min(0),
    rows: z
      .array(
        z
          .object({
            min: z.number().int().min(1).max(100),
            max: z.number().int().min(1).max(100),
            rarity: z.string().trim().min(1).max(40),
            relic: z.string().trim().min(1).max(150),
            gold_cp: z.number().int().min(0).max(100000000),
            crystals: z.number().int().min(0).max(1000000),
            item_id: z.string().trim().min(1).max(100).nullable(),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine((input) => {
    let next = 1;
    for (const row of input.rows) {
      if (row.min !== next || row.max < row.min) return false;
      next = row.max + 1;
    }
    return next === 101;
  }, 'As faixas precisam cobrir de 1 a 100 em ordem, sem lacunas nem sobreposições.');
const operation = z
  .object({
    revision: z.number().int().min(0),
    action: z.enum(['start', 'clear', 'finish', 'cancel']),
    defeat_boss: z.boolean().optional(),
    summary: z.string().trim().max(1500).optional(),
  })
  .strict();
export function towerRouter() {
  const router = Router();
  router.get('/tower', async (_req, res) => {
    const user = res.locals.user.id,
      canCreate = await isAdministrator(user);
    const runs = (
      await pool.query(
        `SELECT id,name,status,cleared_floor,bosses,revision,summary,created_at,
   (master_id=$1 AND $2::boolean) AS can_manage FROM tower_expeditions
   ORDER BY CASE WHEN status IN ('preparing','active') THEN 0 ELSE 1 END,created_at DESC LIMIT 80`,
        [user, canCreate],
      )
    ).rows;
    const members = (
      await pool.query(
        `SELECT m.run_id,m.character_id,c.name,c.level,(c.user_id=$1) AS mine,
       CASE WHEN c.portrait_revision>0 THEN '/api/profiles/'||c.user_id||'/characters/'||c.id||'/portrait?thumb=1&v='||c.portrait_revision ELSE '' END AS image
   FROM tower_members m JOIN characters c ON c.id=m.character_id WHERE m.run_id=ANY($2::uuid[]) AND c.deleted_at IS NULL ORDER BY c.name,c.id`,
        [user, runs.map((r) => r.id)],
      )
    ).rows;
    const wallets = (
      await pool.query(
        `SELECT w.character_id,w.crystals FROM tower_wallets w JOIN characters c ON c.id=w.character_id WHERE c.user_id=$1 AND c.deleted_at IS NULL`,
        [user],
      )
    ).rows;
    const claims = (
      await pool.query(
        `SELECT t.*,c.name,r.name AS expedition,CASE WHEN i.id IS NOT NULL THEN jsonb_build_object('id',i.id,'name',i.name,'description',i.description,'image_path',i.image_path,'category',i.category) ELSE NULL END AS item FROM tower_claims t JOIN characters c ON c.id=t.character_id JOIN tower_expeditions r ON r.id=t.run_id LEFT JOIN catalog_items i ON i.id=t.item_id WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY t.created_at DESC LIMIT 100`,
        [user],
      )
    ).rows;
    const discovery = (
      await pool.query(
        `SELECT
      COALESCE((SELECT max(cleared_floor) FROM tower_expeditions),0)::int AS guild_floor,
      COALESCE((SELECT max(r.cleared_floor) FROM tower_expeditions r JOIN tower_members m ON m.run_id=r.id JOIN characters c ON c.id=m.character_id WHERE c.user_id=$1 AND c.deleted_at IS NULL),0)::int AS personal_floor`,
        [user],
      )
    ).rows[0];
    const floors = (await pool.query('SELECT * FROM tower_floors ORDER BY number')).rows.map(
      (f) => {
        const access = canCreate
          ? 'master'
          : f.number <= discovery.personal_floor
            ? 'personal'
            : f.number <= discovery.guild_floor
              ? 'guild'
              : 'hidden';
        return {
          number: f.number,
          name: f.name,
          description: f.description,
          boss: f.boss,
          revision: f.revision,
          discovery: access,
          base_gold_cp: f.base_gold_cp,
          base_crystals: f.base_crystals,
          challenge: access === 'hidden' ? null : f.challenge,
          hazard: access === 'hidden' ? null : f.hazard,
          traps: access === 'hidden' ? null : f.traps,
          creatures: access === 'hidden' ? null : f.creatures,
          boss_name: access === 'hidden' ? null : f.boss_name,
        };
      },
    );
    res.json({
      can_create: canCreate,
      floors,
      reward_tables: (
        await pool.query('SELECT tier,revision,rows FROM tower_reward_tables ORDER BY tier')
      ).rows,
      expeditions: runs.map((r) => ({
        ...r,
        members: members.filter((m) => m.run_id === r.id).map(({ run_id, ...m }) => m),
      })),
      wallets,
      claims,
    });
  });
  router.post('/tower/floors/:number', async (req, res) => {
    const number = floorNumber.parse(req.params.number),
      input = floorInput.parse(req.body);
    await transaction(async (c) => {
      await requireAdministrator(res.locals.user.id, c);
      const changed = await c.query(
        `UPDATE tower_floors SET name=$2,description=$3,challenge=$4,hazard=$5,traps=$6,creatures=$7,boss=$8,boss_name=$9,base_gold_cp=$11,base_crystals=$12,revision=revision+1,updated_at=now() WHERE number=$1 AND revision=$10 RETURNING number`,
        [
          number,
          input.name,
          input.description,
          input.challenge,
          input.hazard,
          input.traps,
          JSON.stringify(input.creatures),
          input.boss,
          input.boss ? input.boss_name : '',
          input.revision,
          input.base_gold_cp,
          input.base_crystals,
        ],
      );
      if (!changed.rowCount) throw new AppError(409, 'Este andar mudou. Atualize antes de editar.');
    });
    res.json({ ok: true });
  });
  router.post('/tower/rewards/:tier', async (req, res) => {
    const tier = z.coerce.number().int().min(0).max(towerFloorCount).parse(req.params.tier),
      input = rewardInput.parse(req.body);
    await transaction(async (c) => {
      await requireAdministrator(res.locals.user.id, c);
      const ids = [...new Set(input.rows.flatMap((r) => (r.item_id ? [r.item_id] : [])))];
      if (ids.length) {
        const found = await c.query(
          'SELECT id FROM catalog_items WHERE id=ANY($1::text[]) AND active=true FOR SHARE',
          [ids],
        );
        if (found.rowCount !== ids.length)
          throw new AppError(400, 'Escolha itens disponíveis no catálogo.');
      }
      const result = await c.query(
        'UPDATE tower_reward_tables SET rows=$2,revision=revision+1,updated_at=now() WHERE tier=$1 AND revision=$3 RETURNING tier',
        [tier, JSON.stringify(input.rows), input.revision],
      );
      if (!result.rowCount) throw new AppError(409, 'A tabela mudou. Atualize antes de editar.');
    });
    res.json({ ok: true });
  });
  router.post('/tower/expeditions', async (req, res) => {
    const input = z
      .object({ name: z.string().trim().min(3).max(80) })
      .strict()
      .parse(req.body);
    const user = res.locals.user.id;
    const saved = await transaction(async (c) => {
      await requireAdministrator(user, c);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,742))', [user]);
      if (
        Number(
          (
            await c.query(
              "SELECT count(*) FROM tower_expeditions WHERE master_id=$1 AND status IN ('preparing','active')",
              [user],
            )
          ).rows[0].count,
        ) >= 5
      )
        throw new AppError(409, 'Conclua uma expedição antes de abrir outra.');
      return (
        await c.query(
          'INSERT INTO tower_expeditions(id,master_id,name) VALUES($1,$2,$3) RETURNING id',
          [randomUUID(), user, input.name],
        )
      ).rows[0];
    });
    res.status(201).json(saved);
  });
  router.post('/tower/expeditions/:id/join', async (req, res) => {
    const id = uuid.parse(req.params.id),
      { character_id } = z.object({ character_id: uuid }).strict().parse(req.body);
    await transaction(async (c) => {
      const run = (await c.query('SELECT * FROM tower_expeditions WHERE id=$1 FOR UPDATE', [id]))
        .rows[0];
      if (!run) throw new AppError(404, 'Expedição não encontrada.');
      const char = (
        await c.query(
          'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
          [character_id, res.locals.user.id],
        )
      ).rows[0];
      if (!char) throw new AppError(404, 'Personagem não encontrado.');
      if (run.status !== 'preparing')
        throw new AppError(409, 'A expedição já saiu da torre ou começou a subida.');
      if (
        (
          await c.query('SELECT 1 FROM tower_members WHERE run_id=$1 AND character_id=$2', [
            id,
            character_id,
          ])
        ).rowCount
      )
        return;
      if (
        (
          await c.query(
            "SELECT 1 FROM tower_members m JOIN tower_expeditions r ON r.id=m.run_id WHERE m.character_id=$1 AND r.status IN ('preparing','active')",
            [character_id],
          )
        ).rowCount
      )
        throw new AppError(409, 'Este personagem já está em uma expedição.');
      if (
        Number(
          (await c.query('SELECT count(*) FROM tower_members WHERE run_id=$1', [id])).rows[0].count,
        ) >= 8
      )
        throw new AppError(409, 'A expedição já tem oito personagens.');
      await c.query('INSERT INTO tower_members(run_id,character_id) VALUES($1,$2)', [
        id,
        character_id,
      ]);
      await c.query('UPDATE tower_expeditions SET revision=revision+1 WHERE id=$1', [id]);
    });
    res.json({ ok: true });
  });
  router.post('/tower/expeditions/:id/leave', async (req, res) => {
    const id = uuid.parse(req.params.id),
      { character_id } = z.object({ character_id: uuid }).strict().parse(req.body);
    await transaction(async (c) => {
      const run = (
        await c.query('SELECT status FROM tower_expeditions WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (!run) throw new AppError(404, 'Expedição não encontrada.');
      if (run.status !== 'preparing')
        throw new AppError(409, 'Só é possível sair antes de iniciar a subida.');
      const removed = await c.query(
        'DELETE FROM tower_members m USING characters c WHERE m.run_id=$1 AND m.character_id=$2 AND c.id=m.character_id AND c.user_id=$3 RETURNING m.character_id',
        [id, character_id, res.locals.user.id],
      );
      if (!removed.rowCount) throw new AppError(404, 'Inscrição não encontrada.');
      await c.query('UPDATE tower_expeditions SET revision=revision+1 WHERE id=$1', [id]);
    });
    res.json({ ok: true });
  });
  router.post('/tower/expeditions/:id/progress', async (req, res) => {
    const id = uuid.parse(req.params.id),
      input = operation.parse(req.body),
      user = res.locals.user.id;
    const result = await transaction(async (c) => {
      await requireAdministrator(user, c);
      const run = (await c.query('SELECT * FROM tower_expeditions WHERE id=$1 FOR UPDATE', [id]))
        .rows[0];
      if (!run || run.master_id !== user) throw new AppError(404, 'Expedição não encontrada.');
      if (input.action === 'finish' && run.status === 'completed') return { ok: true };
      if (run.revision !== input.revision)
        throw new AppError(409, 'A expedição mudou. Atualize antes de continuar.');
      const count = Number(
        (
          await c.query(
            'SELECT count(*) FROM tower_members m JOIN characters c ON c.id=m.character_id WHERE m.run_id=$1 AND c.deleted_at IS NULL',
            [id],
          )
        ).rows[0].count,
      );
      if (input.action === 'start') {
        if (run.status !== 'preparing' || !count)
          throw new AppError(409, 'Reúna pelo menos um personagem antes de iniciar.');
        await c.query(
          "UPDATE tower_expeditions SET status='active',revision=revision+1 WHERE id=$1",
          [id],
        );
      } else if (input.action === 'clear') {
        if (run.status !== 'active' || run.cleared_floor >= towerFloorCount)
          throw new AppError(409, 'Não há um próximo andar nesta expedição.');
        const floor = run.cleared_floor + 1;
        const content = (
          await c.query('SELECT boss FROM tower_floors WHERE number=$1 FOR SHARE', [floor])
        ).rows[0];
        if (content.boss && !input.defeat_boss)
          throw new AppError(409, 'Confirme a derrota do guardião para concluir este andar.');
        const bosses = content.boss ? [...run.bosses, floor] : run.bosses;
        await c.query(
          'UPDATE tower_expeditions SET cleared_floor=$2,bosses=$3,revision=revision+1 WHERE id=$1',
          [id, floor, JSON.stringify(bosses)],
        );
      } else if (input.action === 'finish') {
        if (run.status !== 'active' || !run.cleared_floor || !count)
          throw new AppError(409, 'Conclua pelo menos um andar antes de retornar.');
        const base = towerBaseReward(run.cleared_floor, run.bosses);
        const content = (
          await c.query(
            'SELECT base_gold_cp,base_crystals FROM tower_floors WHERE number=$1 FOR SHARE',
            [run.cleared_floor],
          )
        ).rows[0];
        base.gold_cp = content.base_gold_cp ?? base.gold_cp;
        base.crystals = content.base_crystals ?? base.crystals;
        const loot = (
          await c.query('SELECT rows FROM tower_reward_tables WHERE tier=$1 FOR SHARE', [base.tier])
        ).rows[0].rows;
        const chars = (
          await c.query(
            'SELECT c.id FROM tower_members m JOIN characters c ON c.id=m.character_id WHERE m.run_id=$1 AND c.deleted_at IS NULL ORDER BY c.id FOR UPDATE OF c',
            [id],
          )
        ).rows;
        for (const char of chars) {
          await c.query(
            'INSERT INTO tower_claims(run_id,character_id,floor,tier,base_gold_cp,base_crystals,loot_table) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [id, char.id, base.floor, base.tier, base.gold_cp, base.crystals, JSON.stringify(loot)],
          );
          await c.query('UPDATE characters SET gold_cp=gold_cp+$2 WHERE id=$1', [
            char.id,
            base.gold_cp,
          ]);
          await c.query(
            'INSERT INTO tower_wallets(character_id,crystals) VALUES($1,$2) ON CONFLICT(character_id) DO UPDATE SET crystals=tower_wallets.crystals+EXCLUDED.crystals',
            [char.id, base.crystals],
          );
        }
        await c.query(
          "UPDATE tower_expeditions SET status='completed',summary=$2,completed_at=now(),revision=revision+1 WHERE id=$1",
          [id, input.summary || ''],
        );
      } else {
        if (!['preparing', 'active'].includes(run.status))
          throw new AppError(409, 'A expedição já foi encerrada.');
        await c.query(
          "UPDATE tower_expeditions SET status='cancelled',summary=$2,completed_at=now(),revision=revision+1 WHERE id=$1",
          [id, input.summary || ''],
        );
      }
      return { ok: true };
    });
    res.json(result);
  });
  router.post('/tower/expeditions/:id/treasure', async (req, res) => {
    const id = uuid.parse(req.params.id),
      { character_id } = z.object({ character_id: uuid }).strict().parse(req.body);
    const result = await transaction(async (c) => {
      const char = (
        await c.query(
          'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
          [character_id, res.locals.user.id],
        )
      ).rows[0];
      if (!char) throw new AppError(404, 'Personagem não encontrado.');
      const claim = (
        await c.query('SELECT * FROM tower_claims WHERE run_id=$1 AND character_id=$2 FOR UPDATE', [
          id,
          character_id,
        ])
      ).rows[0];
      if (!claim)
        throw new AppError(409, 'O mestre precisa concluir a expedição antes de abrir o tesouro.');
      if (claim.roll !== null) return claim;
      const roll = randomInt(1, 101),
        reward =
          claim.loot_table?.find((r: any) => roll >= r.min && roll <= r.max) ||
          towerTreasure(claim.tier, roll);
      if (reward.item_id) {
        for (const granted of purchaseContents(reward.item_id)) {
          await c.query(
            'INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity',
            [character_id, granted, reward.quantity],
          );
          await c.query(
            'INSERT INTO tower_item_grants(run_id,character_id,item_id,quantity) VALUES($1,$2,$3,$4)',
            [id, character_id, granted, reward.quantity],
          );
        }
      }
      await c.query('UPDATE characters SET gold_cp=gold_cp+$2 WHERE id=$1', [
        character_id,
        reward.gold_cp,
      ]);
      await c.query('UPDATE tower_wallets SET crystals=crystals+$2 WHERE character_id=$1', [
        character_id,
        reward.crystals,
      ]);
      return (
        await c.query(
          'UPDATE tower_claims SET roll=$3,rarity=$4,relic=$5,bonus_gold_cp=$6,bonus_crystals=$7,item_id=$8,item_quantity=$9,rolled_at=now() WHERE run_id=$1 AND character_id=$2 RETURNING *',
          [
            id,
            character_id,
            roll,
            reward.rarity,
            reward.relic,
            reward.gold_cp,
            reward.crystals,
            reward.item_id,
            reward.item_id ? reward.quantity : 0,
          ],
        )
      ).rows[0];
    });
    res.json(result);
  });
  return router;
}

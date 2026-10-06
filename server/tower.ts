import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { isAdministrator, requireAdministrator } from './administrators.js';
import { AppError } from './services.js';
import { towerBaseReward, towerTreasure } from '../shared/tower.js';
const uuid = z.string().uuid();
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
        `SELECT t.*,c.name,r.name AS expedition FROM tower_claims t JOIN characters c ON c.id=t.character_id JOIN tower_expeditions r ON r.id=t.run_id WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY t.created_at DESC LIMIT 100`,
        [user],
      )
    ).rows;
    res.json({
      can_create: canCreate,
      expeditions: runs.map((r) => ({
        ...r,
        members: members.filter((m) => m.run_id === r.id).map(({ run_id, ...m }) => m),
      })),
      wallets,
      claims,
    });
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
        if (run.status !== 'active' || run.cleared_floor >= 30)
          throw new AppError(409, 'Não há um próximo andar nesta expedição.');
        const floor = run.cleared_floor + 1;
        if (floor % 5 === 0 && !input.defeat_boss)
          throw new AppError(409, 'Confirme a derrota do guardião para concluir este andar.');
        const bosses = floor % 5 === 0 ? [...run.bosses, floor] : run.bosses;
        await c.query(
          'UPDATE tower_expeditions SET cleared_floor=$2,bosses=$3,revision=revision+1 WHERE id=$1',
          [id, floor, JSON.stringify(bosses)],
        );
      } else if (input.action === 'finish') {
        if (run.status !== 'active' || !run.cleared_floor || !count)
          throw new AppError(409, 'Conclua pelo menos um andar antes de retornar.');
        const base = towerBaseReward(run.cleared_floor, run.bosses);
        const chars = (
          await c.query(
            'SELECT c.id FROM tower_members m JOIN characters c ON c.id=m.character_id WHERE m.run_id=$1 AND c.deleted_at IS NULL ORDER BY c.id FOR UPDATE OF c',
            [id],
          )
        ).rows;
        for (const char of chars) {
          await c.query(
            'INSERT INTO tower_claims(run_id,character_id,floor,tier,base_gold_cp,base_crystals) VALUES($1,$2,$3,$4,$5,$6)',
            [id, char.id, base.floor, base.tier, base.gold_cp, base.crystals],
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
        reward = towerTreasure(claim.tier, roll);
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
          'UPDATE tower_claims SET roll=$3,rarity=$4,relic=$5,bonus_gold_cp=$6,bonus_crystals=$7,rolled_at=now() WHERE run_id=$1 AND character_id=$2 RETURNING *',
          [id, character_id, roll, reward.rarity, reward.relic, reward.gold_cp, reward.crystals],
        )
      ).rows[0];
    });
    res.json(result);
  });
  return router;
}

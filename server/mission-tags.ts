import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Pool, PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { requireAdministrator, isAdministrator } from './administrators.js';
import { AppError } from './services.js';
import { refreshTagAchievements } from './mission-tag-progress.js';
import { houseCatalog } from '../shared/house.js';
import {
  missionTagIds,
  tagSchema,
  tagAchievementSchema,
  tagCodePattern,
  type TagReward,
} from '../shared/mission-tags.js';

const uuid = z.string().uuid();
const codeSchema = z.string().regex(tagCodePattern);
const canonical = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
export async function tagDefinitions(db: Pool | PoolClient = pool) {
  return (
    await db.query(
      'SELECT code,title,description,revision,tag_id,target::text,rewards,active FROM tag_achievements ORDER BY tag_id,target,code',
    )
  ).rows;
}
export async function setMissionTags(db: PoolClient, postId: string, ids: string[]) {
  if (ids.length) {
    const { rows } = await db.query(
      'SELECT id FROM mission_tags WHERE id=ANY($1::uuid[]) AND active ORDER BY id FOR SHARE',
      [ids],
    );
    if (rows.length !== ids.length)
      throw new AppError(400, 'Escolha apenas tags disponíveis, sem repetição.');
  }
  await db.query('DELETE FROM mission_post_tags WHERE post_id=$1', [postId]);
  for (const id of [...ids].sort())
    await db.query('INSERT INTO mission_post_tags(post_id,tag_id) VALUES($1,$2)', [postId, id]);
}
async function rewardsFromCatalog(
  db: PoolClient,
  input: z.infer<typeof tagAchievementSchema>['rewards'],
) {
  const rewards: TagReward[] = [];
  for (const reward of input) {
    if (reward.kind === 'house') {
      const item = houseCatalog.find((i) => i.id === reward.ref);
      if (!item) throw new AppError(400, 'Item de house não encontrado.');
      rewards.push({ ...reward, name: item.name, image: item.image });
    } else if (reward.kind === 'title') {
      uuid.parse(reward.ref);
      const {
        rows: [item],
      } = await db.query(
        'SELECT document FROM title_catalog WHERE id=$1 AND deleted_at IS NULL FOR SHARE',
        [reward.ref],
      );
      if (!item) throw new AppError(400, 'Título não encontrado.');
      rewards.push({ ...reward, name: item.document.name });
    } else {
      const {
        rows: [item],
      } = await db.query('SELECT name,image_path FROM catalog_items WHERE id=$1 FOR SHARE', [
        reward.ref,
      ]);
      if (!item) throw new AppError(400, 'Roupa ou equipamento não encontrado.');
      rewards.push({ ...reward, name: item.name, image: item.image_path });
    }
  }
  return rewards;
}
async function unique<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if ((error as { code?: string }).code === '23505')
      throw new AppError(
        409,
        'Já existe uma tag com esse nome ou uma conquista para essa quantidade.',
      );
    throw error;
  }
}
export function missionTagsRouter() {
  const router = Router();
  router.get('/mission-tags/catalog', async (_req, res) => {
    const can_edit = await isAdministrator(res.locals.user.id);
    const tags = (
      await pool.query(
        'SELECT id,name,description,active,revision FROM mission_tags ORDER BY name,id',
      )
    ).rows;
    const achievements = (
      await pool.query(
        `SELECT a.*,a.target::text,EXISTS(SELECT 1 FROM tag_achievement_grants g WHERE g.code=a.code) AS awarded FROM tag_achievements a ORDER BY a.tag_id,a.target,a.code`,
      )
    ).rows;
    res.json({
      can_edit,
      tags,
      achievements: achievements.map(({ created_by, created_at, ...a }) => ({
        ...a,
        awarded: can_edit && a.awarded,
      })),
    });
  });
  router.get('/mission-tags/reward-options', async (_req, res) => {
    await requireAdministrator(res.locals.user.id);
    const titles = (
      await pool.query(
        "SELECT id,document FROM title_catalog WHERE deleted_at IS NULL ORDER BY document->>'name',id",
      )
    ).rows;
    const items = (
      await pool.query('SELECT id,name,category,image_path FROM catalog_items ORDER BY name,id')
    ).rows;
    res.json([
      ...titles.map((t) => ({ kind: 'title', ref: t.id, name: t.document.name })),
      ...items.map((i) => ({
        kind: 'item',
        ref: i.id,
        name: i.name,
        category: i.category,
        image: i.image_path,
      })),
      ...houseCatalog.map((i) => ({ kind: 'house', ref: i.id, name: i.name, image: i.image })),
    ]);
  });
  router.post('/mission-tags/catalog', async (req, res) => {
    const input = tagSchema.parse(req.body);
    const result = await unique(() =>
      transaction(async (db) => {
        await requireAdministrator(res.locals.user.id, db);
        return (
          await db.query(
            'INSERT INTO mission_tags(name,canonical_name,description,active,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,name,description,active,revision',
            [
              input.name,
              canonical(input.name),
              input.description,
              input.active,
              res.locals.user.id,
            ],
          )
        ).rows[0];
      }),
    );
    res.status(201).json(result);
  });
  router.put('/mission-tags/catalog/:id', async (req, res) => {
    const { revision, ...raw } = z
        .object({ revision: z.number().int().min(1) })
        .passthrough()
        .parse(req.body),
      input = tagSchema.parse(raw),
      id = uuid.parse(req.params.id);
    const result = await unique(() =>
      transaction(async (db) => {
        await requireAdministrator(res.locals.user.id, db);
        const r = await db.query(
          'UPDATE mission_tags SET name=$2,canonical_name=$3,description=$4,active=$5,revision=revision+1 WHERE id=$1 AND revision=$6 RETURNING id,name,description,active,revision',
          [id, input.name, canonical(input.name), input.description, input.active, revision],
        );
        if (!r.rowCount) throw new AppError(409, 'A tag mudou. Reabra sua versão atual.');
        return r.rows[0];
      }),
    );
    res.json(result);
  });
  for (const method of ['post', 'put'] as const)
    router[method](
      method === 'post' ? '/mission-tags/achievements' : '/mission-tags/achievements/:code',
      async (req, res) => {
        const { revision, ...raw } =
          method === 'put'
            ? z
                .object({ revision: z.number().int().min(1) })
                .passthrough()
                .parse(req.body)
            : { revision: 0, ...req.body };
        const input = tagAchievementSchema.parse(raw),
          code =
            method === 'post'
              ? 'tag_' + randomUUID()
              : codeSchema.parse((req.params as Record<string, string>).code);
        const result = await unique(() =>
          transaction(async (db) => {
            await requireAdministrator(res.locals.user.id, db);
            const current = (
              await db.query('SELECT * FROM tag_achievements WHERE code=$1 FOR UPDATE', [code])
            ).rows[0];
            if (method === 'put' && (!current || current.revision !== revision))
              throw new AppError(409, 'A conquista mudou. Reabra sua versão atual.');
            if (
              !(await db.query('SELECT id FROM mission_tags WHERE id=$1', [input.tag_id])).rowCount
            )
              throw new AppError(400, 'Tag não encontrada.');
            const awarded = Boolean(
              (await db.query('SELECT 1 FROM tag_achievement_grants WHERE code=$1 LIMIT 1', [code]))
                .rowCount,
            );
            const identity = (rs: { kind: string; ref: string; quantity: number }[]) =>
              JSON.stringify(rs.map(({ kind, ref, quantity }) => ({ kind, ref, quantity })));
            if (
              awarded &&
              (input.tag_id !== current.tag_id ||
                input.target !== current.target ||
                identity(input.rewards) !== identity(current.rewards))
            )
              throw new AppError(
                409,
                'Uma conquista já entregue conserva sua meta e suas recompensas. Crie outra conquista para uma nova regra.',
              );
            const rewards = awarded ? current.rewards : await rewardsFromCatalog(db, input.rewards);
            if (current)
              await db.query(
                'UPDATE tag_achievements SET tag_id=$2,target=$3,title=$4,description=$5,active=$6,rewards=$7,revision=revision+1 WHERE code=$1',
                [
                  code,
                  input.tag_id,
                  input.target,
                  input.title,
                  input.description,
                  input.active,
                  JSON.stringify(rewards),
                ],
              );
            else
              await db.query(
                'INSERT INTO tag_achievements(code,tag_id,target,title,description,active,rewards,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
                [
                  code,
                  input.tag_id,
                  input.target,
                  input.title,
                  input.description,
                  input.active,
                  JSON.stringify(rewards),
                  res.locals.user.id,
                ],
              );
            return {
              ...(
                await db.query(
                  'SELECT code,tag_id,target::text,title,description,active,rewards,revision FROM tag_achievements WHERE code=$1',
                  [code],
                )
              ).rows[0],
              awarded,
            };
          }),
        );
        res.status(method === 'post' ? 201 : 200).json(result);
      },
    );
  router.patch('/board/:id/tags', async (req, res) => {
    const { tag_ids } = z.object({ tag_ids: missionTagIds }).strict().parse(req.body),
      id = uuid.parse(req.params.id);
    await transaction(async (db) => {
      const mission = (
        await db.query('SELECT author_id,kind,status FROM board_posts WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (
        !mission ||
        (mission.author_id !== res.locals.user.id &&
          !(await isAdministrator(res.locals.user.id, db)))
      )
        throw new AppError(
          403,
          'Somente o criador ou administrador pode editar as tags da missão.',
        );
      if (mission.kind !== 'mission' || !['open', 'active'].includes(mission.status))
        throw new AppError(409, 'As tags de uma missão encerrada ficam preservadas.');
      await setMissionTags(db, id, tag_ids);
    });
    res.json({ ok: true });
  });
  router.get('/characters/:id/tags', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const result = await transaction(async (db) => {
      if (
        !(
          await db.query(
            'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
            [id, res.locals.user.id],
          )
        ).rowCount
      )
        throw new AppError(404, 'Personagem não encontrado.');
      await refreshTagAchievements(db, id);
      const totals = (
        await db.query(
          'SELECT tag_id,total::text FROM character_tag_totals WHERE character_id=$1 ORDER BY tag_id',
          [id],
        )
      ).rows;
      const grants = (
        await db.query(
          'SELECT code,awarded_at,rewards FROM tag_achievement_grants WHERE character_id=$1 ORDER BY awarded_at,code',
          [id],
        )
      ).rows;
      return { totals, grants };
    });
    res.json(result);
  });
  return router;
}

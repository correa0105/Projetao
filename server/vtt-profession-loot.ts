import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { canManageVtt } from './vtt-permissions.js';
import { completeMissionInTransaction } from './missions.js';
import { settleProfessionReward } from './profession-loot.js';
import { enrichMaterialRoster, professionLootProfiles } from './profession-loot-levels.js';
import {
  materialOutcome,
  professionLootMaterials,
  professionLootTable,
  professionMaterialLevel,
  materialChanceLimit,
  type MaterialRosterPlayer,
  type ProfessionLootTable,
} from '../shared/profession-loot.js';
import { professions, professionMaterials, materialItemId } from '../shared/professions.js';
type DB = Pick<PoolClient, 'query'>;
type AccessRoom = {
  id: string;
  owner_id: string;
  administrator: boolean;
  administrator_user_id?: string;
  role: 'player' | 'spectator' | null;
};
type Access = (db: DB, id: string, user: string, lock?: boolean) => Promise<AccessRoom>;
const uuid = z.string().uuid();
const tableSchema = z
  .object({
    profession_id: z.string().max(50),
    min_level: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(10)]),
    entries: z
      .array(
        z
          .object({
            item_id: z.string().max(100),
            chance: z.number().int().min(1).max(100),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1)
      .max(23),
  })
  .strict();
const openSchema = z
  .object({
    request_id: uuid,
    title: z.string().trim().min(3).max(150),
    mission_id: uuid.nullable(),
    character_ids: z.array(uuid).max(200).default([]),
    tables: z.array(tableSchema).min(1).max(100),
  })
  .strict();
async function registered(db: DB, roomId: string, owner: string) {
  return (
    await db.query(
      `SELECT u.id,u.name,json_agg(json_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) AS characters FROM "user" u JOIN characters c ON c.user_id=u.id AND c.deleted_at IS NULL WHERE u.id=$2 OR EXISTS(SELECT 1 FROM vtt_members m WHERE m.room_id=$1 AND m.user_id=u.id AND m.role='player') GROUP BY u.id,u.name ORDER BY u.name,u.id`,
      [roomId, owner],
    )
  ).rows as MaterialRosterPlayer[];
}
async function missionRoster(db: DB, id: string) {
  return (
    await db.query(
      `SELECT u.id,u.name,json_agg(json_build_object('id',c.id,'name',c.name)ORDER BY c.name,c.id)AS characters FROM mission_participants p JOIN characters c ON c.id=p.character_id AND c.deleted_at IS NULL JOIN "user" u ON u.id=c.user_id WHERE p.post_id=$1 GROUP BY u.id,u.name ORDER BY u.name,u.id`,
      [id],
    )
  ).rows as MaterialRosterPlayer[];
}
async function rewardState(db: DB, r: AccessRoom, user: string) {
  const isGM = canManageVtt(r, user);
  const rows = (
    await db.query(
      'SELECT * FROM vtt_profession_rewards WHERE room_id=$1 ORDER BY created_at DESC,id DESC LIMIT 16',
      [r.id],
    )
  ).rows;
  for (const run of rows)
    run.rolls = (
      await db.query(
        'SELECT id,player_id,character_id,profession_id,profession_level,table_level,multiplier,value,item_id,quantity,rolled_by,created_at,granted_at FROM vtt_profession_reward_rolls WHERE reward_id=$1 ORDER BY created_at,id',
        [run.id],
      )
    ).rows;
  for (const run of rows.filter((row) => !row.completed_at))
    run.roster = await enrichMaterialRoster(db, run.roster);
  const missions = isGM
    ? (
        await db.query(
          "SELECT id,title,status FROM board_posts WHERE kind='mission' AND author_id=$1 AND status IN('active','completed') AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM vtt_profession_rewards l WHERE l.mission_id=board_posts.id) ORDER BY starts_at DESC,id DESC LIMIT 40",
          [r.owner_id],
        )
      ).rows
    : [];
  for (const mission of missions) mission.roster = await missionRoster(db, mission.id);
  return {
    current: rows.find((row) => !row.completed_at) ?? null,
    history: rows.filter((row) => row.completed_at),
    missions,
    registered: isGM ? await registered(db, r.id, r.owner_id) : [],
    is_gm: isGM,
    user_id: user,
  };
}
function checkTables(tables: ProfessionLootTable[]) {
  if (new Set(tables.map((t) => t.profession_id + ':' + t.min_level)).size !== tables.length)
    throw new AppError(400, 'Não repita a mesma faixa de nível de uma profissão.');
  for (const table of tables) {
    if (
      table.entries.some(
        (e) => e.chance > materialChanceLimit(table.profession_id, e.item_id, table.min_level),
      )
    )
      throw new AppError(
        400,
        'Materiais avançados e de itens valiosos precisam respeitar sua raridade.',
      );
    if (!professions.some((p) => p.id === table.profession_id))
      throw new AppError(400, 'Profissão inválida.');
    const eligible = new Set(professionLootMaterials(table.profession_id));
    if (
      table.entries.some(
        (e) =>
          !eligible.has(e.item_id) ||
          professionMaterialLevel(table.profession_id, e.item_id) > table.min_level,
      ) ||
      new Set(table.entries.map((e) => e.item_id)).size !== table.entries.length
    )
      throw new AppError(
        400,
        'Use somente materiais desta profissão liberados para a faixa de nível, sem repetir.',
      );
    if (table.entries.reduce((sum, e) => sum + e.chance, 0) > 90)
      throw new AppError(
        400,
        'As chances básicas não podem passar de 90%; resultados 91 a 100 dão materiais em dobro.',
      );
  }
}
export function vttProfessionLootRouter(room: Access, gm: Access) {
  const router = Router();
  router.get('/vtt/rooms/:id/material-rewards', async (req, res) => {
    const r = await room(pool, uuid.parse(req.params.id), res.locals.user.id);
    res.set('Cache-Control', 'no-store').json(await rewardState(pool, r, res.locals.user.id));
  });
  router.post('/vtt/rooms/:id/material-rewards/presence', async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id;
    z.object({}).strict().parse(req.body);
    const r = await room(pool, id, user);
    if (r.role === 'spectator' && !canManageVtt(r, user))
      throw new AppError(403, 'Espectadores não participam dos sorteios.');
    await pool.query(
      'UPDATE vtt_members SET last_seen_at=clock_timestamp() WHERE room_id=$1 AND user_id=$2',
      [id, user],
    );
    if (r.owner_id === user)
      await pool.query(
        'UPDATE vtt_rooms SET material_owner_seen_at=clock_timestamp() WHERE id=$1 AND owner_id=$2',
        [id, user],
      );
    res.json({ ok: true });
  });
  router.post('/vtt/rooms/:id/material-rewards', async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id,
      b = openSchema.parse(req.body);
    checkTables(b.tables);
    res.json(
      await transaction(async (db) => {
        const r = await gm(db, id, user, true);
        const previous = (
          await db.query(
            'SELECT * FROM vtt_profession_rewards WHERE room_id=$1 AND request_id=$2',
            [id, b.request_id],
          )
        ).rows[0];
        if (previous) {
          if (!isDeepStrictEqual(previous.request_payload, b))
            throw new AppError(409, 'Esta solicitação já foi usada para outra mesa.');
          return previous;
        }
        if (
          (
            await db.query(
              'SELECT 1 FROM vtt_profession_rewards WHERE room_id=$1 AND completed_at IS NULL',
              [id],
            )
          ).rowCount
        )
          throw new AppError(409, 'Conclua o registro de recompensas atual antes de abrir outro.');
        let roster: MaterialRosterPlayer[];
        if (b.mission_id) {
          const mission = (
            await db.query(
              "SELECT id FROM board_posts WHERE id=$1 AND author_id=$2 AND kind='mission' AND status IN('active','completed') AND deleted_at IS NULL",
              [b.mission_id, r.owner_id],
            )
          ).rows[0];
          if (!mission)
            throw new AppError(
              403,
              'Vincule uma missão em andamento ou concluída do mestre desta mesa.',
            );
          if (
            (
              await db.query('SELECT 1 FROM vtt_profession_rewards WHERE mission_id=$1', [
                b.mission_id,
              ])
            ).rowCount
          )
            throw new AppError(409, 'Esta missão já liberou seus d100.');
          roster = await missionRoster(db, b.mission_id);
        } else {
          const available = await registered(db, id, r.owner_id),
            selected = new Set(b.character_ids);
          if (
            selected.size !== b.character_ids.length ||
            b.character_ids.some(
              (cid) => !available.some((p) => p.characters.some((c) => c.id === cid)),
            )
          )
            throw new AppError(400, 'Escolha personagens dos jogadores inscritos nesta mesa.');
          roster = available
            .map((p) => ({ ...p, characters: p.characters.filter((c) => selected.has(c.id)) }))
            .filter((p) => p.characters.length);
        }
        if (!roster.length)
          throw new AppError(
            400,
            'Inscreva ao menos um jogador com personagem para liberar os d100.',
          );
        return (
          await db.query(
            'INSERT INTO vtt_profession_rewards(room_id,mission_id,title,tables,roster,opened_by,request_id,request_payload)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING *',
            [
              id,
              b.mission_id,
              b.title,
              JSON.stringify(b.tables),
              JSON.stringify(await enrichMaterialRoster(db, roster)),
              user,
              b.request_id,
              JSON.stringify(b),
            ],
          )
        ).rows[0];
      }),
    );
  });
  router.post('/vtt/rooms/:id/material-rewards/:reward/roll', async (req, res) => {
    const id = uuid.parse(req.params.id),
      rid = uuid.parse(req.params.reward),
      user = res.locals.user.id;
    const b = z
      .object({
        request_id: uuid,
        player_id: z.string().min(1).max(200),
        character_id: uuid,
        profession_id: z.string().max(50),
      })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (db) => {
        const r = await room(db, id, user);
        const isGM = canManageVtt(r, user);
        if (r.role === 'spectator' && !isGM)
          throw new AppError(403, 'Espectadores não podem rolar recompensas.');
        if (b.player_id !== user && !isGM)
          throw new AppError(403, 'Você só pode usar seu próprio d100.');
        const run = (
          await db.query(
            'SELECT * FROM vtt_profession_rewards WHERE id=$1 AND room_id=$2 FOR UPDATE',
            [rid, id],
          )
        ).rows[0];
        if (!run) throw new AppError(404, 'Sorteio não encontrado.');
        const previous = (
          await db.query(
            'SELECT * FROM vtt_profession_reward_rolls WHERE reward_id=$1 AND(player_id=$2 OR request_id=$3)',
            [rid, b.player_id, b.request_id],
          )
        ).rows[0];
        if (previous) {
          if (
            previous.request_id === b.request_id &&
            previous.player_id === b.player_id &&
            previous.character_id === b.character_id &&
            previous.profession_id === b.profession_id
          )
            return previous;
          throw new AppError(
            409,
            'Este jogador já usou seu único d100 nesta mesa, inclusive se não encontrou material.',
          );
        }
        if (run.completed_at)
          throw new AppError(409, 'Esta mesa já teve sua conclusão registrada.');
        const player = (run.roster as MaterialRosterPlayer[]).find((p) => p.id === b.player_id);
        if (!player || !player.characters.some((c) => c.id === b.character_id))
          throw new AppError(403, 'Este personagem não está entre os inscritos deste sorteio.');
        if (b.player_id !== user) {
          const online = (
            await db.query(
              "SELECT 1 FROM vtt_members WHERE room_id=$1 AND user_id=$2 AND role='player' AND last_seen_at>clock_timestamp()-interval '70 seconds' UNION ALL SELECT 1 FROM vtt_rooms WHERE id=$1 AND owner_id=$2 AND material_owner_seen_at>clock_timestamp()-interval '70 seconds'",
              [id, b.player_id],
            )
          ).rowCount;
          if (online)
            throw new AppError(
              409,
              'Este jogador está na mesa e pode usar o próprio d100. O mestre pode rolar pelos ausentes.',
            );
        }
        const c = (
          await db.query(
            'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
            [b.character_id, b.player_id],
          )
        ).rows[0];
        if (!c) throw new AppError(409, 'O personagem inscrito não está mais disponível.');
        const profile = (await professionLootProfiles(db, [b.character_id])).get(b.character_id);
        const level =
          profile?.user_id === b.player_id
            ? profile.professions.find((p) => p.id === b.profession_id)?.level
            : undefined;
        const noProfession =
          b.profession_id === 'no-profession' &&
          profile?.user_id === b.player_id &&
          !profile.professions.some((p) => professionLootTable(run.tables, p.id, p.level));
        if (!level && !noProfession)
          throw new AppError(
            403,
            'Este personagem não tem a proficiência deste ofício na ficha concluída.',
          );
        const table = level ? professionLootTable(run.tables, b.profession_id, level) : undefined;
        if (!table && !noProfession)
          throw new AppError(400, 'Não há tabela liberada para o nível atual desta profissão.');
        if (
          table?.entries.some((e) => professionMaterialLevel(b.profession_id, e.item_id) > level!)
        )
          throw new AppError(409, 'A tabela contém material acima do nível atual do personagem.');
        const value = randomInt(1, 101),
          outcome = table ? materialOutcome(table.entries, value) : null;
        const roll = (
          await db.query(
            'INSERT INTO vtt_profession_reward_rolls(reward_id,player_id,character_id,profession_id,value,item_id,quantity,rolled_by,request_id,profession_level,table_level,multiplier)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)RETURNING *',
            [
              rid,
              b.player_id,
              b.character_id,
              b.profession_id,
              value,
              outcome?.item_id ?? null,
              outcome?.quantity ?? 0,
              user,
              b.request_id,
              level ?? 0,
              table?.min_level ?? 0,
              outcome?.multiplier ?? 1,
            ],
          )
        ).rows[0];
        await db.query(
          'INSERT INTO vtt_messages(room_id,author_id,author,text,roll)SELECT $1,u.id,u.name,$3,$4 FROM "user" u WHERE u.id=$2',
          [
            id,
            user,
            `${player.name} · ${professions.find((p) => p.id === b.profession_id)?.name ?? 'Sem ofício habilitado'}, nível ${level ?? 0} · d100: ${value}. ${outcome ? `${outcome.quantity} × ${professionMaterials.find((m) => materialItemId(m[0]) === outcome.item_id)?.[1]}${outcome.multiplier === 2 ? ' (bônus ×2)' : ''}, reservado para a conclusão.` : 'Nenhum material encontrado.'} Tentativa registrada.`,
            JSON.stringify({
              formula: '1d100',
              dice: [value],
              total: value,
              throws: [{ sides: 100, value }],
            }),
          ],
        );
        return roll;
      }),
    );
  });
  router.post('/vtt/rooms/:id/material-rewards/:reward/complete', async (req, res) => {
    const id = uuid.parse(req.params.id),
      rid = uuid.parse(req.params.reward),
      user = res.locals.user.id;
    const b = z
      .object({ summary: z.string().trim().min(10).max(5000) })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (db) => {
        await gm(db, id, user);
        const initial = (
          await db.query('SELECT * FROM vtt_profession_rewards WHERE id=$1 AND room_id=$2', [
            rid,
            id,
          ])
        ).rows[0];
        if (!initial) throw new AppError(404, 'Recompensas não encontradas.');
        if (initial.mission_id) {
          const mission = (
            await db.query('SELECT * FROM board_posts WHERE id=$1 FOR UPDATE', [initial.mission_id])
          ).rows[0];
          if (!mission || mission.deleted_at || !['active', 'completed'].includes(mission.status))
            throw new AppError(409, 'A missão vinculada não está disponível para conclusão.');
          if (mission.status === 'active') {
            const participants = (
              await db.query(
                'SELECT character_id FROM mission_participants WHERE post_id=$1 ORDER BY character_id',
                [mission.id],
              )
            ).rows;
            await completeMissionInTransaction(db, mission.id, user, {
              summary: b.summary,
              rewards: participants,
            });
            return (await db.query('SELECT * FROM vtt_profession_rewards WHERE id=$1', [rid]))
              .rows[0];
          }
        }
        return settleProfessionReward(db, rid, user, b.summary);
      }),
    );
  });
  return router;
}

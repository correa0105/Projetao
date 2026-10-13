import express from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { requireAdministrator, isAdministrator } from './administrators.js';
import { currentGoldUnlimited, spendGold } from './gold.js';
import { houseDefaultFacing } from '../shared/house.js';
import {
  communitySettingsSchema,
  guildDocumentSchema,
  guildRank,
  guildWeek,
  guildLevel,
  guildRooms,
  type CommunitySettings,
} from '../shared/guilds.js';
const uuid = z.string().uuid();
async function reserveName(db: PoolClient, name: string, id?: string) {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    'guild-name:' + name.toLowerCase(),
  ]);
  if (
    (
      await db.query(
        "SELECT 1 FROM player_guilds WHERE lower(document->>'name')=lower($1) AND ($2::uuid IS NULL OR id<>$2)",
        [name, id || null],
      )
    ).rowCount
  )
    throw new AppError(409, 'Uma guilda já usa este nome.');
}
function initialDecor(doc: z.infer<typeof guildDocumentSchema>) {
  if (doc.placements.length) return doc;
  const items = [
    ['bench', 'main', 0.55, 0.85, 0.25],
    ['chair', 'lounge', 0.36, 0.84, 0.19],
    ['table', 'meeting', 0.5, 0.83, 0.25],
    ['bench', 'meeting', 0.73, 0.87, 0.17],
    ['chest', 'forge', 0.71, 0.85, 0.13],
  ] as const;
  return {
    ...doc,
    placements: items.map(([catalog, room, x, y, scale]) => ({
      id: randomUUID(),
      catalog,
      room,
      x,
      y,
      scale,
      facing: houseDefaultFacing(catalog),
    })),
  };
}
export async function communitySettings(db: Pick<PoolClient, 'query'> = pool) {
  const {
    rows: [s],
  } = await db.query('SELECT * FROM community_settings WHERE singleton');
  return { document: communitySettingsSchema.parse(s?.document || {}), revision: s?.revision || 0 };
}
function checkRooms(
  doc: { placements: { room: string }[] },
  prestige: number,
  c: CommunitySettings,
) {
  for (const p of doc.placements) {
    const r = guildRooms.find((r) => r.id === p.room)!;
    if (!r.starter && guildLevel(prestige) < c.room_unlocks[r.id as keyof typeof c.room_unlocks])
      throw new AppError(403, 'Esta sala ainda não foi liberada pelo nível da guilda.');
  }
}
async function guild(db: PoolClient, id: string, uid: string, owner = false, characterId: string | null = null) {
  const {
    rows: [g],
  } = await db.query('SELECT * FROM player_guilds WHERE id=$1 FOR UPDATE', [id]);
  if (!g) throw new AppError(404, 'Guilda não encontrada.');
  const member = (await db.query(
    'SELECT 1 FROM player_guild_members WHERE guild_id=$1 AND user_id=$2 AND ($3::uuid IS NULL OR character_id=$3)',
    [id, uid, characterId],
  )).rowCount;
  if (!member || (owner && g.owner_id !== uid))
    throw new AppError(
      403,
      owner ? 'Somente o fundador pode administrar a guilda.' : 'Você não pertence a esta guilda.',
    );
  return g;
}
async function progress(db: Pick<PoolClient, 'query'>, id: string, week: string) {
  const {
    rows: [p],
  } = await db.query(
    `SELECT count(*)::int AS participations,count(DISTINCT r.post_id)::int AS missions,count(DISTINCT m.user_id)::int AS members FROM mission_rewards r JOIN player_guild_members m ON m.character_id=r.character_id WHERE m.guild_id=$1 AND r.awarded_at>=GREATEST(m.joined_at,$2::date::timestamptz) AND r.awarded_at<$2::date+interval '7 days'`,
    [id, week],
  );
  return p;
}
async function weeks(db: Pick<PoolClient, 'query'>, id: string) {
  const { document: c } = await communitySettings(db),
    week = guildWeek();
  for (const m of c.missions)
    await db.query(
      'INSERT INTO player_guild_weeks(guild_id,week,mission_id,template) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [id, week, m.id, JSON.stringify(m)],
    );
  const [result, p] = await Promise.all([
    db.query(
      'SELECT mission_id,template,claimed_at FROM player_guild_weeks WHERE guild_id=$1 AND week=$2 ORDER BY mission_id',
      [id, week],
    ),
    progress(db, id, week),
  ]);
  return { week, items: result.rows.map((m) => ({ ...m, progress: p[m.template.metric] })) };
}
export function guildsRouter() {
  const router = express.Router();
  // A selected character must belong to the authenticated account. Legacy callers
  // without a character retain the registered member's account context.
  router.use(/^\/guilds(?=\/|$)/, async (req, res, next) => {
    const characterId = req.query.character_id === undefined ? null : uuid.parse(req.query.character_id);
    if (characterId && !(await pool.query(
      'SELECT 1 FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
      [characterId, res.locals.user.id],
    )).rowCount) throw new AppError(404, 'Escolha um personagem seu.');
    res.locals.guildCharacterId = characterId;
    next();
  });
  router.get('/community/settings', async (_req, res) =>
    res.json({
      ...(await communitySettings()),
      can_edit: await isAdministrator(res.locals.user.id),
    }),
  );
  router.put('/community/settings', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const input = z
      .object({ document: communitySettingsSchema, revision: z.number().int().min(0) })
      .strict()
      .parse(req.body);
    const result = await pool.query(
      'UPDATE community_settings SET document=$1,revision=revision+1 WHERE singleton AND revision=$2 RETURNING *',
      [JSON.stringify(input.document), input.revision],
    );
    if (!result.rowCount) throw new AppError(409, 'A configuração mudou. Reabra o painel.');
    res.json(result.rows[0]);
  });
  router.get('/guilds', async (_req, res) => {
    const uid = res.locals.user.id;
    const [directory, mine, invites] = await Promise.all([
      pool.query(
        `SELECT g.id,g.document->>'name' AS name,g.document->'crest' AS crest,g.prestige,(SELECT count(*)::int FROM player_guild_members m WHERE m.guild_id=g.id) AS members FROM player_guilds g ORDER BY g.prestige DESC,g.created_at,g.id`,
      ),
      pool.query(`SELECT m.guild_id,m.character_id,c.name AS character_name FROM player_guild_members m JOIN characters c ON c.id=m.character_id WHERE m.user_id=$1`, [uid]),
      pool.query(
        `SELECT i.guild_id,g.document->>'name' AS name,g.document->'crest' AS crest FROM player_guild_invites i JOIN player_guilds g ON g.id=i.guild_id WHERE i.user_id=$1`,
        [uid],
      ),
    ]);
    res.json({
      items: directory.rows.map((g) => ({ ...g, rank: guildRank(g.prestige) })),
      mine: mine.rows[0] && (!res.locals.guildCharacterId || mine.rows[0].character_id === res.locals.guildCharacterId) ? mine.rows[0].guild_id : null,
      membership: mine.rows[0] || null,
      invites: invites.rows,
    });
  });
  router.post('/guilds', async (req, res) => {
    const uid = res.locals.user.id,
      input = z
        .object({ character_id: uuid, request_id: uuid, document: guildDocumentSchema })
        .strict()
        .parse(req.body);
    const saved = await transaction(async (db) => {
      const unlimited = await currentGoldUnlimited(db, uid);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['guild-user:' + uid]);
      const {
        rows: [old],
      } = await db.query('SELECT id,owner_id FROM player_guilds WHERE request_id=$1', [
        input.request_id,
      ]);
      if (old) {
        if (old.owner_id !== uid) throw new AppError(403, 'Pedido de outra conta.');
        return { id: old.id, replayed: true };
      }
      if ((await db.query('SELECT 1 FROM player_guild_members WHERE user_id=$1', [uid])).rowCount)
        throw new AppError(409, 'Você já pertence a uma guilda.');
      const { document: c } = await communitySettings(db);
      if (c.founding_po === null)
        throw new AppError(409, 'O administrador precisa definir o custo de fundação.');
      const {
        rows: [ch],
      } = await db.query(
        'SELECT id,gold_cp FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [input.character_id, uid],
      );
      if (!ch) throw new AppError(404, 'Escolha um personagem seu.');
      await reserveName(db, input.document.name);
      checkRooms(input.document, 0, c);
      const cp = c.founding_po * 100,
        gold_cp = await spendGold(
          db,
          ch,
          cp,
          unlimited,
          'O personagem não possui ouro suficiente para fundar a guilda.',
        ),
        id = randomUUID();
      await db.query(
        'INSERT INTO player_guilds(id,owner_id,document,founding_cp,request_id) VALUES($1,$2,$3,$4,$5)',
        [id, uid, JSON.stringify(initialDecor(input.document)), cp, input.request_id],
      );
      await db.query(
        'INSERT INTO player_guild_members(user_id,guild_id,character_id) VALUES($1,$2,$3)',
        [uid, id, ch.id],
      );
      await db.query(
        "INSERT INTO player_guild_ledger(guild_id,user_id,kind,amount_cp,reference) VALUES($1,$2,'foundation',$3,$4)",
        [id, uid, -cp, input.request_id],
      );
      return { id, gold_cp, replayed: false };
    });
    res.status(201).json(saved);
  });
  router.get('/guilds/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id,
      {
        rows: [g],
      } = await pool.query('SELECT * FROM player_guilds WHERE id=$1', [id]);
    if (!g) throw new AppError(404, 'Guilda não encontrada.');
    const members = await pool.query(
      `SELECT m.user_id,m.character_id,u.name,c.name AS character_name,c.level FROM player_guild_members m JOIN "user" u ON u.id=m.user_id JOIN characters c ON c.id=m.character_id WHERE m.guild_id=$1 ORDER BY m.joined_at,m.user_id`,
      [id],
    );
    const member = members.rows.some((m) => m.user_id === uid && (!res.locals.guildCharacterId || m.character_id === res.locals.guildCharacterId));
    res.json({
      id,
      document: guildDocumentSchema.parse(g.document),
      revision: g.revision,
      prestige: g.prestige,
      rank: guildRank(g.prestige),
      level: guildLevel(g.prestige),
      room_unlocks: (await communitySettings()).document.room_unlocks,
      owner_id: g.owner_id,
      is_owner: member && g.owner_id === uid,
      is_member: member,
      members: members.rows,
      treasury_cp: member ? Number(g.treasury_cp) : null,
      weekly: member ? await weeks(pool, id) : null,
      upgrades: member
        ? (
            await pool.query(
              'SELECT object_id,level FROM player_guild_upgrades WHERE guild_id=$1',
              [id],
            )
          ).rows
        : [],
      ledger: member
        ? (
            await pool.query(
              'SELECT kind,amount_cp,created_at FROM player_guild_ledger WHERE guild_id=$1 ORDER BY id DESC LIMIT 20',
              [id],
            )
          ).rows
        : [],
    });
  });
  router.put('/guilds/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      input = z
        .object({ document: guildDocumentSchema, revision: z.number().int().min(0) })
        .strict()
        .parse(req.body);
    res.json(
      await transaction(async (db) => {
        const g = await guild(db, id, res.locals.user.id, true, res.locals.guildCharacterId);
        checkRooms(input.document, g.prestige, (await communitySettings(db)).document);
        if (g.revision !== input.revision)
          throw new AppError(409, 'A sede mudou. Reabra antes de salvar.');
        await reserveName(db, input.document.name, id);
        const {
          rows: [saved],
        } = await db.query(
          'UPDATE player_guilds SET document=$2,revision=revision+1 WHERE id=$1 RETURNING revision',
          [id, JSON.stringify(input.document)],
        );
        return saved;
      }),
    );
  });
  router.post('/guilds/:id/invites', async (req, res) => {
    const id = uuid.parse(req.params.id),
      { user_id: uid } = z
        .object({ user_id: z.string().min(1).max(100) })
        .strict()
        .parse(req.body);
    await transaction(async (db) => {
      await guild(db, id, res.locals.user.id, true, res.locals.guildCharacterId);
      if (!(await db.query('SELECT 1 FROM "user" WHERE id=$1', [uid])).rowCount)
        throw new AppError(404, 'Jogador não encontrado.');
      if ((await db.query('SELECT 1 FROM player_guild_members WHERE user_id=$1', [uid])).rowCount)
        throw new AppError(409, 'Este jogador já pertence a uma guilda.');
      if (
        (await db.query('SELECT count(*)::int n FROM player_guild_members WHERE guild_id=$1', [id]))
          .rows[0].n >= 8
      )
        throw new AppError(409, 'A guilda já possui oito jogadores.');
      await db.query(
        'INSERT INTO player_guild_invites(guild_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [id, uid],
      );
    });
    res.json({ ok: true });
  });
  router.post('/guilds/:id/join', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id,
      { character_id: cid } = z.object({ character_id: uuid }).strict().parse(req.body);
    await transaction(async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['guild-user:' + uid]);
      const g = await db.query('SELECT id FROM player_guilds WHERE id=$1 FOR UPDATE', [id]);
      if (!g.rowCount) throw new AppError(404, 'Guilda não encontrada.');
      if (
        !(
          await db.query(
            'SELECT 1 FROM player_guild_invites WHERE guild_id=$1 AND user_id=$2 FOR UPDATE',
            [id, uid],
          )
        ).rowCount
      )
        throw new AppError(403, 'É necessário um convite do fundador.');
      if ((await db.query('SELECT 1 FROM player_guild_members WHERE user_id=$1', [uid])).rowCount)
        throw new AppError(409, 'Você já pertence a uma guilda.');
      if (
        !(
          await db.query(
            'SELECT 1 FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
            [cid, uid],
          )
        ).rowCount
      )
        throw new AppError(400, 'Escolha um personagem seu.');
      if (
        (await db.query('SELECT count(*)::int n FROM player_guild_members WHERE guild_id=$1', [id]))
          .rows[0].n >= 8
      )
        throw new AppError(409, 'A guilda já possui oito jogadores.');
      await db.query(
        'INSERT INTO player_guild_members(user_id,guild_id,character_id) VALUES($1,$2,$3)',
        [uid, id, cid],
      );
      await db.query('DELETE FROM player_guild_invites WHERE user_id=$1', [uid]);
    });
    res.json({ ok: true });
  });
  router.delete('/guilds/:id/invites', async (req, res) => {
    await pool.query('DELETE FROM player_guild_invites WHERE guild_id=$1 AND user_id=$2', [
      uuid.parse(req.params.id),
      res.locals.user.id,
    ]);
    res.json({ ok: true });
  });
  router.delete('/guilds/:id/members/:user', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id,
      target = z.string().max(100).parse(req.params.user);
    await transaction(async (db) => {
      const g = await guild(db, id, uid, false, res.locals.guildCharacterId);
      if (target === g.owner_id)
        throw new AppError(409, 'O fundador precisa permanecer na guilda.');
      if (target !== uid && g.owner_id !== uid)
        throw new AppError(403, 'Somente o fundador pode remover jogadores.');
      await db.query('DELETE FROM player_guild_members WHERE guild_id=$1 AND user_id=$2', [
        id,
        target,
      ]);
    });
    res.json({ ok: true });
  });
  router.post('/guilds/:id/weekly/:mission/claim', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id,
      mid = z.string().max(50).parse(req.params.mission);
    res.json(
      await transaction(async (db) => {
        await guild(db, id, uid, true, res.locals.guildCharacterId);
        const w = await weeks(db, id),
          {
            rows: [m],
          } = await db.query(
            'SELECT * FROM player_guild_weeks WHERE guild_id=$1 AND week=$2 AND mission_id=$3 FOR UPDATE',
            [id, w.week, mid],
          );
        if (!m) throw new AppError(404, 'Missão não encontrada nesta semana.');
        if (m.claimed_at) return { replayed: true };
        const p = await progress(db, id, w.week);
        if (p[m.template.metric] < m.template.goal)
          throw new AppError(409, 'A missão ainda não foi concluída.');
        await db.query(
          'UPDATE player_guild_weeks SET claimed_at=now() WHERE guild_id=$1 AND week=$2 AND mission_id=$3',
          [id, w.week, mid],
        );
        await db.query(
          'UPDATE player_guilds SET treasury_cp=treasury_cp+$2,prestige=prestige+$3 WHERE id=$1',
          [id, m.template.gold_po * 100, m.template.prestige],
        );
        await db.query(
          "INSERT INTO player_guild_ledger(guild_id,user_id,kind,amount_cp,reference) VALUES($1,$2,'weekly',$3,$4)",
          [id, uid, m.template.gold_po * 100, w.week + ':' + mid],
        );
        return { replayed: false };
      }),
    );
  });
  router.post('/guilds/:id/upgrade/:object', async (req, res) => {
    const id = uuid.parse(req.params.id),
      oid = uuid.parse(req.params.object),
      uid = res.locals.user.id,
      { level } = z
        .object({ level: z.number().int().min(2).max(10) })
        .strict()
        .parse(req.body);
    res.json(
      await transaction(async (db) => {
        const g = await guild(db, id, uid, true, res.locals.guildCharacterId),
          object = g.document.placements.find((o: { id: string }) => o.id === oid);
        if (!object) throw new AppError(404, 'Objeto não encontrado.');
        const { document: c } = await communitySettings(db),
          rule = c.upgrades.find((r) => r.catalog === object.catalog);
        if (!rule)
          throw new AppError(409, 'O administrador ainda não definiu os requisitos deste objeto.');
        const {
            rows: [u],
          } = await db.query(
            'SELECT level FROM player_guild_upgrades WHERE guild_id=$1 AND object_id=$2',
            [id, oid],
          ),
          current = u?.level || 1;
        if (level <= current) return { replayed: true, level: current };
        if (level !== current + 1 || level > rule.max_level)
          throw new AppError(409, 'Nível de melhoria inválido.');
        const completed = (
          await db.query(
            'SELECT count(*)::int n FROM player_guild_weeks WHERE guild_id=$1 AND claimed_at IS NOT NULL',
            [id],
          )
        ).rows[0].n;
        if (
          g.prestige < rule.prestige ||
          completed < rule.missions ||
          Number(g.treasury_cp) < rule.gold_po * 100
        )
          throw new AppError(409, 'A guilda ainda não atende aos requisitos da melhoria.');
        await db.query('UPDATE player_guilds SET treasury_cp=treasury_cp-$2 WHERE id=$1', [
          id,
          rule.gold_po * 100,
        ]);
        await db.query(
          'INSERT INTO player_guild_upgrades(guild_id,object_id,level) VALUES($1,$2,$3) ON CONFLICT(guild_id,object_id) DO UPDATE SET level=$3',
          [id, oid, level],
        );
        await db.query(
          "INSERT INTO player_guild_ledger(guild_id,user_id,kind,amount_cp,reference) VALUES($1,$2,'upgrade',$3,$4)",
          [id, uid, -rule.gold_po * 100, oid + ':' + level],
        );
        return { level, replayed: false };
      }),
    );
  });
  return router;
}

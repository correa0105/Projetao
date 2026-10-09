import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { isAdministrator } from './administrators.js';
import {
  emptyHotbar,
  hotbarSchema,
  hotbarActionKey,
  type HotbarState,
} from '../shared/vtt-hotbar.js';
import { spells, deriveSheet } from '../shared/character-sheet.js';
import { readCharacterLoadout } from './character-attacks.js';
import { equippedAttacks, type CombatItem } from '../shared/equipped-attacks.js';
import { consumableItems } from '../shared/vtt-sheet.js';
import type { VttDocument } from '../shared/vtt.js';
import { tokenMonsterActions } from '../shared/vtt-monster-presets.js';
type DB = Pick<PoolClient, 'query'>;
async function withArt(state: HotbarState): Promise<HotbarState> {
  const actions = state.document.pages
    .flatMap((p) => p.slots)
    .filter((a) => a?.kind === 'attack' || a?.kind === 'consumable');
  const sources = [...new Set(actions.map((a) => a!.sourceId))];
  if (!sources.length) return { ...state, art: {} };
  const { rows } = await pool.query(
    'SELECT id,name,image_path FROM catalog_items WHERE (id=ANY($1::text[]) OR name=ANY($1::text[])) AND image_path IS NOT NULL',
    [sources],
  );
  const art: Record<string, string> = {};
  for (const action of actions) {
    const item =
      rows.find((i) => i.id === action!.sourceId) || rows.find((i) => i.name === action!.sourceId);
    if (item) art[hotbarActionKey(action!)] = item.image_path;
  }
  return { ...state, art };
}
type Access = (
  db: DB,
  id: string,
  user: string,
  lock?: boolean,
) => Promise<{ owner_id: string; document: VttDocument; role?: string | null }>;
export function vttHotbarRouter(getRoom: Access) {
  const router = Router();
  router.get('/vtt/rooms/:id/hotbar/monster/:token/:action', async (req, res) => {
    const r = await getRoom(pool, z.string().uuid().parse(req.params.id), res.locals.user.id);
    if (r.owner_id !== res.locals.user.id || !(await isAdministrator(res.locals.user.id)))
      throw new AppError(403, 'Somente o mestre desta mesa usa ataques de monstros.');
    const tokenId = z.string().uuid().parse(req.params.token);
    const t = r.document.scenes
      .find((s) => s.id === r.document.activeScene)!
      .tokens.find((t) => t.id === tokenId && !t.characterId && t.layer !== 'map');
    const action = t?.sheet && tokenMonsterActions(t).find((a) => a.id === req.params.action);
    if (!t || !action)
      throw new AppError(404, 'O monstro ou esta ação não está disponível neste mapa.');
    res.json({ tokenName: t.name, action });
  });
  const path = '/vtt/rooms/:id/hotbar';
  router.get(path, async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    await getRoom(pool, id, user);
    await pool.query(
      'INSERT INTO vtt_hotbars(room_id,user_id,document)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',
      [id, user, JSON.stringify(emptyHotbar(randomUUID()))],
    );
    const {
      rows: [r],
    } = await pool.query(
      'SELECT revision,document FROM vtt_hotbars WHERE room_id=$1 AND user_id=$2',
      [id, user],
    );
    res.json(await withArt(r));
  });
  router.put(path, async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    const input = z
      .object({ revision: z.number().int().min(1), document: hotbarSchema })
      .strict()
      .parse(req.body);
    const result = await transaction(async (db) => {
      const room = await getRoom(db, id, user, true);
      if (room.role === 'spectator')
        throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
      const {
        rows: [old],
      } = await db.query(
        'SELECT revision,document FROM vtt_hotbars WHERE room_id=$1 AND user_id=$2 FOR UPDATE',
        [id, user],
      );
      if (!old || old.revision !== input.revision)
        throw new AppError(409, 'A barra foi alterada. Recarregue e tente novamente.');
      for (const p of hotbarSchema.parse(old.document).pages) {
        const next = input.document.pages.find((n) => n.id === p.id);
        if (
          p.locked &&
          (!next || next.name !== p.name || JSON.stringify(next.slots) !== JSON.stringify(p.slots))
        )
          throw new AppError(403, 'Destranque a aba antes de editar ou remover seus atalhos.');
      }
      const actions = input.document.pages.flatMap((p) => p.slots).filter((a) => a !== null);
      const gm = room.owner_id === user && (await isAdministrator(user, db as PoolClient));
      const characterActions = actions.filter((a) => 'characterId' in a);
      for (const a of actions.filter((a) => a.kind === 'sound')) {
        if (!gm) throw new AppError(403, 'Sons compartilhados são exclusivos do mestre.');
        if (a.sourceId.startsWith('asset:')) {
          const valid = await db.query(
            "SELECT id FROM vtt_assets WHERE id=$1 AND room_id=$2 AND kind='audio'",
            [a.sourceId.slice(6), id],
          );
          const existing = hotbarSchema
            .parse(old.document)
            .pages.some((p) => p.slots.some((v) => v && JSON.stringify(v) === JSON.stringify(a)));
          if (!valid.rowCount && !existing)
            throw new AppError(400, 'Esse áudio não pertence a esta mesa.');
        }
      }
      for (const a of actions.filter((a) => a.kind === 'effect' || a.kind === 'monster')) {
        if (!gm) throw new AppError(403, 'Efeitos e ataques de monstros são exclusivos do mestre.');
        const valid =
          a.kind === 'effect'
            ? room.document.effects.some((e) => e.id === a.sourceId)
            : room.document.scenes.some((s) =>
                s.tokens.some(
                  (t) =>
                    t.id === a.tokenId &&
                    !t.characterId &&
                    t.layer !== 'map' &&
                    t.sheet &&
                    tokenMonsterActions(t).some((w) => w.id === a.sourceId),
                ),
              );
        const existing = hotbarSchema
          .parse(old.document)
          .pages.some((p) => p.slots.some((v) => v && JSON.stringify(v) === JSON.stringify(a)));
        if (!valid && !existing)
          throw new AppError(400, 'Efeito ou ataque não pertence a esta mesa.');
      }
      for (const cid of new Set(characterActions.map((a) => a.characterId))) {
        const {
          rows: [c],
        } = await db.query(
          'SELECT c.*,s.choices,s.prepared FROM characters c JOIN vtt_character_links l ON l.character_id=c.id AND l.room_id=$2 LEFT JOIN character_sheets s ON s.character_id=c.id WHERE c.id=$1 AND c.deleted_at IS NULL',
          [cid, id],
        );
        if (!c || (!gm && c.user_id !== user))
          throw new AppError(403, 'Esse personagem não pertence à sua barra de ações.');
        if (
          !gm &&
          !room.document.scenes.some((s) =>
            s.tokens.some((t) => t.characterId === cid && t.controller === user),
          )
        )
          throw new AppError(403, 'Você não controla esse personagem nesta mesa.');
        const derived = c.choices ? deriveSheet(c, c.choices) : null;
        const known = new Set([
          ...(derived?.cantrips || []),
          ...(derived?.known || []),
          ...(c.prepared || []),
          ...(derived?.alwaysPrepared || []),
          ...(derived?.spellGrants.flatMap((g) => [...g.cantrips, ...g.spells]) || []),
        ]);
        const loadout = await readCharacterLoadout(db, c, c.choices);
        const weapons = equippedAttacks(
          c,
          c.choices,
          loadout.inventory.map((i) => ({ ...i, equipped: ['main_hand'] })) as CombatItem[],
        );
        for (const a of characterActions.filter((a) => a.characterId === cid)) {
          const valid =
            a.kind === 'attack'
              ? weapons.some((w) => w.itemId === a.sourceId || w.name === a.sourceId)
              : a.kind === 'spell'
                ? spells.some((s) => s.id === a.sourceId && known.has(s.id))
                : consumableItems.has(a.sourceId) &&
                  loadout.inventory.some((i) => i.id === a.sourceId);
          // Previously pinned, unavailable items can still be moved or removed. Execution rechecks the live loadout.
          const existing = hotbarSchema
            .parse(old.document)
            .pages.some((p) =>
              p.slots.some(
                (s) =>
                  s &&
                  'characterId' in s &&
                  s.kind === a.kind &&
                  s.characterId === cid &&
                  s.sourceId === a.sourceId,
              ),
            );
          if (!valid && !((a.kind === 'consumable' || a.kind === 'attack') && existing))
            throw new AppError(400, 'O atalho não está disponível na ficha desse personagem.');
        }
      }
      const {
        rows: [saved],
      } = await db.query(
        'UPDATE vtt_hotbars SET document=$3,revision=revision+1,updated_at=now() WHERE room_id=$1 AND user_id=$2 RETURNING revision,document',
        [id, user, JSON.stringify(input.document)],
      );
      return saved;
    });
    res.json(await withArt(result));
  });
  return router;
}

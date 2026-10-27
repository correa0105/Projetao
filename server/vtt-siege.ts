import { Router } from 'express';
import { z } from 'zod';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db';
import { AppError } from './services';
import { canManageVtt } from './vtt-permissions';
import {
  newToken,
  pointSchema,
  type VttDocument,
  type VttScene,
  type VttToken,
} from '../shared/vtt';
import { combatSchema, type Combat } from '../shared/vtt-combat';
import { rollFormula } from '../shared/vtt-roll';
import { attackFormula, attackOutcome, criticalDamage } from '../shared/vtt-attack';
import { attachmentUnavailable } from '../shared/vtt-attachments';
import { siegeWaterAt } from '../shared/vtt-siege-surface';
import {
  siegeKinds,
  siegeDefinitions,
  siegeImage,
  siegeAdjacent,
  siegeBearing,
  siegeDistance,
  siegePointInToken,
  siegeAimStale,
  siegeImpactPosition,
  siegeRopeOrigin,
  type SiegeWeapon,
  type SiegeSnapshot,
  type SiegeAim,
  type SiegeShot,
  type SiegeKind,
  type SiegeImpact,
  type SiegeLoad,
} from '../shared/vtt-siege';

type DB = Pick<PoolClient, 'query'>;
type Room = {
  id: string;
  owner_id: string;
  administrator?: boolean;
  administrator_user_id?: string;
  role?: string | null;
  viewing_user_id?: string | null;
  document: VttDocument;
  revision: number;
  combat?: unknown;
};
type Access = (db: DB, id: string, user: string, lock?: boolean) => Promise<Room>;
type Row = {
  room_id: string;
  token_id: string;
  scene_id: string;
  kind: SiegeKind;
  stage: SiegeWeapon['stage'];
  ammunition: number;
  revision: number;
  aim: SiegeAim | null;
  last_shot: SiegeShot | null;
  last_load: SiegeLoad | null;
  muted: boolean;
};
const uuid = z.string().uuid(),
  mode = z.enum(['normal', 'advantage', 'disadvantage']);
const operator = {
  weaponId: uuid,
  revision: z.number().int().min(0),
  actorId: uuid,
  sceneId: uuid,
};
const commandSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('create'),
      weaponKind: z.enum(siegeKinds),
      position: pointSchema.optional(),
      sceneId: uuid,
      operationId: uuid,
    })
    .strict(),
  z.object({ kind: z.literal('load'), ...operator, operationId: uuid }).strict(),
  z
    .object({
      kind: z.literal('aim'),
      ...operator,
      point: pointSchema,
      mode: mode.default('normal'),
      surface: z.enum(['auto', 'ground', 'water']).optional(),
      operationId: uuid,
    })
    .strict(),
  z.object({ kind: z.literal('fire'), ...operator, operationId: uuid }).strict(),
  z.object({ kind: z.literal('cutRope'), ...operator, actorId: uuid.optional(), operationId: uuid }).strict(),
  z
    .object({
      kind: z.literal('settings'),
      weaponId: uuid,
      revision: z.number().int().min(0),
      ammunition: z.number().int().min(0).max(9999),
      muted: z.boolean(),
      sceneId: uuid,
      operationId: uuid,
    })
    .strict(),
  z
    .object({ kind: z.literal('extraAction'), actorId: uuid, sceneId: uuid, operationId: uuid })
    .strict(),
  z
    .object({ kind: z.literal('removeImpact'), impactId: uuid, sceneId: uuid, operationId: uuid })
    .strict(),
]);
const asWeapon = (r: Row): SiegeWeapon => ({
  id: r.token_id,
  sceneId: r.scene_id,
  kind: r.kind,
  stage: r.stage,
  ammo: r.ammunition,
  revision: r.revision,
  aim: r.aim,
  lastShot: r.last_shot,
  lastLoad: r.last_load,
  muted: r.muted,
});
const combat = (r: Room) => {
  const parsed = combatSchema.safeParse(r.combat);
  if (!parsed.success || parsed.data.sceneId !== r.document.activeScene) return null;
  const c = parsed.data,
    scene = r.document.scenes.find((s) => s.id === c.sceneId)!;
  c.entries = c.entries.filter((e) =>
    scene.tokens.some(
      (t) => t.id === e.tokenId && t.layer === 'tokens' && !t.hidden && !t.sceneryToken,
    ),
  );
  if (!c.entries.some((e) => e.tokenId === c.currentId))
    c.currentId = c.entries[0]?.tokenId || null;
  if (!c.entries.length) c.active = false;
  return c;
};

/** Only actual turn changes reset the action budget; rolling initiative does not. */
export async function advanceSiegeTurn(db: DB, roomId: string, c: Combat) {
  if (
    !(await db.query('SELECT 1 FROM vtt_siege_weapons WHERE room_id=$1 LIMIT 1', [roomId])).rowCount
  )
    return;
  await db.query('DELETE FROM vtt_siege_actions WHERE room_id=$1', [roomId]);
  if (!c.active) {
    await db.query('DELETE FROM vtt_siege_turns WHERE room_id=$1', [roomId]);
    return;
  }
  await db.query(
    'INSERT INTO vtt_siege_turns(room_id,actor_id,round) VALUES($1,$2,$3) ON CONFLICT(room_id) DO UPDATE SET turn_id=gen_random_uuid(),actor_id=$2,round=$3',
    [roomId, c.currentId, c.round],
  );
}
async function currentTurn(db: DB, r: Room) {
  const c = combat(r);
  if (!c?.active) return null;
  await db.query(
    'INSERT INTO vtt_siege_turns(room_id,actor_id,round) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
    [r.id, c.currentId, c.round],
  );
  const {
    rows: [turn],
  } = await db.query('SELECT turn_id FROM vtt_siege_turns WHERE room_id=$1 FOR UPDATE', [r.id]);
  return { id: turn.turn_id as string, c };
}
async function spendAction(db: DB, r: Room, actorId: string) {
  const turn = await currentTurn(db, r);
  if (!turn) return;
  if (turn.c.currentId !== actorId)
    throw new AppError(409, 'Esta operação usa a ação do personagem no turno dele.');
  await db.query(
    'INSERT INTO vtt_siege_actions(room_id,turn_id,actor_id)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',
    [r.id, turn.id, actorId],
  );
  if (
    !(
      await db.query(
        'UPDATE vtt_siege_actions SET used=used+1 WHERE room_id=$1 AND turn_id=$2 AND actor_id=$3 AND used<budget RETURNING used',
        [r.id, turn.id, actorId],
      )
    ).rowCount
  )
    throw new AppError(
      409,
      'A ação deste turno já foi usada na arma. Aguarde o próximo turno ou uma ação extra autorizada pelo mestre.',
    );
}
/** An older room snapshot cannot restore spent ammunition or a previous loading stage. */
export async function protectSiegeImages(db: DB, roomId: string, document: VttDocument) {
  const { rows } = await db.query<Row>('SELECT * FROM vtt_siege_weapons WHERE room_id=$1', [
    roomId,
  ]);
  for (const r of rows) {
    const scene = document.scenes.find((s) => s.tokens.some((t) => t.id === r.token_id)),
      token = scene?.tokens.find((t) => t.id === r.token_id);
    if (!scene || !token) continue;
    if (r.aim && (r.scene_id !== scene.id || siegeAimStale(token, r.aim))) {
      r.stage = 'loaded';
      r.aim = null;
      await db.query(
        "UPDATE vtt_siege_weapons SET stage='loaded',aim=NULL,scene_id=$3,revision=revision+1 WHERE room_id=$1 AND token_id=$2",
        [roomId, r.token_id, scene.id],
      );
    } else if (r.scene_id !== scene.id)
      await db.query(
        'UPDATE vtt_siege_weapons SET scene_id=$3,revision=revision+1 WHERE room_id=$1 AND token_id=$2',
        [roomId, r.token_id, scene.id],
      );
    token.image = siegeImage(r.kind, r.stage !== 'empty');
  }
}
export function vttSiegeRouter(
  access: Access,
  state: (id: string, user: string) => Promise<unknown>,
  canSee: (t: VttToken, s: VttScene, u: string) => boolean,
) {
  const router = Router(),
    path = '/vtt/rooms/:id/siege';
  const sceneFor = (r: Room) => r.document.scenes.find((s) => s.id === r.document.activeScene)!;
  const visible = (r: Room, t: VttToken, u: string) =>
    canManageVtt(r, u) ||
    (!attachmentUnavailable(sceneFor(r).tokens, t) &&
      canSee(t, sceneFor(r), r.role === 'spectator' ? r.viewing_user_id || '' : u));
  async function snapshot(id: string, user: string): Promise<SiegeSnapshot> {
    const r = await access(pool, id, user),
      scene = sceneFor(r),
      c = combat(r);
    const { rows } = await pool.query<Row>(
      'SELECT * FROM vtt_siege_weapons WHERE room_id=$1 AND scene_id=$2 ORDER BY token_id',
      [id, scene.id],
    );
    const actions = (
      await pool.query(
        'SELECT a.actor_id AS "actorId",a.used,a.budget FROM vtt_siege_actions a JOIN vtt_siege_turns t ON t.room_id=a.room_id AND t.turn_id=a.turn_id WHERE a.room_id=$1',
        [id],
      )
    ).rows;
    const pointVisible = (point: { x: number; y: number }, sourceId: string) => {
      const source = scene.tokens.find((t) => t.id === sourceId) || newToken(sourceId, scene);
      return canSee(
        {
          ...source,
          ...point,
          width: 1,
          height: 1,
          hidden: false,
          layer: 'tokens',
          controller: null,
        },
        scene,
        r.role === 'spectator' ? r.viewing_user_id || '' : user,
      );
    };
    const storedImpacts = (
      await pool.query<{ data: SiegeImpact }>(
        'SELECT data FROM vtt_siege_impacts WHERE room_id=$1 AND scene_id=$2 ORDER BY created_at,id',
        [id, scene.id],
      )
    ).rows.map((row) => row.data);
    const attachedWeapons = new Set(storedImpacts.filter(i => i.kind === 'harpoon' && !i.ropeCutAt).map(i => i.weaponId));
    const impacts = storedImpacts
      .map((impact) => {
        if (impact.kind !== 'harpoon') return impact;
        const source = scene.tokens.find((t) => t.id === impact.weaponId);
        const origin = siegeRopeOrigin(impact, scene);
        return {
          ...impact,
          ropeOrigin:
            (source && !visible(r, source, user)) ||
            (!canManageVtt(r, user) && origin && !pointVisible(origin, impact.weaponId))
              ? null
              : origin,
        };
      })
      .filter((impact) => {
        if (canManageVtt(r, user)) return true;
        const target = impact.targetId && scene.tokens.find((t) => t.id === impact.targetId);
        return (
          !impact.private &&
          (!target || visible(r, target, user)) &&
          pointVisible(siegeImpactPosition(impact, scene).point, impact.weaponId)
        );
      });
    return {
      roomId: id,
      sceneId: scene.id,
      serverTime: Date.now(),
      impacts,
      weapons: rows
        .filter((w) => {
          const t = scene.tokens.find((t) => t.id === w.token_id);
          return t && visible(r, t, user);
        })
        .map((w) => {
          const result = asWeapon(w);
          result.ropeAttached = w.kind === 'harpoon' && attachedWeapons.has(w.token_id);
          const actual = scene.tokens.find((t) => t.id === w.token_id)!;
          const target = result.aim?.targetId
            ? scene.tokens.find((t) => t.id === result.aim!.targetId)
            : null;
          if (
            result.aim &&
            (siegeAimStale(actual, result.aim) ||
              (result.aim.targetId && (!target || !siegePointInToken(result.aim, target))))
          ) {
            result.stage = 'loaded';
            result.aim = null;
          }
          if (!canManageVtt(r, user)) {
            if (result.lastLoad?.private) result.lastLoad = null;
            const token = scene.tokens.find((t) => t.id === w.token_id)!;
            const seesPoint = (p: { x: number; y: number }) =>
              canSee(
                {
                  ...token,
                  ...p,
                  width: 1,
                  height: 1,
                  hidden: false,
                  layer: 'tokens',
                  controller: null,
                },
                scene,
                r.role === 'spectator' ? r.viewing_user_id || '' : user,
              );
            if (
              result.aim &&
              (!seesPoint(result.aim) ||
                (result.aim.targetId && (!target || !visible(r, target, user))))
            )
              result.aim = null;
            if (result.lastShot && (result.lastShot.private || !seesPoint(result.lastShot.to)))
              result.lastShot = null;
          }
          return result;
        }),
      turn: {
        active: !!c?.active,
        actorId:
          c?.currentId && scene.tokens.some((t) => t.id === c.currentId && visible(r, t, user))
            ? c.currentId
            : null,
        actions: actions.filter(
          (a) =>
            canManageVtt(r, user) ||
            scene.tokens.some((t) => t.id === a.actorId && t.controller === user),
        ),
      },
    };
  }
  router.get(path, async (req, res) =>
    res
      .set('Cache-Control', 'no-store')
      .json(await snapshot(uuid.parse(req.params.id), res.locals.user.id)),
  );
  router.post(path, async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id,
      input = commandSchema.parse(req.body),
      hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    await transaction(async (db) => {
      const r = await access(db, id, user, true),
        gm = canManageVtt(r, user),
        scene = sceneFor(r);
      if (r.role === 'spectator' && !gm)
        throw new AppError(403, 'Espectadores apenas assistem às armas de cerco.');
      const {
        rows: [replay],
      } = await db.query(
        'SELECT user_id,request_hash FROM vtt_siege_commands WHERE room_id=$1 AND operation_id=$2',
        [id, input.operationId],
      );
      if (replay) {
        if (replay.user_id !== user || replay.request_hash !== hash)
          throw new AppError(409, 'Esta operação já foi usada com outros dados.');
        return;
      }
      if (input.sceneId !== scene.id)
        throw new AppError(409, 'O mapa ativo mudou. Abra a arma novamente.');
      if (input.kind === 'removeImpact') {
        if (!gm) throw new AppError(403, 'Somente o mestre pode remover marcas dos disparos.');
        if (
          !(
            await db.query(
              'DELETE FROM vtt_siege_impacts WHERE id=$1 AND room_id=$2 AND scene_id=$3',
              [input.impactId, id, scene.id],
            )
          ).rowCount
        )
          throw new AppError(404, 'Marca indisponível neste mapa.');
      } else if (input.kind === 'create') {
        if (!gm) throw new AppError(403, 'Somente o mestre pode colocar armas de cerco.');
        const existing = (
          await db.query('SELECT token_id FROM vtt_siege_weapons WHERE room_id=$1', [id])
        ).rows;
        const activeIds = new Set(r.document.scenes.flatMap((s) => s.tokens.map((t) => t.id)));
        if (existing.filter((w) => activeIds.has(w.token_id)).length >= 60)
          throw new AppError(400, 'Esta mesa já tem 60 armas de cerco.');
        const d = siegeDefinitions[input.weaponKind],
          t = newToken(randomUUID(), scene),
          size = Math.min(8000, Math.max(8, (scene.grid.size / scene.grid.scale) * 10)),
          p = input.position || { x: scene.width / 2, y: scene.height / 2 };
        Object.assign(t, {
          name: d.name,
          image: siegeImage(input.weaponKind),
          width: size,
          height: size,
          x: Math.max(size / 2, Math.min(scene.width - size / 2, p.x)),
          y: Math.max(size / 2, Math.min(scene.height - size / 2, p.y)),
          layer: 'tokens',
          sceneryToken: true,
          bleeds: false,
          hp: d.hp,
          maxHp: d.hp,
          ac: d.ac,
          vision: 0,
          notes: `${d.description} Ataque +6 · alcance ${d.range}/${d.longRange} pés · ${d.damage} ${d.damageType}. Carregar, mirar e disparar: uma ação cada. Imune a veneno e psíquico. Estoque inicial ajustável pelo mestre.`,
        });
        scene.tokens.push(t);
        await db.query(
          'INSERT INTO vtt_siege_weapons(room_id,token_id,scene_id,kind)VALUES($1,$2,$3,$4)',
          [id, t.id, scene.id, input.weaponKind],
        );
      } else if (input.kind === 'extraAction') {
        if (!gm) throw new AppError(403, 'Somente o mestre autoriza uma ação extra.');
        const turn = await currentTurn(db, r);
        if (!turn || turn.c.currentId !== input.actorId)
          throw new AppError(409, 'Escolha o personagem do turno atual.');
        await db.query(
          'INSERT INTO vtt_siege_actions(room_id,turn_id,actor_id,budget)VALUES($1,$2,$3,2)ON CONFLICT(room_id,turn_id,actor_id)DO UPDATE SET budget=least(10,vtt_siege_actions.budget+1)',
          [id, turn.id, input.actorId],
        );
      } else {
        const {
          rows: [row],
        } = await db.query<Row>(
          'SELECT * FROM vtt_siege_weapons WHERE room_id=$1 AND token_id=$2 FOR UPDATE',
          [id, input.weaponId],
        );
        const t = scene.tokens.find((t) => t.id === input.weaponId);
        if (!row || row.scene_id !== scene.id || !t || !visible(r, t, user))
          throw new AppError(404, 'Arma indisponível neste mapa.');
        if (row.revision !== input.revision)
          throw new AppError(409, 'A arma mudou em outra janela. Atualize antes de operar.');
        const operatingActor = (actorId: string | undefined) => {
          const actor = scene.tokens.find(
            (a) => a.id === actorId && a.layer === 'tokens' && !a.sceneryToken,
          );
          if (!actor || (!gm && (actor.controller !== user || !visible(r, actor, user))))
            throw new AppError(403, 'Escolha um personagem que você controla neste mapa.');
          if (
            actor.hp <= 0 ||
            actor.deathAt ||
            actor.conditions.some((c) =>
              /^(incapacitated|unconscious|stunned|paralyzed|petrified|incapacitado|inconsciente|atordoado|paralisado|petrificado)$/i.test(
                c,
              ),
            )
          )
            throw new AppError(400, 'Este personagem não pode operar a arma agora.');
          if (t.hp <= 0 || t.deathAt) throw new AppError(400, 'A arma está destruída.');
          if (!siegeAdjacent(actor, t, scene))
            throw new AppError(400, 'Aproxime o personagem a até 5 pés da arma.');
          return actor;
        };
        const ropeFilter = "room_id=$1 AND scene_id=$2 AND data->>'weaponId'=$3 AND data->>'kind'='harpoon' AND data->>'ropeCutAt' IS NULL";
        const ropeParams = [id, scene.id, t.id];
        const ropeAttached = row.kind === 'harpoon' &&
          ['cutRope','load','fire'].includes(input.kind) &&
          !!(await db.query('SELECT 1 FROM vtt_siege_impacts WHERE '+ropeFilter+' LIMIT 1', ropeParams)).rowCount;
        if (input.kind === 'cutRope') {
          if (row.kind !== 'harpoon') throw new AppError(400, 'Esta arma não usa corda de arpão.');
          if (!gm) operatingActor(input.actorId);
          if (!ropeAttached) throw new AppError(409, 'Não há corda presa a este lançador.');
          await db.query('UPDATE vtt_siege_impacts SET data=data||$4::jsonb WHERE '+ropeFilter,
            [...ropeParams, JSON.stringify({ropeCutAt:Date.now(),ropeOrigin:null})]);
        } else if (input.kind === 'settings') {
          if (!gm) throw new AppError(403, 'Somente o mestre configura reservas e som.');
          row.ammunition = input.ammunition;
          row.muted = input.muted;
        } else {
          const actor = operatingActor(input.actorId);
          if (ropeAttached) throw new AppError(409, 'Corte a corda do arpão antes de carregar ou disparar novamente.');
          if (input.kind === 'load') {
            if (row.stage !== 'empty') throw new AppError(409, 'A arma já tem uma carga.');
            if (!row.ammunition) throw new AppError(400, 'Não há munição de reserva.');
            await spendAction(db, r, actor.id);
            row.ammunition--;
            row.stage = 'loaded';
            row.aim = null;
            row.last_load = {
              id: randomUUID(),
              at: Date.now(),
              muted: row.muted,
              private:
                attachmentUnavailable(scene.tokens, t) ||
                attachmentUnavailable(scene.tokens, actor),
            };
          } else if (input.kind === 'aim') {
            if (input.surface && input.surface !== 'auto' && !gm)
              throw new AppError(403, 'Somente o mestre pode definir a superfície do impacto.');
            if (row.stage === 'empty') throw new AppError(409, 'Carregue a arma antes de mirar.');
            if (
              input.point.x < 0 ||
              input.point.y < 0 ||
              input.point.x > scene.width ||
              input.point.y > scene.height
            )
              throw new AppError(400, 'Mire dentro do mapa.');
            if (siegeDistance(t, input.point, scene) > siegeDefinitions[row.kind].longRange)
              throw new AppError(400, 'O ponto está além do alcance máximo.');
            await spendAction(db, r, actor.id);
            const target = [...scene.tokens]
              .reverse()
              .find(
                (a) =>
                  a.id !== t.id &&
                  a.id !== actor.id &&
                  a.layer === 'tokens' &&
                  visible(r, a, user) &&
                  siegePointInToken(input.point, a),
              );
            t.rotation = siegeBearing(t, input.point);
            t.flipX = t.flipY = false;
            row.aim = {
              ...input.point,
              origin: { x: t.x, y: t.y },
              rotation: t.rotation,
              targetId: target?.id || null,
              mode: input.mode,
              surface: input.surface || 'auto',
            };
            row.stage = 'aimed';
          } else {
            if (row.stage !== 'aimed' || !row.aim)
              throw new AppError(409, 'Carregue a arma e confirme a mira antes de disparar.');
            const a = row.aim,
              d = siegeDefinitions[row.kind];
            if (siegeAimStale(t, a)) throw new AppError(409, 'A arma se moveu. Mire novamente.');
            const target = a.targetId
              ? scene.tokens.find(
                  (v) => v.id === a.targetId && v.layer === 'tokens' && visible(r, v, user),
                )
              : null;
            if (a.targetId && (!target || !siegePointInToken(a, target)))
              throw new AppError(409, 'O alvo saiu da mira. Mire novamente.');
            const distance = siegeDistance(t, a, scene);
            if (distance > d.longRange) throw new AppError(400, 'Fora do alcance máximo.');
            await spendAction(db, r, actor.id);
            const effective =
              distance > d.range ? (a.mode === 'advantage' ? 'normal' : 'disadvantage') : a.mode;
            const roll = rollFormula(attackFormula('1d20+6', effective), randomInt),
              outcome = attackOutcome(roll, target?.ac ?? 10),
              hit = !!target && outcome.hit,
              privateShot =
                attachmentUnavailable(scene.tokens, t) ||
                attachmentUnavailable(scene.tokens, actor) ||
                (!!target && attachmentUnavailable(scene.tokens, target));
            const text = `${t.name} · ${actor.name} · ataque${target ? ' contra ' + target.name : ' ao ponto marcado'} · ${target ? (hit ? 'acerto' : 'erro') : 'sem alvo'}${distance > d.range ? ' · alcance longo' : ''}`;
            await db.query(
              'INSERT INTO vtt_messages(room_id,author_id,author,text,roll,private)VALUES($1,$2,$3,$4,$5,$6)',
              [id, user, res.locals.user.name, text, JSON.stringify(roll), privateShot],
            );
            let amount: number | null = null;
            if (hit && target) {
              const damage = rollFormula(
                outcome.critical ? criticalDamage(d.damage)[0] : d.damage,
                randomInt,
              );
              amount = damage.total;
              await db.query(
                'INSERT INTO vtt_messages(room_id,author_id,author,text,roll,private,damage)VALUES($1,$2,$3,$4,$5,$6,$7)',
                [
                  id,
                  user,
                  res.locals.user.name,
                  `${t.name} · dano ${d.damageType}${outcome.critical ? ' · crítico' : ''}`,
                  JSON.stringify(damage),
                  privateShot,
                  JSON.stringify({
                    actor_id: actor.id,
                    target_id: target.id,
                    target_name: target.name,
                  }),
                ],
              );
            }
            row.last_shot = {
              id: randomUUID(),
              at: Date.now(),
              sceneId: scene.id,
              kind: row.kind,
              from: { x: t.x, y: t.y },
              to: { x: a.x, y: a.y },
              hit,
              critical: outcome.critical,
              targetId: target?.id || null,
              damage: amount,
              attack: roll.total,
              private: privateShot,
              muted: row.muted,
            };
            const solid =
              (hit && target && (row.kind === 'harpoon' || target.sceneryToken || target.vehicle)
                ? target
                : null) ||
              [...scene.tokens]
                .reverse()
                .find(
                  (surface) =>
                    surface.id !== t.id &&
                    surface.id !== actor.id &&
                    surface.layer === 'map' &&
                    !!surface.image &&
                    visible(r, surface, user) &&
                    siegePointInToken(a, surface),
                );
            const water =
              a.surface === 'water' || (a.surface !== 'ground' && !solid && siegeWaterAt(scene, a));
            if (!water) {
              const rotation = (Math.atan2(a.y - t.y, a.x - t.x) * 180) / Math.PI;
              const impact: SiegeImpact = {
                id: randomUUID(),
                shotId: row.last_shot.id,
                sceneId: scene.id,
                weaponId: t.id,
                kind: row.kind,
                point: { x: a.x, y: a.y },
                rotation,
                at: row.last_shot.at,
                private: privateShot || !!(solid && attachmentUnavailable(scene.tokens, solid)),
                surface: solid ? 'solid' : 'ground',
                targetId: solid ? solid.id : null,
                ...(row.kind === 'harpoon'
                  ? { ropeOrigin: {
                      x: t.x + Math.cos(rotation * Math.PI / 180) * t.height * .34,
                      y: t.y + Math.sin(rotation * Math.PI / 180) * t.height * .34,
                    } }
                  : {}),
              };
              if (solid) {
                const angle = (-solid.rotation * Math.PI) / 180,
                  c = Math.cos(angle),
                  s = Math.sin(angle),
                  dx = a.x - solid.x,
                  dy = a.y - solid.y,
                  relative = ((rotation - solid.rotation) * Math.PI) / 180;
                impact.local = {
                  x: ((dx * c - dy * s) / solid.width) * (solid.flipX ? -1 : 1),
                  y: ((dx * s + dy * c) / solid.height) * (solid.flipY ? -1 : 1),
                  rotation:
                    (Math.atan2(
                      Math.sin(relative) * (solid.flipY ? -1 : 1),
                      Math.cos(relative) * (solid.flipX ? -1 : 1),
                    ) *
                      180) /
                    Math.PI,
                };
              }
              await db.query(
                'INSERT INTO vtt_siege_impacts(id,room_id,scene_id,shot_id,data)VALUES($1,$2,$3,$4,$5)',
                [impact.id, id, scene.id, impact.shotId, JSON.stringify(impact)],
              );
            }
            row.stage = 'empty';
            row.aim = null;
          }
        }
        t.image = siegeImage(row.kind, row.stage !== 'empty');
        await db.query(
          'UPDATE vtt_siege_weapons SET stage=$3,ammunition=$4,aim=$5,last_shot=$6,muted=$7,last_load=$8,revision=revision+1 WHERE room_id=$1 AND token_id=$2',
          [
            id,
            t.id,
            row.stage,
            row.ammunition,
            row.aim ? JSON.stringify(row.aim) : null,
            row.last_shot ? JSON.stringify(row.last_shot) : null,
            row.muted,
            row.last_load ? JSON.stringify(row.last_load) : null,
          ],
        );
      }
      await db.query(
        'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now()WHERE id=$1',
        [id, JSON.stringify(r.document)],
      );
      await db.query(
        'INSERT INTO vtt_siege_commands(room_id,operation_id,user_id,request_hash)VALUES($1,$2,$3,$4)',
        [id, input.operationId, user, hash],
      );
      await db.query(
        "DELETE FROM vtt_siege_commands WHERE room_id=$1 AND created_at<now()-interval '7 days'",
        [id],
      );
    });
    res.json({ ...(await snapshot(id, user)), room: await state(id, user) });
  });
  return router;
}

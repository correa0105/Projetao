import { Router } from 'express';
import { teleportArrivals, applyTeleportArrivals } from '../shared/vtt-spell-transport.js';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { isAdministrator } from './administrators.js';
import { access, resources, type RoomAccess } from './vtt-sheet.js';
import { deriveSheet, spells } from '../shared/character-sheet.js';
import { tokenMonsterActions } from '../shared/vtt-monster-presets.js';
import {
  spellCastSchema,
  spellProfile,
  preparedSpell,
  feetDistance,
  spellOrigin,
  breathProfile,
  validSpellSelection,
  areaContainsToken,
  pixelsPerFoot,
  grantedBreath,
  spellMoveSchema,
  type SpellEffect,
  type SpellProfile,
  type SpellCastCommand,
} from '../shared/vtt-spells.js';
import type { VttToken, VttScene } from '../shared/vtt.js';
const uuid = z.string().uuid();
const rawCatalog = readFile('data/vtt/srd-2024.json', 'utf8').then((text) => JSON.parse(text));
const lost = (t: VttToken | undefined) =>
  !t ||
  t.hp <= 0 ||
  !!t.deathAt ||
  t.conditions.some((s) =>
    /^(incapacitated|unconscious|petrified|stunned|paralyzed|incapacitado|inconsciente|petrificado|atordoado|paralisado)$/i.test(
      s,
    ),
  );
const knownSpells = (d: ReturnType<typeof deriveSheet> | null, prepared: string[]) =>
  new Set([
    ...(d?.cantrips || []),
    ...(d?.known || []),
    ...prepared,
    ...(d?.alwaysPrepared || []),
    ...(d?.spellGrants.flatMap((g) => [...g.cantrips, ...g.spells]) || []),
  ]);
function commandError(message: string): never {
  throw new AppError(400, message);
}
function checkSelection(
  input: SpellCastCommand,
  p: SpellProfile,
  actor: VttToken,
  scene: VttScene,
  see: (t: VttToken) => boolean,
) {
  if (!validSpellSelection(p, input.targets, input.points))
    commandError('Complete a seleção de alvos ou áreas antes de conjurar.');
  if (p.includeSelf && !input.targets.includes(actor.id))
    commandError('Esta magia inclui o conjurador entre os alvos.');
  if (p.mode === 'self' && (input.targets.length || input.points.length > 1))
    commandError('Esta magia parte do conjurador.');
  if (p.mode === 'targets' && input.points.length && !p.shape && !p.destinationRange)
    commandError('Esta magia usa alvos, não áreas.');
  if (p.mode === 'targets') {
    const targets = input.targets.map((id) =>
      scene.tokens.find((t) => t.id === id && t.layer !== 'map'),
    );
    if (targets.some((t) => !t || !see(t)))
      throw new AppError(403, 'Um dos alvos não está disponível.');
    targets.forEach((target, i) => {
      const origin = p.chain && i > 0 ? targets[p.chainFromLast ? i - 1 : 0]! : actor,
        range = p.chain && i > 0 ? p.chain : p.range;
      // Touch reaches the target's footprint, rather than the center of a large token.
      const center = feetDistance(origin, target!, scene.grid);
      const edgeAllowance =
        range <= 5
          ? (Math.max(actor.width, actor.height) + Math.max(target!.width, target!.height)) /
            2 /
            pixelsPerFoot(scene.grid)
          : 0;
      if (center > range + edgeAllowance + 0.01) commandError('Um dos alvos está fora do alcance.');
    });
    if (p.objectBudget) {
      const cost = targets.reduce(
        (n, t) =>
          n +
          (Math.max(t!.width, t!.height) / scene.grid.size >= 4
            ? 3
            : Math.max(t!.width, t!.height) / scene.grid.size >= 2
              ? 2
              : 1),
        0,
      );
      if (cost > p.count)
        commandError(
          'Os objetos excedem o modificador de conjuração (Grande custa 2; Enorme custa 3).',
        );
    }
  }
  const normalized = p.areaFromTargets
    ? input.targets.map((id) => {
        const t = scene.tokens.find((t) => t.id === id)!;
        return { x: t.x, y: t.y, angle: 0 };
      })
    : input.points.map((at) => spellOrigin(p, actor, at));
  for (const at of normalized) {
    if (at.x < 0 || at.x > scene.width || at.y < 0 || at.y > scene.height)
      commandError('Escolha um ponto dentro do mapa.');
    if (
      p.origin === 'point' &&
      !p.follow &&
      feetDistance(actor, at, scene.grid) > (p.destinationRange || p.range) + 0.01
    )
      commandError('Área fora do alcance da magia.');
  }
  if (p.shape && p.mode === 'targets' && !p.areaFromTargets) {
    if (!input.points.length) commandError('Marque a área antes de selecionar os alvos.');
    const placed = p.shape === 'cube' ? { ...p, origin: 'point' } : p;
    if (
      input.targets.some(
        (id) =>
          !areaContainsToken(
            scene.tokens.find((t) => t.id === id)!,
            placed,
            normalized,
            scene,
          ),
      )
    )
      commandError('Um dos alvos está fora da área selecionada.');
  }
  if (p.contiguous && normalized.length > 1) {
    const f = pixelsPerFoot(scene.grid),
      seen = new Set([0]);
    let changed = true;
    while (changed) {
      changed = false;
      normalized.forEach((a, i) => {
        if (seen.has(i)) return;
        if (
          [...seen].some(
            (j) =>
              Math.abs(a.x - normalized[j].x) <= p.size * f + 0.1 &&
              Math.abs(a.y - normalized[j].y) <= p.size * f + 0.1,
          )
        ) {
          seen.add(i);
          changed = true;
        }
      });
    }
    if (seen.size !== normalized.length)
      commandError('Os painéis precisam formar uma área conectada.');
  }
  return normalized;
}
export function vttSpellsRouter(
  getRoom: RoomAccess,
  canSee: (t: VttToken, s: VttScene, u: string) => boolean,
) {
  const router = Router(),
    base = '/vtt/rooms/:id/spells';
  router.get(base, async (req, res) => {
    const rid = uuid.parse(req.params.id),
      user = res.locals.user.id,
      r = await getRoom(pool, rid, user);
    const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
    const gm = r.owner_id === user && (await isAdministrator(user)),
      viewing = (r as typeof r & { viewing_user_id?: string }).viewing_user_id || user;
    const { rows } = await pool.query(
      "SELECT id,effect FROM vtt_spell_casts WHERE room_id=$1 AND ended_at IS NULL AND ((effect->>'expires') IS NULL OR (effect->>'expires')::bigint>$2 OR (effect->>'concentration')::boolean=true AND effect->>'spellId' IN ('spell-wall-of-stone','spell-true-polymorph')) ORDER BY created_at DESC LIMIT 256",
      [rid, Date.now()],
    );
    const effects: SpellEffect[] = [];
    for (const row of rows) {
      const e = row.effect as SpellEffect,
        actualScene = r.document.scenes.find((s) => s.id === e.sceneId),
        actor = actualScene?.tokens.find((t) => t.id === e.actorId),
        now = Date.now();
      if (e.concentration && lost(actor)) {
        await pool.query(
          'UPDATE vtt_spell_casts SET ended_at=now() WHERE id=$1 AND ended_at IS NULL',
          [row.id],
        );
        continue;
      }
      if (e.expires !== null && e.expires <= now) {
        if (
          e.persistent &&
          e.concentration &&
          ['spell-wall-of-stone', 'spell-true-polymorph'].includes(e.spellId)
        ) {
          e.concentration = false;
          e.expires = null;
          await pool.query(
            'UPDATE vtt_spell_casts SET effect=$2 WHERE id=$1 AND ended_at IS NULL',
            [row.id, JSON.stringify(e)],
          );
        } else {
          continue;
        }
      }
      if (e.sceneId !== scene.id || !actor || (!gm && !canSee(actor, scene, viewing))) continue;
      effects.push({
        ...e,
        movement: e.movement?.filter((m) => {
          const t = scene.tokens.find((t) => t.id === m.tokenId);
          return t && (gm || canSee(t, scene, viewing));
        }),
        targets: e.targets.filter((id) => {
          const t = scene.tokens.find((t) => t.id === id);
          return t && (gm || canSee(t, scene, viewing));
        }),
      });
    }
    res.json({ effects, serverTime: Date.now() });
  });
  router.post(base, async (req, res) => {
    const rid = uuid.parse(req.params.id),
      user = res.locals.user.id,
      input = spellCastSchema.parse(req.body);
    const effect = await transaction(async (db) => {
      const r = await getRoom(db, rid, user, true),
        gm = r.owner_id === user && (await isAdministrator(user, db));
      if (r.role === 'spectator') throw new AppError(403, 'Espectadores apenas assistem à mesa.');
      const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
      if (scene.id !== input.scene_id)
        throw new AppError(409, 'O mapa mudou. Prepare a magia novamente.');
      const actor = scene.tokens.find((t) => t.id === input.actor_id && t.layer !== 'map');
      if (!actor || (!gm && (actor.controller !== user || !canSee(actor, scene, user))))
        throw new AppError(403, 'Você não controla este conjurador.');
      const {
        rows: [prior],
      } = await db.query(
        'SELECT room_id,command,effect FROM vtt_spell_casts WHERE user_id=$1 AND idempotency_key=$2',
        [user, input.idempotency_key],
      );
      if (prior) {
        if (
          prior.room_id !== rid ||
          JSON.stringify(prior.command) !== JSON.stringify(JSON.parse(JSON.stringify(input)))
        ) {
          // jsonb preserves data but not object-key order.
          const normalize = (v: unknown): unknown =>
            Array.isArray(v)
              ? v.map(normalize)
              : v && typeof v === 'object'
                ? Object.fromEntries(
                    Object.entries(v)
                      .sort()
                      .map(([k, value]) => [k, normalize(value)]),
                  )
                : v;
          const keys = (v: unknown): string => JSON.stringify(normalize(v));
          if (prior.room_id !== rid || keys(prior.command) !== keys(input))
            throw new AppError(409, 'Esta confirmação já pertence a outra conjuração.');
        }
        return prior.effect as SpellEffect;
      }
      if (lost(actor)) throw new AppError(409, 'O conjurador está incapacitado.');
      let profile: SpellProfile | undefined,
        level = actor.sheet?.level || 1,
        ability = 1,
        snapshot: unknown = null,
        characterId: string | undefined;
      let sheetAccess: Awaited<ReturnType<typeof access>> | undefined;
      if (input.effect_id) {
        const {
          rows: [parent],
        } = await db.query(
          'SELECT effect,ended_at FROM vtt_spell_casts WHERE id=$1 AND room_id=$2 FOR UPDATE',
          [input.effect_id, rid],
        );
        const source = parent?.effect as SpellEffect | undefined;
        const caster = source && scene.tokens.find((t) => t.id === source.actorId);
        if (
          !source ||
          parent.ended_at ||
          source.sceneId !== scene.id ||
          (source.expires !== null && source.expires <= Date.now()) ||
          (source.concentration && lost(caster)) ||
          !source.targets.includes(actor.id)
        )
          throw new AppError(409, 'A magia que concede esta habilidade não está mais ativa.');
        profile = grantedBreath(source) || undefined;
        if (input.slot !== 0 || input.free)
          commandError('A baforada recebida não gasta outro espaço.');
      } else if (input.action_id) {
        if (!gm) throw new AppError(403, 'Habilidades de monstros são usadas pelo mestre.');
        const action = tokenMonsterActions(actor).find((a) => a.id === input.action_id);
        profile = action ? breathProfile(action) || undefined : undefined;
        if (input.slot !== 0 || input.free) commandError('Habilidades não gastam espaços.');
      } else {
        profile = spellProfile(input.spell_id!);
        snapshot = (await rawCatalog).spells.find((s: { id: string }) => s.id === input.spell_id);
        if (actor.characterId) {
          sheetAccess = await access(getRoom, db, rid, actor.id, user, true);
          characterId = sheetAccess.character.id;
          level = sheetAccess.character.level;
          const derived = sheetAccess.sheet?.choices
            ? deriveSheet(sheetAccess.character, sheetAccess.sheet.choices)
            : null;
          if (derived?.spellAbility !== undefined)
            ability = Math.floor((sheetAccess.character.stats[derived.spellAbility] - 10) / 2);
          const canonical =
            spells.find((s) => s.name === profile?.name)?.id ?? profile?.id.replace(/^spell-/, '');
          if (
            !gm &&
            (!canonical || !knownSpells(derived, sheetAccess.sheet?.prepared || []).has(canonical))
          )
            throw new AppError(403, 'Esta magia não está disponível na ficha.');
        } else if (!gm)
          throw new AppError(403, 'Importe o personagem com sua ficha para conjurar.');
      }
      if (!profile) throw new AppError(404, 'Magia ou área da habilidade indisponível.');
      if (input.free && !gm)
        throw new AppError(403, 'Somente o mestre pode conjurar sem gastar espaço.');
      if (
        (profile.level === 0 && input.slot !== 0) ||
        (profile.level > 0 && input.slot < profile.level)
      )
        commandError('Nível do espaço inválido.');
      if (
        (!profile.alternatives && input.variant) ||
        (profile.alternatives &&
          (!profile.alternatives[input.variant] ||
            (profile.alternatives[input.variant].minSlot || 0) > input.slot))
      )
        commandError('Forma da magia indisponível neste nível.');
      const p = preparedSpell(profile, input.slot, level, input.variant);
      if (p.objectBudget) p.count = Math.max(0, ability);
      const points = checkSelection(input, p, actor, scene, (t) => gm || canSee(t, scene, user));
      if (
        !gm &&
        p.id !== 'spell-dimension-door' &&
        points.some(
          (at) =>
            !canSee({ ...actor, id: randomUUID(), controller: '', x: at.x, y: at.y }, scene, user),
        )
      )
        throw new AppError(403, 'A área não está visível para seu personagem.');
      let movement: SpellEffect['movement'];
      if (['spell-misty-step', 'spell-dimension-door', 'spell-teleport'].includes(p.id)) {
        if (p.id === 'spell-teleport' && !gm)
          throw new AppError(
            403,
            'O mestre precisa resolver a familiaridade e confirmar o destino de Teleport. Nenhum espaço foi gasto.',
          );
        const travellers =
          p.id === 'spell-misty-step'
            ? [actor]
            : [...new Set(input.targets)].map((id) => scene.tokens.find((t) => t.id === id)!);
        if (travellers.some((t) => !gm && t.controller !== user))
          throw new AppError(
            403,
            'Para transportar outra pessoa, o mestre precisa confirmar que ela aceita acompanhar. Nenhum espaço foi gasto.',
          );
        try {
          movement = teleportArrivals(scene, travellers, points[0]);
        } catch (error) {
          throw new AppError(400, (error as Error).message);
        }
        if (
          p.id === 'spell-dimension-door' &&
          movement.some((m) => {
            const traveller = scene.tokens.find((t) => t.id === m.tokenId)!;
            const edgeGap = Math.max(
              0,
              Math.hypot(m.to.x - points[0].x, m.to.y - points[0].y) -
                (Math.max(traveller.width, traveller.height) +
                  Math.max(actor.width, actor.height)) /
                  2,
            );
            return edgeGap / (scene.grid.size / scene.grid.scale) > 5 + 0.01;
          })
        )
          throw new AppError(
            400,
            'O acompanhante precisa chegar em um espaço livre até 5 pés do conjurador.',
          );
      }
      if (profile.level > 0 && !input.free) {
        if (!sheetAccess)
          throw new AppError(400, 'Este conjurador precisa de ficha ou do modo livre do mestre.');
        const resource = await resources(db, sheetAccess.character, sheetAccess.sheet, true),
          index = input.slot - 1;
        if (resource.slots_used[index] >= resource.slots_total[index])
          throw new AppError(409, 'Não há espaços disponíveis neste nível.');
        resource.slots_used[index]++;
        await db.query(
          'UPDATE vtt_character_resources SET slots_used=$2,updated_at=now() WHERE character_id=$1',
          [characterId, JSON.stringify(resource.slots_used)],
        );
        await db.query(
          "INSERT INTO vtt_resource_uses(room_id,character_id,user_id,kind,slot,idempotency_key)VALUES($1,$2,$3,'slot',$4,$5)",
          [rid, characterId, user, input.slot, input.idempotency_key],
        );
      }
      if (p.concentration)
        await db.query(
          "UPDATE vtt_spell_casts SET ended_at=now(),ended_by=$3 WHERE room_id=$1 AND effect->>'actorId'=$2 AND (effect->>'concentration')::boolean=true AND ended_at IS NULL",
          [rid, actor.id, user],
        );
      const persistent = p.concentration || p.duration === null || p.duration > 0,
        started = Date.now();
      const e: SpellEffect = {
        id: randomUUID(),
        sceneId: scene.id,
        actorId: actor.id,
        spellId: profile.id,
        name: profile.name,
        slot: input.slot,
        variant: input.variant,
        targets: p.mode === 'self' ? [actor.id] : input.targets,
        points: points.length ? points : [{ x: actor.x, y: actor.y, angle: 0 }],
        profile: p,
        started,
        expires: persistent
          ? p.duration === null
            ? null
            : started + (p.duration || 60) * 1000
          : started + 6500,
        concentration: p.concentration,
        persistent,
        ...(characterId ? { characterId } : {}),
        ...(movement ? { movement } : {}),
      };
      const {
        rows: [active],
      } = await db.query(
        "SELECT count(*)::int AS n FROM vtt_spell_casts WHERE room_id=$1 AND ended_at IS NULL AND (effect->>'persistent')::boolean=true AND ((effect->>'expires') IS NULL OR (effect->>'expires')::bigint>$2)",
        [rid, started],
      );
      if (persistent && active.n >= 200)
        throw new AppError(409, 'Remova um efeito persistente antes de adicionar outro.');
      await db.query(
        'INSERT INTO vtt_spell_casts(id,room_id,user_id,idempotency_key,command,effect)VALUES($1,$2,$3,$4,$5,$6)',
        [e.id, rid, user, input.idempotency_key, JSON.stringify(input), JSON.stringify(e)],
      );
      if (movement) {
        applyTeleportArrivals(scene, movement);
        await db.query(
          'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
          [rid, JSON.stringify(r.document)],
        );
      }
      const count =
        p.mode === 'targets'
          ? input.targets.length + ' ' + (p.repeat ? 'raios/dardos' : 'alvos')
          : p.mode === 'area'
            ? points.length + ' áreas'
            : '';
      await db.query(
        'INSERT INTO vtt_messages(room_id,author_id,author,text,spell)VALUES($1,$2,$3,$4,$5)',
        [
          rid,
          user,
          res.locals.user.name,
          actor.name +
            ' · ' +
            profile.name +
            (input.slot ? ' · espaço ' + input.slot : '') +
            (count ? ' · ' + count : '') +
            (p.concentration ? ' · concentração' : ''),
          snapshot ? JSON.stringify(snapshot) : null,
        ],
      );
      return e;
    });
    res.status(201).json({ effect });
  });
  router.patch(base + '/:effect', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      eid = uuid.parse(req.params.effect),
      user = res.locals.user.id,
      input = spellMoveSchema.parse(req.body);
    const effect = await transaction(async (db) => {
      const r = await getRoom(db, rid, user, true),
        gm = r.owner_id === user && (await isAdministrator(user, db));
      if (r.role === 'spectator') throw new AppError(403, 'Espectadores apenas assistem à mesa.');
      const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
      const {
        rows: [row],
      } = await db.query(
        'SELECT effect,user_id,ended_at FROM vtt_spell_casts WHERE id=$1 AND room_id=$2 FOR UPDATE',
        [eid, rid],
      );
      const e = row?.effect as SpellEffect | undefined;
      if (
        !e ||
        row.ended_at ||
        e.sceneId !== scene.id ||
        input.scene_id !== scene.id ||
        (e.expires !== null && e.expires <= Date.now())
      )
        throw new AppError(409, 'Este efeito não está mais ativo neste mapa.');
      const actor = scene.tokens.find((t) => t.id === e.actorId);
      if (!actor || (!gm && (actor.controller !== user || !canSee(actor, scene, user))))
        throw new AppError(403, 'Você não controla este efeito.');
      if (!e.profile.movable || !e.persistent || e.profile.follow || e.profile.areaFromTargets)
        commandError('Esta magia não permite reposicionar a área.');
      if (e.concentration && lost(actor)) throw new AppError(409, 'A concentração foi encerrada.');
      const p = { ...e.profile, mode: 'area' as const };
      const points = checkSelection(
        {
          actor_id: actor.id,
          scene_id: scene.id,
          spell_id: e.spellId,
          slot: e.slot,
          variant: e.variant,
          targets: [],
          points: input.points,
          free: true,
          idempotency_key: randomUUID(),
        },
        p,
        actor,
        scene,
        (t) => gm || canSee(t, scene, user),
      );
      if (
        !gm &&
        points.some(
          (at) =>
            !canSee({ ...actor, id: randomUUID(), controller: '', x: at.x, y: at.y }, scene, user),
        )
      )
        throw new AppError(403, 'A área não está visível para seu personagem.');
      const moved = { ...e, points };
      await db.query('UPDATE vtt_spell_casts SET effect=$2 WHERE id=$1 AND ended_at IS NULL', [
        eid,
        JSON.stringify(moved),
      ]);
      return moved;
    });
    res.json({ effect });
  });
  router.delete(base + '/:effect', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      eid = uuid.parse(req.params.effect),
      user = res.locals.user.id;
    await transaction(async (db) => {
      const r = await getRoom(db, rid, user, true),
        gm = r.owner_id === user && (await isAdministrator(user, db));
      const {
        rows: [row],
      } = await db.query('SELECT effect,user_id FROM vtt_spell_casts WHERE id=$1 AND room_id=$2', [
        eid,
        rid,
      ]);
      if (!row) throw new AppError(404, 'Efeito não encontrado.');
      const e = row.effect as SpellEffect,
        actor = r.document.scenes
          .find((s) => s.id === e.sceneId)
          ?.tokens.find((t) => t.id === e.actorId);
      if (!gm && (r.role === 'spectator' || actor?.controller !== user))
        throw new AppError(403, 'Somente o mestre ou conjurador pode encerrar este efeito.');
      await db.query(
        'UPDATE vtt_spell_casts SET ended_at=now(),ended_by=$3 WHERE room_id=$1 AND id=$2 AND ended_at IS NULL',
        [rid, eid, user],
      );
    });
    res.json({ ok: true });
  });
  return router;
}

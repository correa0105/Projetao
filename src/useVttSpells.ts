import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { vttErrorMessage } from '../shared/vtt-protocol';
import {
  spellProfile,
  preparedSpell,
  validSpellSelection,
  spellOrigin,
  feetDistance,
  areaContainsToken,
  pixelsPerFoot,
  breathProfile,
  grantedBreath,
  type SpellProfile,
  type SpellPlacement,
  type SpellEffect,
  type SpellCastCommand,
} from '../shared/vtt-spells';
import type { Point, VttScene, VttToken } from '../shared/vtt';
import type { VttSheetData } from '../shared/vtt-sheet';
import type { MonsterAction } from '../shared/vtt-monster-actions';
type Start = {
  actorId: string;
  spellId?: string;
  action?: MonsterAction;
  effect?: SpellEffect;
  move?: boolean;
};
export function requestSpellCast(actorId: string, spellId?: string, action?: MonsterAction) {
  window.dispatchEvent(
    new CustomEvent('vtt-prepare-spell', { detail: { actorId, spellId, action } }),
  );
}
export type SpellPreparation = {
  actorId: string;
  source: SpellProfile;
  slot: number;
  variant: number;
  free: boolean;
  targets: string[];
  points: SpellPlacement[];
  pointer: SpellPlacement | null;
  anchor: Point | null;
  data: VttSheetData | null;
  actionId?: string;
  effectId?: string;
  moveEffectId?: string;
};
export function useVttSpells(
  roomId: string | undefined,
  scene: VttScene | undefined,
  userId: string,
  gm: boolean,
  save: () => Promise<unknown>,
  refresh: () => Promise<unknown>,
) {
  const [effects, setEffects] = useState<SpellEffect[]>([]),
    [loaded, setLoaded] = useState(false),
    [pending, setPending] = useState<SpellPreparation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const busyRef = useRef(false),
    generation = useRef(0),
    confirmed = useRef<{ key: string; input: string } | null>(null);
  const initialSnapshot = useRef(false),
    oldTransient = useRef(new Set<string>());
  const url = '/vtt/rooms/' + roomId + '/spells';
  async function load() {
    if (!roomId) return;
    const d = await api<{ effects: SpellEffect[]; serverTime: number }>(url);
    const drift = Date.now() - d.serverTime;
    setEffects(
      d.effects
        .filter((e) => !oldTransient.current.has(e.id))
        .map((e) => ({
          ...e,
          started: e.started + drift,
          expires: e.expires === null ? null : e.expires + drift,
        })),
    );
  }
  useEffect(() => {
    initialSnapshot.current = false;
    oldTransient.current.clear();
    setEffects([]);
    setLoaded(false);
    if (!roomId) {
      setEffects([]);
      return;
    }
    let live = true,
      polling = false;
    const poll = async () => {
      if (!live || polling || document.hidden) return;
      polling = true;
      try {
        const d = await api<{ effects: SpellEffect[]; serverTime: number }>(url);
        if (live) {
          if (!initialSnapshot.current) {
            for (const e of d.effects) if (!e.persistent) oldTransient.current.add(e.id);
            initialSnapshot.current = true;
          }
          const drift = Date.now() - d.serverTime;
          setEffects(
            d.effects
              .filter((e) => !oldTransient.current.has(e.id))
              .map((e) => ({
                ...e,
                started: e.started + drift,
                expires: e.expires === null ? null : e.expires + drift,
              })),
          );
          setLoaded(true);
        }
      } catch {
        /* Room polling reports connection errors. */
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [url, scene?.id]);
  useEffect(() => {
    generation.current++;
    setPending(null);
    setError('');
    confirmed.current = null;
  }, [roomId, scene?.id]);
  useEffect(() => {
    const begin = async (event: Event) => {
      const request = (event as CustomEvent<Start>).detail;
      if (!scene || !roomId || busyRef.current) return;
      const actor = scene.tokens.find((t) => t.id === request.actorId);
      if (!actor || (!gm && actor.controller !== userId)) return;
      const source = request.effect
        ? request.move
          ? request.effect.profile
          : grantedBreath(request.effect)
        : request.action
          ? breathProfile(request.action)
          : spellProfile(request.spellId || '');
      if (!source) {
        setError('Esta habilidade não define uma área reconhecida.');
        return;
      }
      const generationId = ++generation.current;
      setError('');
      setBusy(true);
      busyRef.current = true;
      try {
        await save();
        const data = actor.characterId
          ? await api<VttSheetData>('/vtt/rooms/' + roomId + '/sheets/' + actor.id)
          : null;
        if (generationId !== generation.current) return;
        const slot = request.move
          ? request.effect!.slot
          : source.level === 0
            ? 0
            : Array.from({ length: 10 - source.level }, (_, i) => source.level + i).find(
                (n) =>
                  data &&
                  (data.resources.slots_total[n - 1] || 0) >
                    (data.resources.slots_used[n - 1] || 0),
              ) || source.level;
        setPending({
          actorId: actor.id,
          source,
          slot,
          variant: 0,
          free: !request.effect && gm && !actor.characterId && !request.action,
          targets: source.includeSelf ? [actor.id] : [],
          points: [],
          pointer: null,
          anchor: null,
          data,
          actionId: request.action?.id,
          effectId: request.effect && !request.move ? request.effect.id : undefined,
          moveEffectId: request.move ? request.effect?.id : undefined,
        });
        confirmed.current = null;
      } catch (e) {
        setError(vttErrorMessage(e));
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    };
    window.addEventListener('vtt-prepare-spell', begin);
    return () => window.removeEventListener('vtt-prepare-spell', begin);
  }, [roomId, scene, gm, userId, save]);
  const actor = scene?.tokens.find((t) => t.id === pending?.actorId);
  let profile = pending
    ? pending.moveEffectId
      ? pending.source
      : preparedSpell(
          pending.source,
          pending.slot,
          pending.data?.character.level || actor?.sheet?.level || 1,
          pending.variant,
        )
    : null;
  if (profile?.objectBudget) {
    const ability = pending?.data?.derived?.spellAbility;
    profile = {
      ...profile,
      count:
        ability === undefined
          ? 1
          : Math.max(0, Math.floor(((pending!.data!.character.stats[ability] || 10) - 10) / 2)),
    };
  }
  const preview =
    profile && pending && actor
      ? {
          profile: profile.destinationRange
            ? {
                ...profile,
                mode: 'point' as const,
                shape: 'cube' as const,
                size: 5,
                range: profile.destinationRange,
              }
            : profile,
          actorId: actor.id,
          targets: pending.targets,
          points: profile.areaFromTargets
            ? pending.targets.map((id) => {
                const t = scene!.tokens.find((t) => t.id === id)!;
                return { x: t.x, y: t.y, angle: 0 };
              })
            : [
                ...pending.points,
                ...(pending.pointer &&
                (profile.mode !== 'targets' || profile.destinationRange) &&
                pending.points.length < profile.areas
                  ? [spellOrigin(profile, actor, pending.pointer)]
                  : []),
              ],
        }
      : null;
  function update(patch: Partial<SpellPreparation>) {
    if (busyRef.current) return;
    setPending((old) => {
      if (!old) return null;
      const next = { ...old, ...patch },
        p = preparedSpell(next.source, next.slot, next.data?.character.level || 1, next.variant);
      return {
        ...next,
        targets: (p.includeSelf
          ? [next.actorId, ...next.targets.filter((id) => id !== next.actorId)]
          : next.targets
        ).slice(0, p.count),
        points: patch.variant !== undefined ? [] : next.points.slice(0, p.areas),
        pointer: null,
        anchor: null,
      };
    });
    setError('');
  }
  function hover(point: Point) {
    if (!pending || !profile || !actor || busyRef.current) return false;
    const anchor = pending.anchor || (profile.origin.startsWith('caster') ? actor : point);
    setPending(
      (old) =>
        old && {
          ...old,
          pointer: {
            x: anchor.x,
            y: anchor.y,
            angle: Math.atan2(point.y - anchor.y, point.x - anchor.x),
          },
        },
    );
    return true;
  }
  function choose(point: Point, token?: VttToken) {
    if (!pending || !profile || !actor || busyRef.current) return false;
    setError('');
    if (
      !pending.moveEffectId &&
      profile.mode === 'targets' &&
      (!profile.destinationRange || token) &&
      (!profile.shape || profile.areaFromTargets || pending.points.length)
    ) {
      if (!token) {
        setError('Clique em um token para selecionar o alvo.');
        return true;
      }
      const origin =
        profile.chain && pending.targets.length
          ? scene!.tokens.find(
              (t) =>
                t.id === pending.targets[profile.chainFromLast ? pending.targets.length - 1 : 0],
            )!
          : actor;
      const range = profile.chain && pending.targets.length ? profile.chain : profile.range;
      const allowance =
        range <= 5
          ? (Math.max(actor.width, actor.height) + Math.max(token.width, token.height)) /
            2 /
            pixelsPerFoot(scene!.grid)
          : 0;
      if (feetDistance(origin, token, scene!.grid) > range + allowance + 0.01) {
        setError('Este alvo está fora do alcance.');
        return true;
      }
      if (
        profile.shape &&
        !profile.areaFromTargets &&
        !areaContainsToken(token, profile, pending.points, scene!)
      ) {
        setError('Este alvo não está na área marcada.');
        return true;
      }
      setPending((old) => {
        if (!old) return null;
        if (profile.includeSelf && token.id === actor.id) return old;
        if (!profile!.repeat && old.targets.includes(token.id))
          return {
            ...old,
            targets: profile.chainFromLast
              ? old.targets.slice(0, old.targets.indexOf(token.id))
              : old.targets.filter((id) => id !== token.id),
          };
        if (old.targets.length >= profile!.count) {
          setError('Limite de alvos atingido. Remova uma seleção para trocar.');
          return old;
        }
        return { ...old, targets: [...old.targets, token.id] };
      });
      return true;
    }
    if (profile.mode === 'self') {
      return true;
    }
    if (pending.points.length >= profile.areas) {
      setError('Área já marcada. Use Desfazer para reposicionar.');
      return true;
    }
    const oriented =
      profile.shape === 'wall' || (profile.shape === 'line' && profile.origin === 'point');
    if (oriented && !pending.anchor) {
      setPending((old) => old && { ...old, anchor: point, pointer: { ...point, angle: 0 } });
      return true;
    }
    const anchor = pending.anchor || (profile.origin.startsWith('caster') ? actor : point);
    const at = spellOrigin(profile, actor, {
      x: anchor.x,
      y: anchor.y,
      angle: Math.atan2(point.y - anchor.y, point.x - anchor.x),
    });
    if (
      profile.origin === 'point' &&
      !profile.follow &&
      feetDistance(actor, at, scene!.grid) > (profile.destinationRange || profile.range) + 0.01
    ) {
      setError('Este ponto está fora do alcance.');
      return true;
    }
    setPending(
      (old) => old && { ...old, points: [...old.points, at], pointer: null, anchor: null },
    );
    return true;
  }
  async function cast() {
    if (!pending || !profile || !scene || !actor || busyRef.current) return;
    if (!validSpellSelection(profile, pending.targets, pending.points)) {
      setError('Complete a seleção antes de conjurar.');
      return;
    }
    if (
      profile.shape &&
      profile.mode === 'targets' &&
      !profile.areaFromTargets &&
      !pending.points.length
    ) {
      setError('Marque a área da magia.');
      return;
    }
    const body = {
      actor_id: actor.id,
      scene_id: scene.id,
      ...(pending.effectId
        ? { effect_id: pending.effectId }
        : pending.actionId
          ? { action_id: pending.actionId }
          : { spell_id: pending.source.id }),
      slot: pending.slot,
      variant: pending.variant,
      targets: pending.targets,
      points: pending.points,
      free: pending.free,
    };
    const fingerprint = JSON.stringify(body);
    if (confirmed.current?.input !== fingerprint)
      confirmed.current = { input: fingerprint, key: crypto.randomUUID() };
    const command: SpellCastCommand = { ...body, idempotency_key: confirmed.current.key };
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await save();
      if (pending.moveEffectId)
        await api(url + '/' + pending.moveEffectId, {
          method: 'PATCH',
          body: JSON.stringify({ scene_id: scene.id, points: pending.points }),
        });
      else await api(url, { method: 'POST', body: JSON.stringify(command) });
      setPending(null);
      confirmed.current = null;
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setError(vttErrorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setError('');
    try {
      await api(url + '/' + id, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(vttErrorMessage(e));
    }
  }
  const ready =
    !!profile &&
    !!pending &&
    validSpellSelection(profile, pending.targets, pending.points) &&
    (!profile.shape ||
      profile.mode !== 'targets' ||
      profile.areaFromTargets ||
      pending.points.length > 0);
  const available =
    pending &&
    (pending.moveEffectId ||
      pending.effectId ||
      pending.slot === 0 ||
      pending.free ||
      (pending.data?.resources.slots_total[pending.slot - 1] || 0) >
        (pending.data?.resources.slots_used[pending.slot - 1] || 0));
  return {
    effects,
    loaded,
    pending,
    profile,
    preview,
    actor,
    busy,
    error,
    ready,
    available,
    update,
    hover,
    choose,
    cast,
    remove,
    move: (effect: SpellEffect) =>
      window.dispatchEvent(
        new CustomEvent('vtt-prepare-spell', {
          detail: { actorId: effect.actorId, effect, move: true },
        }),
      ),
    exhale: (effect: SpellEffect, actorId: string) =>
      window.dispatchEvent(new CustomEvent('vtt-prepare-spell', { detail: { actorId, effect } })),
    cancel: () => {
      if (!busyRef.current) {
        generation.current++;
        setPending(null);
        setError('');
      }
    },
    undo: () => {
      setPending(
        (old) =>
          old && {
            ...old,
            targets:
              old.targets.length > (old.source.includeSelf ? 1 : 0)
                ? old.targets.slice(0, -1)
                : old.targets,
            points:
              old.targets.length > (old.source.includeSelf ? 1 : 0)
                ? old.points
                : old.points.slice(0, -1),
            pointer: null,
            anchor: null,
          },
      );
      setError('');
    },
    clearError: () => setError(''),
  };
}
export type VttSpellsController = ReturnType<typeof useVttSpells>;

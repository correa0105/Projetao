import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { transaction } from './db.js';
import { AppError } from './services.js';
import { access, type RoomAccess } from './vtt-sheet.js';
import { readVttLoadout } from './vtt-weapon-loadout.js';
import { attackFormula, attackOutcome, criticalDamage } from '../shared/vtt-attack.js';
import { weaponKind, weaponStyle } from '../shared/vtt-attack-visual.js';
import { rollFormula } from '../shared/vtt-roll.js';
import { distance, type VttScene, type VttToken } from '../shared/vtt.js';
import { prestigeWeapon, type PrestigeWeapon } from '../shared/prestige-weapons.js';

const uuid = z.string().uuid();
const messageId = z.string().regex(/^\d{1,19}$/);
const signed = (bonus: number) => (bonus < 0 ? String(bonus) : '+' + bonus);

export function prestigeExtraDamage(
  weapon: PrestigeWeapon,
  level: number,
  critical: boolean,
  actor: VttToken,
  target: VttToken,
  scene: VttScene,
) {
  if (level < weapon.effectLevel) return '';
  switch (weapon.effect) {
    case 'critical':
      return critical ? '+1d4' : '';
    case 'distant': {
      const feet = distance(actor, target, scene.grid) / (scene.grid.unit === 'm' ? 0.3048 : 1);
      return feet >= 40 && feet <= 150 ? '+2' : '';
    }
    case 'wounded-wielder':
      return actor.hp > 0 && actor.hp * 2 <= actor.maxHp ? '+2' : '';
    case 'wounded-target':
      return target.hp > 0 && target.hp * 2 <= target.maxHp ? '+1' : '';
  }
}

export function vttPrestigeWeaponsRouter(
  room: RoomAccess,
  visible: (token: VttToken, scene: VttScene, user: string) => boolean,
  state: (id: string, user: string) => Promise<object>,
) {
  const router = Router();
  router.post('/vtt/rooms/:id/prestige-attacks', async (req, res) => {
    const rid = uuid.parse(req.params.id);
    const user = res.locals.user.id as string;
    const input = z
      .object({
        request_id: uuid,
        actor_id: uuid,
        target_id: uuid,
        item_id: z.string().min(1).max(120),
        mode: z.enum(['normal', 'advantage', 'disadvantage']),
        visual: z.boolean(),
        private: z.boolean(),
      })
      .strict()
      .parse(req.body);
    const weapon = prestigeWeapon(input.item_id);
    if (!weapon) throw new AppError(400, 'Arma de Prestígio inválida.');
    const result = await transaction(async (db) => {
      const a = await access(room, db, rid, input.actor_id, user, true);
      const {
        rows: [previous],
      } = await db.query(
        `SELECT attack_message_id::text,actor_id,target_id,item_id,mode,critical,damage_formula
         FROM vtt_prestige_weapon_attacks WHERE room_id=$1 AND author_id=$2 AND request_id=$3`,
        [rid, user, input.request_id],
      );
      if (previous) {
        if (
          previous.actor_id !== input.actor_id ||
          previous.target_id !== input.target_id ||
          previous.item_id !== input.item_id ||
          previous.mode !== input.mode
        )
          throw new AppError(409, 'Este pedido já foi usado para outro ataque.');
        return {
          id: previous.attack_message_id,
          hit: !!previous.damage_formula,
          critical: previous.critical,
        };
      }
      const scene = a.room.document.scenes.find((s) => s.id === a.room.document.activeScene)!;
      const target = scene.tokens.find(
        (token) => token.id === input.target_id && token.layer === 'tokens',
      );
      if (
        !a.canUse ||
        a.token.layer !== 'tokens' ||
        a.token.hp <= 0 ||
        !target ||
        target.id === a.token.id ||
        (!a.isGm && !visible(target, scene, user))
      )
        throw new AppError(403, 'Atacante ou alvo indisponível.');
      if (!a.sheet?.finalized_at) throw new AppError(409, 'Finalize a ficha para usar esta arma.');
      const loadout = await readVttLoadout(db, rid, a.character, a.sheet.choices);
      const attack = loadout.attacks.find((entry) => entry.itemId === weapon.id);
      if (!attack || attack.dice === '—')
        throw new AppError(409, 'Equipe esta arma antes de atacar.');
      const rolled = rollFormula(
        attackFormula('1d20' + signed(attack.attack), input.mode),
        randomInt,
      );
      const { hit, critical } = attackOutcome(rolled, target.ac);
      const normalDamage = attack.dice + signed(attack.ability);
      const formula = hit
        ? (critical ? criticalDamage(normalDamage).join('+') : normalDamage) +
          prestigeExtraDamage(weapon, a.character.level, critical, a.token, target, scene)
        : null;
      const style = weaponStyle(attack.baseName);
      const visual = input.visual
        ? {
            actor_id: a.token.id,
            target_id: target.id,
            sceneId: scene.id,
            kind: weaponKind(style),
            weapon: style,
            hit,
            critical,
          }
        : null;
      const {
        rows: [message],
      } = await db.query(
        `INSERT INTO vtt_messages(room_id,author_id,author,text,roll,private,attack_visual)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text`,
        [
          rid,
          user,
          res.locals.user.name,
          `${a.token.name} · ${attack.name} → ${target.name} · ataque`,
          JSON.stringify(rolled),
          input.private,
          visual ? JSON.stringify(visual) : null,
        ],
      );
      await db.query(
        `INSERT INTO vtt_prestige_weapon_attacks
           (attack_message_id,room_id,author_id,request_id,scene_id,actor_id,target_id,item_id,mode,critical,damage_formula)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          message.id,
          rid,
          user,
          input.request_id,
          scene.id,
          a.token.id,
          target.id,
          weapon.id,
          input.mode,
          critical,
          formula,
        ],
      );
      return { id: message.id, hit, critical };
    });
    res.status(201).json({
      ...(await state(rid, user)),
      createdMessageId: result.id,
      weaponOutcome: { hit: result.hit, critical: result.critical },
    });
  });

  router.post('/vtt/rooms/:id/prestige-attacks/:attack/damage', async (req, res) => {
    const rid = uuid.parse(req.params.id);
    const id = messageId.parse(req.params.attack);
    const user = res.locals.user.id as string;
    const damageId = await transaction(async (db) => {
      const current = await room(db, rid, user, true);
      if (current.role === 'spectator')
        throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
      const {
        rows: [attack],
      } = await db.query(
        `SELECT a.*, m.private FROM vtt_prestige_weapon_attacks a JOIN vtt_messages m ON m.id=a.attack_message_id
         WHERE a.room_id=$1 AND a.attack_message_id=$2 AND a.author_id=$3 FOR UPDATE OF a`,
        [rid, id, user],
      );
      if (!attack) throw new AppError(404, 'Ataque de Prestígio não encontrado.');
      if (!attack.damage_formula)
        throw new AppError(409, 'Role o dano depois de acertar o ataque.');
      if (attack.damage_message_id) return String(attack.damage_message_id);
      if (attack.scene_id !== current.document.activeScene)
        throw new AppError(409, 'Volte ao mapa do ataque.');
      const a = await access(room, db, rid, attack.actor_id, user);
      const scene = current.document.scenes.find((s) => s.id === attack.scene_id)!;
      const target = scene.tokens.find(
        (token) => token.id === attack.target_id && token.layer === 'tokens',
      );
      if (
        !a.canUse ||
        a.token.layer !== 'tokens' ||
        !target ||
        (!a.isGm && !visible(target, scene, user))
      )
        throw new AppError(403, 'Atacante ou alvo indisponível.');
      if (!a.sheet?.finalized_at) throw new AppError(409, 'Finalize a ficha para usar esta arma.');
      const loadout = await readVttLoadout(db, rid, a.character, a.sheet.choices);
      const weapon = loadout.attacks.find((entry) => entry.itemId === attack.item_id);
      if (!weapon)
        throw new AppError(409, 'A arma precisa continuar equipada para rolar este dano.');
      const rolled = rollFormula(attack.damage_formula, randomInt);
      const {
        rows: [message],
      } = await db.query(
        `INSERT INTO vtt_messages(room_id,author_id,author,text,roll,private,damage)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text`,
        [
          rid,
          user,
          res.locals.user.name,
          `${a.token.name} · ${weapon.name} → ${target.name} · dano${attack.critical ? ' crítico' : ''}`,
          JSON.stringify(rolled),
          attack.private,
          JSON.stringify({ actor_id: a.token.id, target_id: target.id, target_name: target.name }),
        ],
      );
      await db.query(
        'UPDATE vtt_prestige_weapon_attacks SET damage_message_id=$2 WHERE attack_message_id=$1',
        [id, message.id],
      );
      return message.id as string;
    });
    res.status(201).json({ ...(await state(rid, user)), createdMessageId: damageId });
  });
  return router;
}

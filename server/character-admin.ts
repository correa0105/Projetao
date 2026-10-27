import { Router } from 'express';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { requireAdministrator } from './administrators.js';
import { adminCharacterEditSchema } from '../shared/character-admin.js';
import {
  defaultChoices,
  validateChoices,
  deriveSheet,
  type SheetChoices,
} from '../shared/character-sheet.js';
import { advanceChoiceSchema, type AdvancementState } from '../shared/character-advancement.js';
import { applyTokenDeath, type VttDocument } from '../shared/vtt.js';

type DB = Pick<PoolClient, 'query'>;
const uuid = z.string().uuid();
const revision = (character: unknown, sheet: unknown) =>
  createHash('sha256').update(JSON.stringify({ character, sheet })).digest('hex');
async function read(db: DB, id: string, lock = false) {
  const character = (
    await db.query(
      'SELECT * FROM characters WHERE id=$1 AND deleted_at IS NULL' + (lock ? ' FOR UPDATE' : ''),
      [id],
    )
  ).rows[0];
  if (!character) throw new AppError(404, 'Personagem não encontrado.');
  const sheet =
    (
      await db.query(
        'SELECT * FROM character_sheets WHERE character_id=$1' + (lock ? ' FOR UPDATE' : ''),
        [id],
      )
    ).rows[0] ?? null;
  return { character, sheet, revision: revision(character, sheet) };
}
async function result(db: DB, id: string) {
  const data = await read(db, id);
  const pending = (
    await db.query(
      "SELECT 1 FROM character_art_jobs WHERE character_id=$1 AND(status IN('queued','running')OR art_decision='pending')LIMIT 1",
      [id],
    )
  ).rowCount;
  const owner = (await db.query('SELECT name FROM "user" WHERE id=$1', [data.character.user_id]))
    .rows[0];
  const choices = data.sheet?.choices ?? defaultChoices(data.character.race, data.character.class);
  return {
    ...data,
    owner_name: owner.name,
    choices,
    derived: deriveSheet(data.character, choices),
    art_pending: !!pending,
  };
}
function advancement(
  input: unknown,
  previous: AdvancementState | undefined,
  level: number,
  baseClass: string,
  actor: string,
): AdvancementState | undefined {
  if (input === undefined)
    return previous
      ? { ...previous, levels: previous.levels.filter((r) => r.characterLevel <= level) }
      : undefined;
  const a = z
    .object({
      version: z.literal(1),
      levels: z
        .array(
          advanceChoiceSchema.extend({
            characterLevel: z.number().int().min(2).max(20),
            classLevel: z.number().int().min(1).max(20),
            requestId: uuid,
            actor: z.string().max(100),
            createdAt: z.string().max(50),
            granted: z.boolean(),
          }),
        )
        .max(19),
      initialSpells: z.array(z.string().max(100)).max(100).optional(),
      prepared: z.record(z.string().max(40), z.array(z.string().max(100)).max(100)).optional(),
      slotsUsed: z.array(z.number().int().min(0).max(99)).length(9).optional(),
      pactUsed: z.number().int().min(0).max(99).optional(),
      styleChanges: z
        .array(
          z.object({
            classLevel: z.number().int().min(1).max(20),
            from: z.string().max(100),
            to: z.string().max(100),
            requestId: uuid,
            createdAt: z.string().max(50),
          }),
        )
        .max(40)
        .optional(),
    })
    .strict()
    .parse(input);
  const counts: Record<string, number> = { [baseClass]: 1 };
  const rows = a.levels
    .filter((r) => r.characterLevel <= level)
    .map((row, index) => {
      if (row.characterLevel !== index + 2)
        throw new AppError(400, 'Registre os avanços em sequência, a partir do nível 2.');
      const classLevel = (counts[row.class] ?? 0) + 1;
      counts[row.class] = classLevel;
      const next = { ...row, classLevel };
      return isDeepStrictEqual(next, previous?.levels[index])
        ? next
        : {
            ...next,
            actor,
            createdAt: new Date().toISOString(),
            requestId: randomUUID(),
            granted: true,
          };
    });
  return { ...a, levels: rows };
}
export function characterAdminRouter() {
  const router = Router();
  router.get('/admin/characters', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const q = z
      .string()
      .max(100)
      .parse(req.query.q ?? '')
      .trim();
    res
      .set('Cache-Control', 'no-store')
      .json(
        (
          await pool.query(
            'SELECT c.id,c.name,c.race,c.class,c.level,u.name owner_name FROM characters c JOIN "user" u ON u.id=c.user_id WHERE c.deleted_at IS NULL AND(c.name ILIKE $1 OR u.name ILIKE $1)ORDER BY c.name,c.id LIMIT 60',
            ['%' + q + '%'],
          )
        ).rows,
      );
  });
  router.get('/admin/characters/:id', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    res.set('Cache-Control', 'no-store').json(await result(pool, uuid.parse(req.params.id)));
  });
  router.post('/admin/characters/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      actor = res.locals.user.id;
    await requireAdministrator(actor);
    const body = adminCharacterEditSchema.parse(req.body);
    await transaction(async (db) => {
      await requireAdministrator(actor, db);
      const owner = (await db.query('SELECT user_id FROM characters WHERE id=$1', [id])).rows[0];
      if (!owner) throw new AppError(404, 'Personagem não encontrado.');
      await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [owner.user_id]);
      const before = await read(db, id, true),
        old = before.character,
        s = before.sheet;
      if (before.revision !== body.revision)
        throw new AppError(
          409,
          'Esta ficha mudou em outra janela. Reabra para conferir antes de salvar.',
        );
      let choices: SheetChoices;
      try {
        choices = validateChoices(
          body.race,
          body.class,
          body.choices ?? defaultChoices(body.race, body.class),
        );
      } catch (e) {
        throw new AppError(400, e instanceof Error ? e.message : 'Confira as escolhas da ficha.');
      }
      choices.advancement = advancement(
        (body.choices as SheetChoices)?.advancement,
        s?.choices?.advancement,
        body.level,
        body.class,
        actor,
      );
      if (choices.species !== body.race)
        throw new AppError(400, 'A espécie das escolhas precisa corresponder à do personagem.');
      const appearanceKeys = [
        'physicalTraits',
        'startingOutfit',
        'facialHair',
        'tieflingHorns',
        'warforgedAppearance',
        'warforgedBody',
        'warforgedArtMode',
        'appearance',
      ] as const;
      const visualChanged =
        body.name !== old.name ||
        body.race !== old.race ||
        body.class !== old.class ||
        appearanceKeys.some((k) => !isDeepStrictEqual(choices[k], s?.choices?.[k]));
      if (
        visualChanged &&
        (
          await db.query(
            "SELECT 1 FROM character_art_jobs WHERE character_id=$1 AND(status IN('queued','running')OR art_decision='pending')LIMIT 1",
            [id],
          )
        ).rowCount
      )
        throw new AppError(
          409,
          'Há uma arte em preparação ou aguardando escolha. Conclua esse pedido antes de alterar a aparência.',
        );
      const next = {
        ...old,
        name: body.name,
        race: body.race,
        class: body.class,
        level: body.level,
        stats: body.stats,
        sheet_overrides: body.overrides,
      };
      const derived = deriveSheet(next, choices);
      if (body.resources.current_hp !== null && body.resources.current_hp > derived.hp)
        throw new AppError(400, 'Os PV atuais não podem ultrapassar os PV máximos.');
      if (body.resources.hit_dice_used > body.level)
        throw new AppError(400, 'Dados de vida gastos excedem o nível.');
      await db.query(
        'UPDATE characters SET name=$2,race=$3,class=$4,level=$5,background=$6,biography=$7,stats=$8,hp=$9,armor_class=$10,gold_cp=$11,progression_missions=$12,sheet_overrides=$13 WHERE id=$1',
        [
          id,
          body.name,
          body.race,
          body.class,
          body.level,
          choices.backgroundType,
          body.biography,
          JSON.stringify(body.stats),
          derived.hp,
          derived.armorClass,
          body.gold_cp,
          body.progression_missions,
          JSON.stringify(body.overrides),
        ],
      );
      await db.query(
        'INSERT INTO character_sheets(character_id,choices)VALUES($1,$2)ON CONFLICT(character_id)DO UPDATE SET choices=excluded.choices,updated_at=now()',
        [id, JSON.stringify(choices)],
      );
      const r = body.resources;
      await db.query(
        'UPDATE character_sheets SET prepared=$2,notes=$3,current_hp=$4,temp_hp=$5,inspiration=$6,death_success=$7,death_failure=$8,slots_used=$9,hit_dice_used=$10,updated_at=now()WHERE character_id=$1',
        [
          id,
          JSON.stringify(r.prepared),
          r.notes,
          r.current_hp,
          r.temp_hp,
          r.inspiration,
          r.death_success,
          r.death_failure,
          r.slots_used,
          r.hit_dice_used,
        ],
      );
      if (body.level >= 4 && old.creation_slot)
        await db.query(
          'UPDATE character_slot_rolls SET matured=true WHERE user_id=$1 AND slot=$2 AND character_id=$3 AND NOT matured',
          [owner.user_id, old.creation_slot, id],
        );
      const rooms = (
        await db.query(
          'SELECT r.id,r.document FROM vtt_rooms r JOIN vtt_character_links l ON l.room_id=r.id WHERE l.character_id=$1 ORDER BY r.id FOR UPDATE OF r',
          [id],
        )
      ).rows;
      for (const room of rooms) {
        let changed = false;
        const doc = room.document as VttDocument;
        for (const scene of doc.scenes)
          for (const token of scene.tokens)
            if (token.characterId === id && token.controller === owner.user_id) {
              const hp = r.current_hp ?? derived.hp;
              const updateHp = hp !== (s?.current_hp ?? old.hp);
              const updateMaxHp = derived.hp !== old.hp;
              const updateAc = derived.armorClass !== old.armor_class;
              if (
                (updateHp && token.hp !== hp) ||
                (updateMaxHp && token.maxHp !== derived.hp) ||
                (updateAc && token.ac !== derived.armorClass) ||
                (token.name === old.name && token.name !== body.name)
              ) {
                const previousHp = token.hp;
                if (updateHp) token.hp = hp;
                if (updateMaxHp) token.maxHp = derived.hp;
                if (updateAc) token.ac = derived.armorClass;
                if (token.name === old.name) token.name = body.name;
                applyTokenDeath(token, previousHp, Date.now(), doc.automaticDeath);
                changed = true;
              }
            }
        if (changed)
          await db.query(
            'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now()WHERE id=$1',
            [room.id, JSON.stringify(doc)],
          );
      }
      const after = await read(db, id);
      await db.query(
        'INSERT INTO character_admin_edits(character_id,actor_id,reason,before_data,after_data)VALUES($1,$2,$3,$4,$5)',
        [
          id,
          actor,
          body.reason,
          JSON.stringify({ character: old, sheet: s }),
          JSON.stringify({ character: after.character, sheet: after.sheet }),
        ],
      );
    });
    res.json(await result(pool, id));
  });
  return router;
}

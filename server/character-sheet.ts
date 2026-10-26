import { Router } from 'express';
import {spellReference} from './spell-reference.js';
import { grantCharacterStartingGold } from './character-starting-gold.js';
import { rollCharacterAbilities } from './ability-rolls.js';
import {characterSlotPool} from './character-slot-rolls.js';
import { abilityRollResult } from '../shared/ability-rolls.js';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { readCharacterLoadout } from './character-attacks.js';
import { isDeepStrictEqual } from 'node:util';
import { isAdministrator, requireAdministrator } from './administrators.js';
import {
  allocatedLevel,
  advanceChoiceSchema,
  validateAdvance,
  advancementStats,
  magicClasses,
  combinedSlots,
  classStates,
  type AdvancementState,
} from '../shared/character-advancement.js';
import {
  validateChoices,
  deriveSheet,
  racialBonuses,
  validateRestChoices,
  classRules,
  spellOptions,
  type SheetRecord,
} from '../shared/character-sheet.js';
import { fightingStyles } from '../shared/fighting-styles.js';
import { warforgedArtMode } from '../shared/warforged-appearance.js';
import { MISSION_THRESHOLDS } from '../shared/progression.js';
import { modifier } from '../shared/rules.js';

async function owned(client: Pick<PoolClient, 'query'>, id: string, userId: string, lock = false) {
  const {
    rows: [c],
  } = await client.query(
    `SELECT * FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
    [id, userId],
  );
  if (!c) throw new AppError(404, 'Personagem não encontrado.');
  return c;
}
function validated(race: string, cls: string, value: unknown) {
  try {
    return validateChoices(race, cls, value);
  } catch (e) {
    throw new AppError(
      400,
      e instanceof z.ZodError ? 'Confira as escolhas da ficha.' : (e as Error).message,
    );
  }
}
async function result(id: string, user: string) {
  const c = await owned(pool, id, user);
  const {
    rows: [sheet],
  } = await pool.query('SELECT * FROM character_sheets WHERE character_id=$1', [id]);
  const { attacks, inventory } = await readCharacterLoadout(pool, c, sheet?.choices);
  const normalized = sheet?.choices
    ? {
        ...sheet,
        choices: seedAdvancement(c.class, sheet.choices, sheet.prepared, sheet.slots_used),
      }
    : sheet;
  const derived = normalized?.finalized_at ? deriveSheet(c, normalized.choices) : null;
  const aliases: Record<string, string> = {
    'Duas adagas': 'Adaga',
    'Cinco adagas': 'Adaga',
    'Oito azagaias': 'Azagaia',
    'Seis azagaias': 'Azagaia',
    'Quatro machadinhas': 'Machadinha',
    'Espada grande': 'Espada grande',
    Vestes: 'Roupas comuns',
  };
  const names = [
    ...new Set(
      (derived?.equipment || [])
        .flatMap((v) => [v, aliases[v] || v])
        .map((v) => v.toLocaleLowerCase('pt-BR')),
    ),
  ];
  const art = names.length
    ? (
        await pool.query(
          'SELECT name,image_path FROM catalog_items WHERE image_path IS NOT NULL AND lower(name)=ANY($1::text[]) ORDER BY active DESC,id',
          [names],
        )
      ).rows
    : [];
  const administrator = await isAdministrator(user);
  const membership = await pool.query(
    `SELECT g.id,g.document->>'name' AS name FROM player_guild_members m JOIN player_guilds g ON g.id=m.guild_id WHERE m.character_id=$1 AND m.user_id=$2`,
    [id, user],
  );
  return {
    guild: membership.rows[0] || null,
    attacks,
    equipped: inventory
      .filter((i) => i.equipped?.length)
      .map((i) => ({ id: i.id, name: i.name, image_path: i.image_path, slots: i.equipped })),
    startingEquipment: (derived?.equipment || []).map((name) => ({
      name,
      image_path:
        art.find(
          (i) =>
            i.name.toLocaleLowerCase('pt-BR') ===
            (aliases[name] || name).toLocaleLowerCase('pt-BR'),
        )?.image_path || null,
    })),
    sheet: normalized || null,
    derived,
    capabilities: { can_grant_level: administrator, can_manage_resources: administrator },
  };
}
function seedAdvancement(
  cls: string,
  choices: import('../shared/character-sheet.js').SheetChoices,
  prepared: string[],
  used = 0,
) {
  if (choices.advancement) return choices;
  return {
    ...choices,
    advancement: {
      version: 1 as const,
      levels: [],
      initialSpells: cls === 'Patrulheiro' ? [...prepared] : [],
      prepared: { [cls]: [...prepared] },
      slotsUsed: [cls === 'Bruxo' ? 0 : used, 0, 0, 0, 0, 0, 0, 0, 0],
      pactUsed: cls === 'Bruxo' ? used : 0,
    },
  };
}
export function characterSheetRouter() {
  const router = Router();
  router.get('/spell-reference/:id',async(req,res)=>res.json(await spellReference(req.params.id)));
  router.get('/characters/:id/sheet', async (req, res) =>
    res.json(await result(z.string().uuid().parse(req.params.id), res.locals.user.id)),
  );
  router.post('/characters/:id/sheet/fighting-style', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id,
      body = z
        .object({
          classLevel: z.number().int().min(1).max(20),
          from: z.enum(fightingStyles as [string, ...string[]]),
          to: z.enum(fightingStyles as [string, ...string[]]),
          requestId: z.string().uuid(),
        })
        .strict()
        .parse(req.body);
    await transaction(async (db) => {
      const c = await owned(db, id, user, true),
        {
          rows: [s],
        } = await db.query('SELECT * FROM character_sheets WHERE character_id=$1 FOR UPDATE', [id]);
      if (!s?.finalized_at) throw new AppError(409, 'Conclua a ficha primeiro.');
      const choices = seedAdvancement(c.class, s.choices, s.prepared, s.slots_used),
        fighter = classStates(c, choices).find((v) => v.class === 'Guerreiro');
      if (choices.advancement!.styleChanges?.some((r) => r.requestId === body.requestId)) return;
      if (!fighter || fighter.level !== body.classLevel)
        throw new AppError(409, 'O nível de Guerreiro mudou. Atualize a ficha.');
      if (
        choices.advancement!.styleChanges?.some((r) => r.classLevel === fighter.level) ||
        choices.advancement!.levels.some(
          (r) =>
            r.class === 'Guerreiro' &&
            r.classLevel === fighter.level &&
            r.retrain?.some((v) => v.kind === 'style'),
        )
      )
        throw new AppError(409, 'A troca de estilo deste nível de Guerreiro já foi usada.');
      if (!fighter.choices.style?.includes(body.from) || fighter.choices.style.includes(body.to))
        throw new AppError(400, 'Selecione um estilo atual e uma nova opção diferente.');
      const next = {
          ...choices,
          advancement: {
            ...choices.advancement!,
            styleChanges: [
              ...(choices.advancement!.styleChanges || []),
              { ...body, createdAt: new Date().toISOString() },
            ],
          },
        },
        derived = deriveSheet(c, next);
      await db.query(
        'UPDATE character_sheets SET choices=$2,updated_at=now() WHERE character_id=$1',
        [id, JSON.stringify(next)],
      );
      await db.query('UPDATE characters SET armor_class=$2 WHERE id=$1', [id, derived.armorClass]);
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/advance', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    const body = z
      .object({
        expectedLevel: z.number().int().min(1).max(20),
        requestId: z.string().uuid(),
        grant: z.boolean(),
        choice: advanceChoiceSchema,
      })
      .strict()
      .parse(req.body);
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      if (body.grant) await requireAdministrator(user, client);
      const {
        rows: [s],
      } = await client.query('SELECT * FROM character_sheets WHERE character_id=$1 FOR UPDATE', [
        id,
      ]);
      if (!s?.finalized_at || s.choices?.version !== 2)
        throw new AppError(
          409,
          'Conclua a origem e confirme os atributos da ficha antes de evoluir.',
        );
      const choices = seedAdvancement(c.class, s.choices, s.prepared, s.slots_used);
      const previous = choices.advancement!.levels.find((r: any) => r.requestId === body.requestId);
      if (previous) {
        const { characterLevel, classLevel, requestId, actor, createdAt, granted, ...choice } =
          previous;
        if (!isDeepStrictEqual(choice, body.choice) || granted !== body.grant)
          throw new AppError(409, 'Esta confirmação já foi usada para outra evolução.');
        return;
      }
      if (c.level !== body.expectedLevel)
        throw new AppError(409, 'O nível mudou. Atualize a ficha antes de confirmar.');
      const allocated = allocatedLevel(choices);
      if (allocated > c.level)
        throw new AppError(409, 'A progressão registrada excede o nível do personagem.');
      if (body.grant && allocated < c.level)
        throw new AppError(
          409,
          'Conclua as escolhas dos níveis pendentes antes de conceder outro nível.',
        );
      if (body.grant && c.level === 20)
        throw new AppError(409, 'O personagem já está no nível máximo.');
      if (!body.grant && allocated === c.level)
        throw new AppError(409, 'Não há um nível pendente para configurar.');
      let validated;
      try {
        validated = validateAdvance(c, choices, body.choice);
      } catch (e) {
        throw new AppError(
          400,
          e instanceof z.ZodError ? 'Confira as escolhas da evolução.' : (e as Error).message,
        );
      }
      const newLevel = body.grant ? c.level + 1 : c.level;
      const row = {
        ...validated.choice,
        characterLevel: allocated + 1,
        classLevel: validated.plan.level,
        requestId: body.requestId,
        actor: user,
        createdAt: new Date().toISOString(),
        granted: body.grant,
      };
      const next = {
        ...choices,
        advancement: { ...choices.advancement!, levels: [...choices.advancement!.levels, row] },
      };
      const stats = advancementStats(c, validated.choice, validated.plan.level),
        derived = deriveSheet({ ...c, level: newLevel, stats }, next);
      const current = Math.min(
        derived.hp,
        Math.max(0, (s.current_hp ?? c.hp) + (derived.hp - c.hp)),
      );
      await client.query(
        'UPDATE character_sheets SET choices=$2,current_hp=$3,updated_at=now() WHERE character_id=$1',
        [id, JSON.stringify(next), current],
      );
      await client.query(
        'UPDATE characters SET level=$2,stats=$3,hp=$4,armor_class=$5,progression_missions=GREATEST(progression_missions,$6) WHERE id=$1',
        [
          id,
          newLevel,
          JSON.stringify(stats),
          derived.hp,
          derived.armorClass,
          body.grant ? MISSION_THRESHOLDS[newLevel - 1] : 0,
        ],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/magic-state', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    const body = z
      .object({
        prepared: z.record(z.string().max(30), z.array(z.string().max(80)).max(30)),
        slotsUsed: z.array(z.number().int().min(0).max(10)).length(9),
        pactUsed: z.number().int().min(0).max(4),
      })
      .strict()
      .parse(req.body);
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      const {
        rows: [s],
      } = await client.query('SELECT * FROM character_sheets WHERE character_id=$1 FOR UPDATE', [
        id,
      ]);
      if (!s?.finalized_at) throw new AppError(409, 'Conclua a ficha primeiro.');
      const choices = seedAdvancement(c.class, s.choices, s.prepared, s.slots_used),
        magic = magicClasses(c, choices),
        slots = combinedSlots(c, choices);
      if (
        Object.keys(body.prepared).some((cls) => !magic.some((m) => m.class === cls && m.flexible))
      )
        throw new AppError(400, 'Classe de preparação não disponível.');
      for (const m of magic.filter((m) => m.flexible)) {
        const v = body.prepared[m.class] || [];
        if (
          v.length > m.prepareCount ||
          new Set(v).size !== v.length ||
          v.some((id) => !m.allowed.includes(id))
        )
          throw new AppError(400, 'Confira a lista e o limite de preparação de ' + m.class + '.');
      }
      const pact = magic.find((m) => m.class === 'Bruxo');
      if (body.slotsUsed.some((v, i) => v > slots[i]) || body.pactUsed > (pact?.pactSlots || 0))
        throw new AppError(400, 'Espaços gastos excedem os espaços disponíveis.');
      const advancement: AdvancementState = {
        ...choices.advancement!,
        prepared: body.prepared,
        slotsUsed: body.slotsUsed,
        pactUsed: body.pactUsed,
      };
      await client.query(
        'UPDATE character_sheets SET choices=$2,prepared=$3,slots_used=$4,updated_at=now() WHERE character_id=$1',
        [
          id,
          JSON.stringify({ ...choices, advancement }),
          JSON.stringify(body.prepared[c.class] || s.prepared),
          c.class === 'Bruxo' ? body.pactUsed : body.slotsUsed[0],
        ],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/choices', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      // A patente pode evoluir antes da revisão da origem legada. A rolagem existente,
      // não o nível atual, impede reescolher a origem de uma ficha já confirmada.
      const {
        rows: [sheet],
      } = await client.query('SELECT rolls,choices FROM character_sheets WHERE character_id=$1', [
        id,
      ]);
      if (sheet?.rolls && sheet.choices?.version === 2)
        throw new AppError(409, 'As escolhas ficam fixas após a rolagem.');
      const species = sheet && !sheet.choices ? req.body.species : c.race;
      const choices = validated(species, c.class, req.body);
      if (c.race === 'Warforged' && sheet?.choices && warforgedArtMode(sheet.choices) !== warforgedArtMode(choices))
        throw new AppError(409, 'O modo de criação do Warforged fica salvo com o personagem e não pode ser trocado ao vestir.');
      await client.query('UPDATE characters SET race=$2,background=$3 WHERE id=$1', [
        id,
        choices.species,
        choices.backgroundType,
      ]);
      await client.query(
        `INSERT INTO character_sheets(character_id,choices) VALUES($1,$2) ON CONFLICT(character_id) DO UPDATE SET choices=$2,rules_version='5.2.1',updated_at=now()`,
        [id, JSON.stringify(choices)],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/roll', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    await transaction(async (client) => {
      await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE',[user]);
      const character = await owned(client, id, user, true);
      const {
        rows: [sheet],
      } = await client.query('SELECT * FROM character_sheets WHERE character_id=$1', [id]);
      if (!sheet?.choices) throw new AppError(409, 'Complete as escolhas da ficha antes de rolar.');
      if (sheet.rolls) return; // Retry/double click returns the same persisted dice, never a new draw.
      const saved = await characterSlotPool(client,character);
      const rolls = saved.rolls || rollCharacterAbilities();
      await client.query('UPDATE character_slot_rolls SET rolls=$3,minimum=$4,character_id=$5,updated_at=now() WHERE user_id=$1 AND slot=$2',[user,saved.slot,JSON.stringify(rolls),saved.minimum,id]);
      await client.query(
        'UPDATE character_sheets SET rolls=$2,ability_roll_floor=$3,rolls_revealed=$4,updated_at=now() WHERE character_id=$1',
        [id, JSON.stringify(rolls), saved.minimum,saved.revealed],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/reveal',async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id),user=res.locals.user.id;
    const {revealed}=z.object({revealed:z.number().int().min(0).max(6)}).strict().parse(req.body);
    await transaction(async db=>{
      await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE',[user]);
      const c=await owned(db,id,user,true);
      const s=(await db.query('SELECT rolls,rolls_revealed FROM character_sheets WHERE character_id=$1',[id])).rows[0];
      if(!s?.rolls||revealed>s.rolls_revealed+1)throw new AppError(409,'Confirme uma rolagem por vez.');
      await db.query('UPDATE character_sheets SET rolls_revealed=greatest(rolls_revealed,$2),updated_at=now() WHERE character_id=$1',[id,revealed]);
      if(c.creation_slot)await db.query('UPDATE character_slot_rolls SET revealed=greatest(revealed,$3),updated_at=now() WHERE user_id=$1 AND slot=$2 AND character_id=$4',[user,c.creation_slot,revealed,id]);
    });
    res.json(await result(id,user));
  });
  router.post('/characters/:id/sheet/finalize', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    const { assignment, ability_boosts } = z
      .object({
        assignment: z
          .array(z.number().int().min(0).max(5))
          .length(6)
          .refine((v) => new Set(v).size === 6, 'Use cada resultado uma vez.'),
        ability_boosts: z.array(z.number().int().min(0).max(2)).length(6).optional(),
      })
      .parse(req.body);
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      const {
        rows: [sheet],
      } = await client.query<SheetRecord>('SELECT * FROM character_sheets WHERE character_id=$1', [
        id,
      ]);
      if (!sheet?.rolls || !sheet.choices) throw new AppError(409, 'Role os atributos primeiro.');
      if(sheet.rolls_revealed!==6)throw new AppError(409,'Confirme os seis resultados antes de distribuir os atributos.');
      if (sheet.finalized_at) {
        if (
          JSON.stringify(sheet.assignment) !== JSON.stringify(assignment) ||
          (ability_boosts &&
            JSON.stringify(sheet.choices.abilityBoosts) !== JSON.stringify(ability_boosts))
        )
          throw new AppError(409, 'A distribuição já foi confirmada.');
        return;
      }
      const finalChoices = {
        ...sheet.choices,
        ...validated(c.race, c.class, {
          ...sheet.choices,
          abilityBoosts: ability_boosts || sheet.choices.abilityBoosts,
        }),
      };
      const bonuses = racialBonuses(c.race, finalChoices);
      const stats = assignment.map(
        (roll, i) =>
          abilityRollResult(sheet.rolls![roll], sheet.ability_roll_floor ?? 0) + bonuses[i],
      );
      const d = deriveSheet({ ...c, stats }, finalChoices);
      await grantCharacterStartingGold(client, user, id);
      await client.query(
        'UPDATE characters SET stats=$3,hp=$4,armor_class=$5 WHERE id=$1 AND user_id=$2',
        [id, user, JSON.stringify(stats), d.hp, d.armorClass],
      );
      await client.query(
        'UPDATE character_sheets SET assignment=$2,choices=$4,finalized_at=now(),current_hp=$3,updated_at=now() WHERE character_id=$1',
        [id, JSON.stringify(assignment), d.hp, JSON.stringify(finalChoices)],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/state', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    const body = z
      .object({
        prepared: z.array(z.string()).max(30),
        notes: z.string().max(8000),
        current_hp: z.number().int().min(0).optional(),
        temp_hp: z.number().int().min(0).max(999).optional(),
        inspiration: z.boolean(),
        death_success: z.number().int().min(0).max(3).optional(),
        death_failure: z.number().int().min(0).max(3).optional(),
        slots_used: z.number().int().min(0),
        hit_dice_used: z.number().int().min(0).optional(),
      })
      .parse(req.body);
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      const {
        rows: [s],
      } = await client.query('SELECT * FROM character_sheets WHERE character_id=$1', [id]);
      if (!s?.finalized_at) throw new AppError(409, 'Conclua a ficha primeiro.');
      const d = deriveSheet(c, s.choices),
        k = classRules[c.class];
      if (
        !(await isAdministrator(user, client)) &&
        (
          ['current_hp', 'temp_hp', 'hit_dice_used', 'death_success', 'death_failure'] as const
        ).some((key) => body[key] !== undefined && body[key] !== s[key])
      )
        throw new AppError(
          403,
          'Os recursos da sessão são atualizados pelo jogo ou pelo administrador.',
        );
      const resources = {
        current_hp: body.current_hp ?? s.current_hp ?? c.hp,
        temp_hp: body.temp_hp ?? s.temp_hp,
        hit_dice_used: body.hit_dice_used ?? s.hit_dice_used,
        death_success: body.death_success ?? s.death_success,
        death_failure: body.death_failure ?? s.death_failure,
      };
      const primary = magicClasses(c, seedAdvancement(c.class, s.choices, s.prepared)).find(
        (m) => m.class === c.class,
      );
      const allowed =
        s.choices.advancement?.levels.length && primary?.flexible
          ? primary.allowed
          : k.prepared
            ? c.class === 'Mago'
              ? s.choices.spells
              : spellOptions(c.class, 1).map((x) => x.id)
            : [];
      if (
        body.prepared.length > d.prepareCount ||
        new Set(body.prepared).size !== body.prepared.length ||
        body.prepared.some((x) => !allowed.includes(x)) ||
        resources.current_hp > c.hp ||
        body.slots_used > d.slots ||
        resources.hit_dice_used > c.level
      )
        throw new AppError(
          400,
          'Confira os limites de PV, dados de vida, espaços e magias preparadas.',
        );
      await client.query(
        `UPDATE character_sheets SET prepared=$2,notes=$3,current_hp=$4,temp_hp=$5,inspiration=$6,death_success=$7,death_failure=$8,slots_used=$9,hit_dice_used=$10,updated_at=now() WHERE character_id=$1`,
        [
          id,
          JSON.stringify(body.prepared),
          body.notes,
          resources.current_hp,
          resources.temp_hp,
          body.inspiration,
          resources.death_success,
          resources.death_failure,
          body.slots_used,
          resources.hit_dice_used,
        ],
      );
      if (s.choices.advancement?.levels.length) {
        const a = s.choices.advancement;
        const slotsUsed = [...(a.slotsUsed || Array(9).fill(0))];
        if (c.class !== 'Bruxo') slotsUsed[0] = body.slots_used;
        const prepared = {
          ...a.prepared,
          ...(primary?.flexible ? { [c.class]: body.prepared } : {}),
        };
        await client.query('UPDATE character_sheets SET choices=$2 WHERE character_id=$1', [
          id,
          JSON.stringify({
            ...s.choices,
            advancement: {
              ...a,
              prepared,
              slotsUsed,
              ...(c.class === 'Bruxo' ? { pactUsed: body.slots_used } : {}),
            },
          }),
        ]);
      }
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/rest-choices', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id;
    await transaction(async (client) => {
      const c = await owned(client, id, user, true);
      const {
        rows: [sheet],
      } = await client.query('SELECT * FROM character_sheets WHERE character_id=$1', [id]);
      if (!sheet?.finalized_at || !sheet.choices)
        throw new AppError(409, 'Conclua a ficha primeiro.');
      let choices;
      try {
        choices = {
          ...validateRestChoices(c.race, c.class, sheet.choices, req.body),
          ...(sheet.choices.advancement ? { advancement: sheet.choices.advancement } : {}),
        };
      } catch (e) {
        throw new AppError(400, (e as Error).message);
      }
      await client.query(
        'UPDATE character_sheets SET choices=$2,updated_at=now() WHERE character_id=$1',
        [id, JSON.stringify(choices)],
      );
    });
    res.json(await result(id, user));
  });
  router.post('/characters/:id/sheet/long-rest', async (req, res) => {
    const user = res.locals.user.id,
      id = z.string().uuid().parse(req.params.id);
    await requireAdministrator(user);
    await transaction(async (db) => {
      const c = await owned(db, id, user, true),
        {
          rows: [s],
        } = await db.query('SELECT * FROM character_sheets WHERE character_id=$1 FOR UPDATE', [id]);
      if (!s?.finalized_at) throw new AppError(409, 'Conclua a ficha primeiro.');
      const choices = seedAdvancement(c.class, s.choices, s.prepared, s.slots_used),
        states = classStates(c, choices),
        celestial = states.find(
          (v) => v.class === 'Bruxo' && v.subclass === 'celestial' && v.level >= 10,
        ),
        temp = celestial ? Math.max(0, celestial.level + modifier(c.stats[5])) : 0;
      const next = {
        ...choices,
        advancement: { ...choices.advancement!, slotsUsed: Array(9).fill(0), pactUsed: 0 },
      };
      await db.query(
        'UPDATE character_sheets SET current_hp=$2,temp_hp=$3,hit_dice_used=0,death_success=0,death_failure=0,slots_used=0,choices=$4,updated_at=now() WHERE character_id=$1',
        [id, c.hp, temp, JSON.stringify(next)],
      );
    });
    res.json(await result(id, user));
  });
  return router;
}

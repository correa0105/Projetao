import { Router } from 'express';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { administrationFor, isAdministrator, requireAdministrator } from './administrators.js';
import { AppError } from './services.js';
import { createVttRoom } from './vtt-accounts.js';
import { rollCharacterAbilities } from './ability-rolls.js';
import { characterSlotPool } from './character-slot-rolls.js';
import { classes, hitDice, races } from '../shared/rules.js';
import {
  defaultChoices,
  reconcileChoices,
  backgroundRules,
  type SheetRecord,
} from '../shared/character-sheet.js';
import { ABILITY_ROLL_MIN_SCORE } from '../shared/ability-rolls.js';
import { eclipseStagId, mounts } from '../shared/mounts.js';
import { pets } from '../shared/pets.js';
import weaponAliases from '../shared/catalog-weapon-names.json' with { type: 'json' };
import { withdrawnWeaponOffer } from '../shared/shop-availability.js';
import { prestigeSkinArt, prestigeWeapon } from '../shared/prestige-weapons.js';
import {
  minimumPrestigeLevel,
  prestigeMilestones,
  prestigeRewardsSchema,
  specialCurrencySchema,
  specialOfferInput,
  type SpecialCurrency,
} from '../shared/special-economy.js';

type Database = Pick<PoolClient, 'query'>;
const uuid = z.string().uuid();
const towerAdministration = administrationFor('tower');
const pointsLimit = 2147483647;
const offerFields = 'id,category,name,description,image_path,target_key,price,active,revision';
const retirementConfirmation = {
  name: z.string().min(1).max(60),
  revision: z.number().int().min(0),
  level: z.number().int().min(1).max(20),
  cycle: z.number().int().min(0),
  request_id: uuid,
};
const retirementInput = z.discriminatedUnion('mode', [
  z
    .object({
      ...retirementConfirmation,
      mode: z.literal('restart'),
      class: z.enum(classes),
      dice: z.enum(['keep', 'reroll']),
    })
    .strict(),
  z
    .object({
      ...retirementConfirmation,
      mode: z.literal('permanent'),
      replacement_id: uuid.optional(),
    })
    .strict(),
]);

async function validOfferArt(path: string) {
  const candidates = await Promise.all(
    ['dist/client', 'public'].map((root) =>
      stat(resolve(root, '.' + path))
        .then((file) => file.isFile())
        .catch(() => false),
    ),
  );
  return candidates.some(Boolean);
}

async function validateOfferContent(db: Database, input: z.infer<typeof specialOfferInput>) {
  const { category, image_path, target_key, active } = input;
  if (!active) return;
  if (category !== 'tower_item' && !image_path)
    throw new AppError(400, 'Adicione a arte da oferta antes de publicar.');
  if (image_path && !(await validOfferArt(image_path)))
    throw new AppError(400, 'A imagem indicada não foi encontrada entre as artes publicadas.');
  if (category === 'mount' && !mounts.some((mount) => mount.id === target_key))
    throw new AppError(400, 'Escolha o modelo de referência da montaria.');
  if (category === 'pet' && !pets.some((pet) => pet.id === target_key))
    throw new AppError(400, 'Escolha o modelo de referência do mascote.');
  if (category === 'prestige_weapon' && !prestigeWeapon(target_key))
    throw new AppError(400, 'Escolha uma arma de Prestígio da forja.');
  if (category === 'weapon_skin') {
    const item = (
      await db.query('SELECT id,raw_data FROM catalog_items WHERE id=$1 AND active', [target_key])
    ).rows[0];
    if (
      !item ||
      withdrawnWeaponOffer(item) ||
      !Object.hasOwn(weaponAliases, item.raw_data?.base_item || item.id)
    )
      throw new AppError(400, 'Escolha uma arma disponível do catálogo para esta skin.');
  }
}

export async function specialBalance(
  db: Database,
  user: string,
  currency: SpecialCurrency,
  character?: string | null,
) {
  const row =
    currency === 'prestige'
      ? (await db.query('SELECT points AS balance FROM prestige_wallets WHERE user_id=$1', [user]))
          .rows[0]
      : (
          await db.query('SELECT crystals AS balance FROM tower_wallets WHERE character_id=$1', [
            character ?? null,
          ])
        ).rows[0];
  return Number(row?.balance ?? 0);
}

export async function spendSpecialBalance(
  db: PoolClient,
  user: string,
  currency: SpecialCurrency,
  amount: number,
  character?: string | null,
) {
  const result =
    currency === 'prestige'
      ? await db.query(
          'UPDATE prestige_wallets SET points=points-$2 WHERE user_id=$1 AND points>=$2 RETURNING points AS balance',
          [user, amount],
        )
      : await db.query(
          'UPDATE tower_wallets SET crystals=crystals-$2 WHERE character_id=$1 AND crystals>=$2 RETURNING crystals AS balance',
          [character, amount],
        );
  if (!result.rowCount)
    throw new AppError(
      409,
      currency === 'prestige' ? 'Prestígio insuficiente.' : 'Cristais insuficientes.',
    );
  return Number(result.rows[0].balance);
}

async function ownedCharacter(db: Database, user: string, id: string, lock = false) {
  const {
    rows: [character],
  } = await db.query(
    'SELECT id,user_id,name,level,class,race,background,creation_slot,retirement_cycle FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL' +
      (lock ? ' FOR UPDATE' : ''),
    [id, user],
  );
  if (!character) throw new AppError(404, 'Personagem não encontrado.');
  return character as {
    id: string;
    user_id: string;
    name: string;
    level: number;
    class: string;
    race: string;
    background: string;
    creation_slot: number | null;
    retirement_cycle: number;
  };
}

async function restartJourney(
  db: PoolClient,
  character: Awaited<ReturnType<typeof ownedCharacter>>,
  sheet: SheetRecord | undefined,
  nextClass: string,
  keepDice: boolean,
) {
  const slot = await characterSlotPool(db, character);
  const rolls = keepDice
    ? sheet?.rolls || (slot.character_id === character.id ? slot.rolls : null)
    : rollCharacterAbilities();
  if (!rolls) throw new AppError(409, 'Este personagem precisa fazer uma nova rolagem.');
  const floor = keepDice ? (sheet?.ability_roll_floor ?? slot.minimum) : ABILITY_ROLL_MIN_SCORE;
  const revealed = keepDice ? (sheet?.rolls ? (sheet.rolls_revealed ?? 6) : slot.revealed) : 0;
  const background = Object.hasOwn(backgroundRules, character.background)
    ? character.background
    : 'Acólito';
  if (!(races as readonly string[]).includes(character.race))
    throw new AppError(409, 'Revise a origem legada da ficha antes de recomeçar.');
  const { advancement: _previous, ...origin } =
    sheet?.choices || defaultChoices(character.race, nextClass, background);
  const choices = reconcileChoices(character.race, nextClass, origin);
  await db.query(
    `INSERT INTO character_sheets(character_id,choices,rolls,assignment,ability_roll_floor,rolls_revealed,retirement_rebuild)
     VALUES($1,$2,$3,$4,$5,$6,true)
     ON CONFLICT(character_id) DO UPDATE SET choices=EXCLUDED.choices,rolls=EXCLUDED.rolls,assignment=EXCLUDED.assignment,
       ability_roll_floor=EXCLUDED.ability_roll_floor,rolls_revealed=EXCLUDED.rolls_revealed,retirement_rebuild=true,
       finalized_at=NULL,prepared='[]',current_hp=NULL,temp_hp=0,inspiration=false,death_success=0,death_failure=0,
       slots_used=0,hit_dice_used=0,updated_at=now()`,
    [
      character.id,
      JSON.stringify(choices),
      JSON.stringify(rolls),
      keepDice && sheet?.assignment ? JSON.stringify(sheet.assignment) : null,
      floor,
      revealed,
    ],
  );
  await db.query(
    `UPDATE characters SET level=1,class=$2,progression_missions=0,stats='[10,10,10,10,10,10]',hp=$3,
       armor_class=10,retirement_cycle=retirement_cycle+1 WHERE id=$1`,
    [character.id, nextClass, hitDice[nextClass]],
  );
  await db.query(
    `UPDATE character_slot_rolls SET rolls=$3,minimum=$4,revealed=$5,character_id=$6,matured=false,
       generation=generation+1,updated_at=now() WHERE user_id=$1 AND slot=$2`,
    [character.user_id, slot.slot, JSON.stringify(rolls), floor, revealed, character.id],
  );
  await db.query('DELETE FROM vtt_character_resources WHERE character_id=$1', [character.id]);
}

async function settings(db: Database, lock = false) {
  const {
    rows: [row],
  } = await db.query(
    'SELECT rewards,revision FROM prestige_retirement_settings WHERE singleton' +
      (lock ? ' FOR SHARE' : ''),
  );
  return row as { rewards: number[] | null; revision: number };
}

async function retirementBlocker(db: Database, id: string) {
  const {
    rows: [pending],
  } = await db.query(
    `SELECT EXISTS(SELECT 1 FROM character_art_jobs WHERE character_id=$1 AND status IN ('queued','running')
       UNION ALL SELECT 1 FROM companion_art_jobs WHERE character_id=$1 AND status IN ('queued','running')) AS art,
     EXISTS(SELECT 1 FROM mission_participants p JOIN board_posts b ON b.id=p.post_id
       WHERE p.character_id=$1 AND b.kind='mission' AND b.deleted_at IS NULL AND b.status IN ('open','active')) AS mission,
     EXISTS(SELECT 1 FROM tower_members m JOIN tower_expeditions e ON e.id=m.run_id
       WHERE m.character_id=$1 AND e.status IN ('preparing','active')
       UNION ALL SELECT 1 FROM tower_claims WHERE character_id=$1 AND rolled_at IS NULL) AS tower`,
    [id],
  );
  if (pending.art) return 'Aguarde a geração de arte terminar.';
  if (pending.mission) return 'Resolva a inscrição em missões abertas ou em andamento.';
  if (pending.tower) return 'Conclua a expedição e resgate os tesouros pendentes da Torre.';
  return null;
}

async function founderRepresentatives(db: Database, user: string, id: string) {
  const founder = (
    await db.query(
      'SELECT g.id FROM player_guild_members m JOIN player_guilds g ON g.id=m.guild_id WHERE m.character_id=$1 AND g.owner_id=$2',
      [id, user],
    )
  ).rows[0];
  if (!founder) return null;
  return (
    await db.query(
      `SELECT id,name FROM characters c WHERE user_id=$1 AND deleted_at IS NULL AND id<>$2
     AND NOT EXISTS(SELECT 1 FROM player_guild_members m WHERE m.character_id=c.id) ORDER BY name,id`,
      [user, id],
    )
  ).rows as { id: string; name: string }[];
}

async function towerRoomAccess(
  db: Database,
  room: string,
  user: string,
  character: string,
  lock = false,
) {
  const {
    rows: [link],
  } = await db.query(
    `SELECT e.id AS run_id FROM tower_expedition_rooms t
     JOIN tower_expeditions e ON e.id=t.run_id
     JOIN vtt_rooms r ON r.id=t.room_id
     JOIN tower_members m ON m.run_id=e.id AND m.character_id=$3
     JOIN characters c ON c.id=m.character_id AND c.user_id=$2 AND c.deleted_at IS NULL
     WHERE t.room_id=$1 AND e.status='active' AND
       (r.owner_id=$2 OR EXISTS(SELECT 1 FROM vtt_members v WHERE v.room_id=r.id AND v.user_id=$2 AND v.role='player'))` +
      (lock ? ' FOR SHARE OF e,r,m,c,t' : ''),
    [room, user, character],
  );
  if (!link)
    throw new AppError(
      403,
      'O item só pode ser usado pelo personagem participante em uma mesa ativa da Torre.',
    );
  return link as { run_id: string };
}

async function towerPurchases(db: Database, user: string, character: string | null) {
  return (
    await db.query(
      `SELECT p.id,p.offer_id,p.price,p.snapshot,u.used_at FROM special_shop_purchases p
     LEFT JOIN tower_shop_uses u ON u.purchase_id=p.id
     WHERE p.user_id=$1 AND p.currency='crystals' AND p.character_id=$2 ORDER BY p.created_at DESC,p.id`,
      [user, character],
    )
  ).rows;
}

export function specialEconomyRouter() {
  const router = Router();

  router.get('/prestige', async (_req, res) => {
    const uid = res.locals.user.id;
    const [config, balance, canEdit, history] = await Promise.all([
      settings(pool),
      specialBalance(pool, uid, 'prestige'),
      isAdministrator(uid),
      pool.query(
        'SELECT character_id,cycle,name,level,points,previous_class,mode,retired_at FROM character_retirements WHERE user_id=$1 ORDER BY retired_at DESC',
        [uid],
      ),
    ]);
    res.json({
      ...config,
      balance,
      can_edit: canEdit,
      milestones: prestigeMilestones,
      history: history.rows,
    });
  });

  router.put('/prestige/rewards', async (req, res) => {
    const uid = res.locals.user.id;
    const input = z
      .object({ revision: z.number().int().min(0), rewards: prestigeRewardsSchema })
      .strict()
      .parse(req.body);
    await requireAdministrator(uid);
    const result = await pool.query(
      `UPDATE prestige_retirement_settings SET rewards=$1,revision=revision+1,updated_by=$2
       WHERE singleton AND revision=$3 AND EXISTS(SELECT 1 FROM "user" WHERE id=$2 AND administrador=1)
       RETURNING rewards,revision`,
      [input.rewards, uid, input.revision],
    );
    if (!result.rowCount)
      throw new AppError(409, 'A tabela de recompensas mudou. Abra a configuração novamente.');
    res.json(result.rows[0]);
  });

  router.get('/characters/:id/retirement', async (req, res) => {
    const uid = res.locals.user.id,
      id = uuid.parse(req.params.id);
    const character = await ownedCharacter(pool, uid, id);
    const config = await settings(pool);
    const dice = (
      await pool.query(
        `SELECT EXISTS(SELECT 1 FROM character_sheets WHERE character_id=$1 AND rolls IS NOT NULL)
       OR EXISTS(SELECT 1 FROM character_slot_rolls WHERE character_id=$1 AND rolls IS NOT NULL) AS available`,
        [id],
      )
    ).rows[0].available;
    res.json({
      level: character.level,
      cycle: character.retirement_cycle,
      points:
        character.level >= minimumPrestigeLevel
          ? (config.rewards?.[character.level - 1] ?? null)
          : null,
      revision: config.revision,
      has_rolls: dice,
      blocker:
        character.level < minimumPrestigeLevel
          ? 'O Prestígio é liberado no primeiro marco, no nível 5.'
          : await retirementBlocker(pool, id),
      representatives: await founderRepresentatives(pool, uid, id),
    });
  });

  router.post('/characters/:id/retirement', async (req, res) => {
    const uid = res.locals.user.id,
      id = uuid.parse(req.params.id);
    const input = retirementInput.parse(req.body);
    res.json(
      await transaction(async (db) => {
        await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [uid]);
        const old = (
          await db.query(
            'SELECT character_id,request,points,mode FROM character_retirements WHERE user_id=$1 AND request_id=$2',
            [uid, input.request_id],
          )
        ).rows[0];
        if (old) {
          if (
            old.character_id !== id ||
            !isDeepStrictEqual(old.request, JSON.parse(JSON.stringify(input)))
          )
            throw new AppError(409, 'Este pedido já foi usado para outra aposentadoria.');
          return {
            points: old.points,
            mode: old.mode,
            balance: await specialBalance(db, uid, 'prestige'),
            replayed: true,
          };
        }
        const membership =
          input.mode === 'permanent'
            ? (
                await db.query(
                  `SELECT g.id,g.owner_id FROM player_guild_members m JOIN player_guilds g ON g.id=m.guild_id
         WHERE m.character_id=$1 AND m.user_id=$2 FOR UPDATE OF g`,
                  [id, uid],
                )
              ).rows[0]
            : null;
        const character = await ownedCharacter(db, uid, id, true);
        if (character.name !== input.name)
          throw new AppError(400, 'Digite o nome do personagem para confirmar.');
        const config = await settings(db, true);
        if (!config.rewards)
          throw new AppError(409, 'A tabela de Prestígio ainda aguarda configuração.');
        if (character.level < minimumPrestigeLevel)
          throw new AppError(409, 'O Prestígio é liberado no primeiro marco, no nível 5.');
        if (
          character.level !== input.level ||
          character.retirement_cycle !== input.cycle ||
          config.revision !== input.revision
        )
          throw new AppError(
            409,
            'O nível ou a recompensa mudou. Confira novamente antes de aposentar.',
          );
        const blocker = await retirementBlocker(db, id);
        if (blocker) throw new AppError(409, blocker);
        if (input.mode === 'permanent' && membership?.owner_id === uid) {
          const candidates = await founderRepresentatives(db, uid, id);
          if (!input.replacement_id || !candidates?.some((c) => c.id === input.replacement_id))
            throw new AppError(
              409,
              'Escolha outro personagem ativo e livre de guilda para representar o fundador.',
            );
          await ownedCharacter(db, uid, input.replacement_id, true);
          await db.query(
            'UPDATE player_guild_members SET character_id=$3,joined_at=now() WHERE guild_id=$1 AND user_id=$2 AND character_id=$4',
            [membership.id, uid, input.replacement_id, id],
          );
        } else if (input.mode === 'permanent') {
          await db.query('DELETE FROM player_guild_members WHERE character_id=$1 AND user_id=$2', [
            id,
            uid,
          ]);
        }
        const points = config.rewards[character.level - 1];
        const wallet = await db.query(
          `INSERT INTO prestige_wallets(user_id,points) VALUES($1,$2)
         ON CONFLICT(user_id) DO UPDATE SET points=prestige_wallets.points+EXCLUDED.points
         WHERE prestige_wallets.points<=$3-EXCLUDED.points RETURNING points`,
          [uid, points, pointsLimit],
        );
        if (!wallet.rowCount) throw new AppError(409, 'O limite de Prestígio foi atingido.');
        const sheet = (
          await db.query<SheetRecord>(
            'SELECT * FROM character_sheets WHERE character_id=$1 FOR UPDATE',
            [id],
          )
        ).rows[0];
        await db.query(
          `INSERT INTO character_retirements(character_id,user_id,cycle,request_id,request,mode,name,level,previous_class,previous_sheet,points,reward_revision)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            id,
            uid,
            input.cycle,
            input.request_id,
            JSON.stringify(input),
            input.mode,
            character.name,
            character.level,
            character.class,
            sheet ? JSON.stringify(sheet) : null,
            points,
            config.revision,
          ],
        );
        if (input.mode === 'restart')
          await restartJourney(db, character, sheet, input.class, input.dice === 'keep');
        else await db.query('UPDATE characters SET deleted_at=now() WHERE id=$1', [id]);
        return { points, mode: input.mode, balance: wallet.rows[0].points, replayed: false };
      }),
    );
  });

  router.get('/special-shop/:currency', async (req, res) => {
    const uid = res.locals.user.id,
      currency = specialCurrencySchema.parse(req.params.currency);
    const character =
      currency === 'crystals' && req.query.character_id !== undefined
        ? (await ownedCharacter(pool, uid, uuid.parse(req.query.character_id))).id
        : null;
    const canEdit = await isAdministrator(uid);
    const [offers, balance, purchases, border] = await Promise.all([
      pool.query(
        'SELECT ' +
          offerFields +
          " FROM special_shop_offers WHERE currency=$1 AND (active OR $2) ORDER BY (category='prestige_weapon') DESC,category,name,id",
        [currency, canEdit],
      ),
      specialBalance(pool, uid, currency, character),
      currency === 'crystals'
        ? towerPurchases(pool, uid, character)
        : pool
            .query(
              "SELECT id,offer_id,price,snapshot,NULL AS used_at FROM special_shop_purchases WHERE user_id=$1 AND currency='prestige' ORDER BY created_at DESC,id",
              [uid],
            )
            .then((result) => result.rows),
      currency === 'prestige'
        ? pool.query('SELECT purchase_id FROM prestige_profile_borders WHERE user_id=$1', [uid])
        : null,
    ]);
    res.json({
      offers: offers.rows,
      balance,
      can_edit: canEdit,
      purchases: currency === 'prestige'
        ? purchases.map((purchase) => purchase.snapshot.category === 'weapon_skin'
          ? { ...purchase, snapshot: { ...purchase.snapshot, image_path: prestigeSkinArt(purchase.snapshot.image_path) } }
          : purchase)
        : purchases,
      equipped_border: border?.rows[0]?.purchase_id ?? null,
    });
  });

  router.put('/special-shop/:currency/offers/:id', async (req, res) => {
    const uid = res.locals.user.id,
      currency = specialCurrencySchema.parse(req.params.currency);
    const id = uuid.parse(req.params.id),
      input = specialOfferInput.parse(req.body);
    await requireAdministrator(uid);
    if ((currency === 'crystals') !== (input.category === 'tower_item'))
      throw new AppError(400, 'Categoria inválida para esta loja.');
    res.json(
      await transaction(async (db) => {
        await requireAdministrator(uid, db);
        await validateOfferContent(db, input);
        const {
          rows: [existing],
        } = await db.query(
          'SELECT category,revision FROM special_shop_offers WHERE id=$1 AND currency=$2 FOR UPDATE',
          [id, currency],
        );
        if (
          (existing?.revision ?? 0) !== input.revision ||
          (existing && existing.category !== input.category)
        )
          throw new AppError(409, 'A oferta mudou. Reabra a configuração para editar.');
        const {
          rows: [saved],
        } = await db.query(
          `INSERT INTO special_shop_offers(id,currency,category,name,description,image_path,target_key,price,active,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,image_path=EXCLUDED.image_path,
           target_key=EXCLUDED.target_key,price=EXCLUDED.price,active=EXCLUDED.active,updated_by=EXCLUDED.updated_by,revision=special_shop_offers.revision+1
         WHERE special_shop_offers.currency=EXCLUDED.currency AND special_shop_offers.revision=$11 RETURNING ` +
            offerFields,
          [
            id,
            currency,
            input.category,
            input.name,
            input.description,
            input.image_path,
            input.target_key,
            input.price,
            input.active,
            uid,
            input.revision,
          ],
        );
        if (!saved) throw new AppError(409, 'A oferta mudou. Reabra a configuração para editar.');
        return saved;
      }),
    );
  });

  router.post('/special-shop/:currency/purchases', async (req, res) => {
    const uid = res.locals.user.id,
      currency = specialCurrencySchema.parse(req.params.currency);
    const input = z
      .object({
        offer_id: uuid,
        request_id: uuid,
        revision: z.number().int().min(1),
        character_id: uuid.optional(),
        companion_name: z.string().trim().min(1).max(40).regex(/^[\p{L}\p{M}\p{N} '\-]+$/u).optional(),
      })
      .strict()
      .parse(req.body);
    if (currency === 'crystals' && !input.character_id)
      throw new AppError(400, 'Escolha o personagem da compra com cristais.');
    res.json(
      await transaction(async (db) => {
        await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [uid]);
        const previous = (
          await db.query(
            "SELECT id,currency,offer_id,character_id,snapshot->>'companion_name' AS companion_name FROM special_shop_purchases WHERE user_id=$1 AND request_id=$2",
            [uid, input.request_id],
          )
        ).rows[0];
        if (previous) {
          if (
            previous.currency !== currency ||
            previous.offer_id !== input.offer_id ||
            previous.character_id !== (input.character_id ?? null) ||
            previous.companion_name !== (input.companion_name ?? null)
          )
            throw new AppError(409, 'Este pedido já foi usado para outra compra.');
          return {
            id: previous.id,
            balance: await specialBalance(db, uid, currency, input.character_id),
            replayed: true,
          };
        }
        const buyer = input.character_id ? await ownedCharacter(db, uid, input.character_id, true) : null;
        const offer = (
          await db.query(
            'SELECT ' +
              offerFields +
              ' FROM special_shop_offers WHERE id=$1 AND currency=$2 AND active FOR SHARE',
            [input.offer_id, currency],
          )
        ).rows[0];
        if (!offer || offer.revision !== input.revision)
          throw new AppError(409, 'A oferta mudou. Atualize a loja.');
        const companion = offer.category === 'mount' || offer.category === 'pet';
        const isPrestigeWeapon = offer.category === 'prestige_weapon';
        const weapon = isPrestigeWeapon ? prestigeWeapon(offer.target_key) : undefined;
        const namedMount = offer.category === 'mount' && offer.target_key === eclipseStagId;
        if (namedMount && !input.companion_name)
          throw new AppError(400, 'Dê um nome ao Cervo do Eclipse.');
        if (!namedMount && input.companion_name)
          throw new AppError(400, 'Esta oferta não aceita nome de montaria.');
        if ((currency === 'crystals' || companion || isPrestigeWeapon) !== !!buyer)
          throw new AppError(400, 'Escolha o personagem que receberá a compra.');
        if (isPrestigeWeapon && !weapon)
          throw new AppError(409, 'Esta arma de Prestígio está indisponível.');
        if (weapon && buyer!.level < weapon.stages[0].level)
          throw new AppError(409, `Esta arma exige nível ${weapon.stages[0].level} para compra.`);
        if (
          currency === 'prestige' &&
          (
            await db.query(
              `SELECT 1 FROM special_shop_purchases WHERE user_id=$1 AND currency='prestige'
               AND (offer_id=$2 OR ($3::text IS NOT NULL AND snapshot->>'category'='prestige_weapon' AND snapshot->>'target_key'=$3))`,
              [uid, input.offer_id, weapon?.id ?? null],
            )
          ).rowCount
        )
          throw new AppError(409, 'Este item já está na sua coleção.');
        const balance = await spendSpecialBalance(
          db,
          uid,
          currency,
          offer.price,
          input.character_id,
        );
        const { category, name, description, image_path, target_key } = offer;
        const {
          rows: [purchase],
        } = await db.query(
          `INSERT INTO special_shop_purchases(user_id,character_id,offer_id,currency,price,snapshot,request_id)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [
            uid,
            input.character_id ?? null,
            offer.id,
            currency,
            offer.price,
            JSON.stringify({ category, name, description, image_path, target_key, companion_name: input.companion_name }),
            input.request_id,
          ],
        );
        if (category === 'mount')
          await db.query(
            `INSERT INTO character_mounts(character_id,mount_id,name,price_cp,idempotency_key,prestige_art,displayed)
           VALUES($1,$2,left($3,40),0,$4,$5,NOT EXISTS(SELECT 1 FROM character_mounts WHERE character_id=$1))`,
            [input.character_id, target_key, input.companion_name ?? name, purchase.id, image_path],
          );
        if (category === 'pet')
          await db.query(
            `INSERT INTO character_pets(character_id,pet_id,name,price_cp,idempotency_key,prestige_art,displayed)
           VALUES($1,$2,left($3,40),0,$4,$5,NOT EXISTS(SELECT 1 FROM character_pets WHERE character_id=$1))`,
            [input.character_id, target_key, name, purchase.id, image_path],
          );
        if (weapon)
          await db.query(
            `INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,1)
             ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+1`,
            [buyer!.id, weapon.id],
          );
        return { id: purchase.id, balance, replayed: false };
      }),
    );
  });

  router.put('/prestige/profile-border', async (req, res) => {
    const uid = res.locals.user.id;
    const { purchase_id } = z.object({ purchase_id: uuid.nullable() }).strict().parse(req.body);
    if (purchase_id === null)
      await pool.query('DELETE FROM prestige_profile_borders WHERE user_id=$1', [uid]);
    else {
      const result = await pool.query(
        `INSERT INTO prestige_profile_borders(user_id,purchase_id)
         SELECT user_id,id FROM special_shop_purchases WHERE user_id=$1 AND id=$2 AND currency='prestige'
           AND snapshot->>'category'='profile_border' AND snapshot->>'image_path' IS NOT NULL
         ON CONFLICT(user_id) DO UPDATE SET purchase_id=EXCLUDED.purchase_id`,
        [uid, purchase_id],
      );
      if (!result.rowCount)
        throw new AppError(404, 'Borda de Prestígio não encontrada na sua coleção.');
    }
    res.json({ purchase_id });
  });

  router.put('/prestige/weapon-skin/:purchase', async (req, res) => {
    const uid = res.locals.user.id,
      purchase = uuid.parse(req.params.purchase);
    const { character_id, enabled } = z
      .object({ character_id: uuid, enabled: z.boolean() })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (db) => {
        await ownedCharacter(db, uid, character_id, true);
        const item = (
          await db.query(
            "SELECT snapshot->>'target_key' AS item_id FROM special_shop_purchases WHERE id=$1 AND user_id=$2 AND currency='prestige' AND snapshot->>'category'='weapon_skin'",
            [purchase, uid],
          )
        ).rows[0];
        if (!item?.item_id) throw new AppError(404, 'Skin não encontrada na sua coleção.');
        if (enabled) {
          const result = await db.query(
            `INSERT INTO prestige_weapon_skins(character_id,item_id,purchase_id)
           SELECT character_id,item_id,$3 FROM inventory WHERE character_id=$1 AND item_id=$2
           ON CONFLICT(character_id,item_id) DO UPDATE SET purchase_id=EXCLUDED.purchase_id`,
            [character_id, item.item_id, purchase],
          );
          if (!result.rowCount)
            throw new AppError(409, 'A arma precisa estar na mochila deste personagem.');
        } else {
          await db.query(
            'DELETE FROM prestige_weapon_skins WHERE character_id=$1 AND item_id=$2 AND purchase_id=$3',
            [character_id, item.item_id, purchase],
          );
        }
        return { item_id: item.item_id, enabled };
      }),
    );
  });

  router.post('/tower/expeditions/:id/table', async (req, res) => {
    const uid = res.locals.user.id,
      id = uuid.parse(req.params.id);
    const { character_id } = z.object({ character_id: uuid.optional() }).strict().parse(req.body);
    res.json(
      await transaction(async (db) => {
        const run = (
          await db.query(
            'SELECT master_id,name,status FROM tower_expeditions WHERE id=$1 FOR UPDATE',
            [id],
          )
        ).rows[0];
        if (!run || !['preparing', 'active'].includes(run.status))
          throw new AppError(404, 'Expedição indisponível.');
        const master = run.master_id === uid && (await towerAdministration.has(uid, db));
        if (!master) {
          if (!character_id) throw new AppError(403, 'Escolha um personagem participante.');
          await ownedCharacter(db, uid, character_id);
          if (
            !(
              await db.query('SELECT 1 FROM tower_members WHERE run_id=$1 AND character_id=$2', [
                id,
                character_id,
              ])
            ).rowCount
          )
            throw new AppError(403, 'Este personagem não participa da expedição.');
        }
        let room = (
          await db.query('SELECT room_id FROM tower_expedition_rooms WHERE run_id=$1', [id])
        ).rows[0]?.room_id;
        if (!room) {
          if (!master)
            throw new AppError(409, 'O mestre ainda vai preparar a mesa desta expedição.');
          room = (await createVttRoom(db, uid, ('Torre · ' + run.name).slice(0, 100))).id;
          await db.query('INSERT INTO tower_expedition_rooms(run_id,room_id) VALUES($1,$2)', [
            id,
            room,
          ]);
        }
        if (!master)
          await db.query(
            "INSERT INTO vtt_members(room_id,user_id,role) VALUES($1,$2,'player') ON CONFLICT DO NOTHING",
            [room, uid],
          );
        return { room_id: room };
      }),
    );
  });

  router.get('/vtt/rooms/:room/tower-items/:character', async (req, res) => {
    const room = uuid.parse(req.params.room),
      character = uuid.parse(req.params.character),
      uid = res.locals.user.id;
    await towerRoomAccess(pool, room, uid, character);
    res.json({
      items: (await towerPurchases(pool, uid, character)).filter((item) => !item.used_at),
    });
  });

  router.post('/vtt/rooms/:room/tower-items/:character/:purchase/use', async (req, res) => {
    const room = uuid.parse(req.params.room),
      character = uuid.parse(req.params.character);
    const purchase = uuid.parse(req.params.purchase),
      uid = res.locals.user.id;
    res.json(
      await transaction(async (db) => {
        const { run_id } = await towerRoomAccess(db, room, uid, character, true);
        const item = (
          await db.query(
            "SELECT snapshot FROM special_shop_purchases WHERE id=$1 AND user_id=$2 AND character_id=$3 AND currency='crystals' FOR UPDATE",
            [purchase, uid, character],
          )
        ).rows[0];
        if (!item) throw new AppError(404, 'Item da Torre não encontrado.');
        const existing = (
          await db.query(
            'SELECT room_id,run_id,used_at FROM tower_shop_uses WHERE purchase_id=$1',
            [purchase],
          )
        ).rows[0];
        if (existing) {
          if (existing.room_id !== room || existing.run_id !== run_id)
            throw new AppError(409, 'Este item já foi usado.');
          return { used_at: existing.used_at, replayed: true };
        }
        const {
          rows: [used],
        } = await db.query(
          'INSERT INTO tower_shop_uses(purchase_id,room_id,run_id) VALUES($1,$2,$3) RETURNING used_at',
          [purchase, room, run_id],
        );
        const owner = (await db.query('SELECT name FROM characters WHERE id=$1', [character]))
          .rows[0];
        await db.query(
          'INSERT INTO vtt_messages(room_id,author_id,author,text) VALUES($1,$2,$3,$4)',
          [room, uid, owner.name, 'Usou um item da Torre · ' + item.snapshot.name],
        );
        return { used_at: used.used_at, replayed: false };
      }),
    );
  });
  return router;
}

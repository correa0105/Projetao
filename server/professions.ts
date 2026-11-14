import { Router } from 'express';
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { lockStorage } from './inventory.js';
import { allocatedCopies } from './companion-inventory.js';
import { administrationFor } from './administrators.js';
import { isBasicPreview } from './account-preview.js';
import { professionProgress } from '../shared/profession-progression.js';
import { professionItemArtwork } from '../shared/profession-art.js';
import { deriveSheet, type SheetChoices } from '../shared/character-sheet.js';
import { purchaseContents } from '../shared/armor-bundles.js';
import {
  professions,
  professionMaterials,
  professionMaterialIds,
  materialItemId,
  craftRecipes,
  professionUnlocked,
  validWorkshopInput,
  type CraftRecipe,
  type CraftProject,
} from '../shared/professions.js';

type DB = Pick<PoolClient, 'query'>;
const uuid = z.string().uuid();
const vttAdministration = administrationFor('vtt');
const customDescriptions: Record<string, string> = {
  'craft-field-map':
    'Mapa dos registros de exploração entregues pelo mestre. Não revela territórios desconhecidos nem altera o mapa do Mundo.',
  'craft-route-map':
    'Mapa de caminhos conhecidos registrados em mesa. O mestre resolve as informações e os efeitos na aventura.',
  'craft-sea-chart':
    'Carta de navegação baseada em registros obtidos na aventura; não revela automaticamente locais ou segredos.',
  'craft-star-chart':
    'Carta de observações do céu registradas em mesa. Uso narrativo, sem bônus automático.',
  'craft-replica-seal':
    'Selo cenográfico de réplica. Não concede autorização, identidade nem sucesso automático em testes.',
  'craft-document-copy':
    'Cópia cenográfica de registros fornecidos em mesa. Seu efeito narrativo é decidido pelo mestre.',
};
export async function seedProfessionCatalog(db: DB) {
  for (const [id, name, description] of professionMaterials)
    await db.query(
      `INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data,active,image_path)
     VALUES($1,$2,$2,'Materiais de ofício',$3,1,0.25,'Alvorada Cinzenta · Profissões','',$4,false,$5)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,raw_data=excluded.raw_data,active=false,image_path=excluded.image_path`,
      [
        materialItemId(id),
        name,
        description,
        { crafting_material: true, table_loot: true },
        professionItemArtwork(materialItemId(id)),
      ],
    );
  const seen = new Set<string>();
  for (const recipe of craftRecipes) {
    const id = recipe.output.item_id;
    if (!id.startsWith('craft-') || seen.has(id)) continue;
    seen.add(id);
    await db.query(
      `INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data,active,image_path)
       VALUES($1,$2,$2,'Criações de ofício',$3,1,0.5,'Alvorada Cinzenta · Profissões','',$4,false,$5)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,raw_data=excluded.raw_data,active=false,image_path=excluded.image_path`,
      [
        id,
        recipe.name,
        customDescriptions[id] ||
          `${recipe.name} produzido na oficina. Peça de uso narrativo; não concede bônus automáticos de combate ou perícias.`,
        { profession_id: recipe.profession_id, crafted: true, narrative: true },
        professionItemArtwork(id),
      ],
    );
  }
}
async function character(db: DB, id: string, user: string, lock = false) {
  if (lock) await lockStorage(db as PoolClient, user, id);
  const c = (
    await db.query('SELECT * FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [
      id,
      user,
    ])
  ).rows[0];
  if (!c) throw new AppError(404, 'Personagem não encontrado.');
  const s = (
    await db.query(
      `SELECT choices,finalized_at FROM character_sheets WHERE character_id=$1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    )
  ).rows[0];
  const proficiencies: string[] =
    s?.finalized_at && s.choices ? deriveSheet(c, s.choices as SheetChoices).proficiencies : [];
  return { c, proficiencies, unlimited: await administratorAccess(db, user) };
}
async function administratorAccess(db: DB, user: string) {
  if (isBasicPreview()) return false;
  const row = (
    await db.query(
      'SELECT u.administrador,a.enabled FROM "user" u LEFT JOIN profession_administrator_access a ON a.user_id=u.id WHERE u.id=$1',
      [user],
    )
  ).rows[0];
  return row?.administrador === 1 && row?.enabled === true;
}
function requireProfession(id: string, proficiencies: string[], unlimited = false) {
  const profession = professions.find((p) => p.id === id);
  if (!profession) throw new AppError(404, 'Profissão não encontrada.');
  if (!unlimited && !professionUnlocked(profession, proficiencies))
    throw new AppError(403, 'Esta bancada exige a proficiência correspondente na ficha concluída.');
  return profession;
}
async function managedRoom(db: DB, id: string, user: string) {
  const room = (
    await db.query(
      `SELECT id,owner_id FROM vtt_rooms WHERE id=$1 AND(owner_id=$2 OR ${vttAdministration.predicate(2)})`,
      [id, user],
    )
  ).rows[0];
  if (!room)
    throw new AppError(403, 'Somente o mestre autorizado desta mesa pode registrar materiais.');
  return room;
}
async function project(db: DB, id: string, user: string) {
  const row = (await db.query('SELECT character_id FROM profession_projects WHERE id=$1', [id]))
    .rows[0];
  if (!row) throw new AppError(404, 'Trabalho não encontrado.');
  const actor = await character(db, row.character_id, user, true);
  const p = (await db.query('SELECT * FROM profession_projects WHERE id=$1 FOR UPDATE', [id]))
    .rows[0] as CraftProject;
  requireProfession(p.profession_id, actor.proficiencies, actor.unlimited);
  return p;
}
export function professionsRouter() {
  const router = Router();
  router.get('/professions', async (req, res) => {
    const id = uuid.optional().parse(req.query.character_id);
    const rooms = (
      await pool.query(
        `SELECT id,coalesce(document->>'name',document->>'title','Mesa de aventura') AS name FROM vtt_rooms WHERE owner_id=$1 OR ${vttAdministration.predicate()} ORDER BY updated_at DESC LIMIT 100`,
        [res.locals.user.id],
      )
    ).rows;
    const actor = id ? await character(pool, id, res.locals.user.id) : null;
    const unlimited = actor?.unlimited ?? (await administratorAccess(pool, res.locals.user.id));
    const progressRows = id
      ? (
          await pool.query(
            'SELECT profession_id,experience FROM character_profession_progress WHERE character_id=$1',
            [id],
          )
        ).rows
      : [];
    const progress = professions.map((p) => ({
      profession_id: p.id,
      ...professionProgress(
        Number(progressRows.find((r) => r.profession_id === p.id)?.experience ?? 0),
      ),
    }));
    const itemIds = [
      ...new Set(
        craftRecipes.flatMap((r) => [r.output.item_id, ...r.ingredients.map((i) => i.item_id)]),
      ),
    ];
    const inventory = (
      await pool.query(
        `SELECT c.id,c.name,c.image_path,c.price_cp,c.active,coalesce(i.quantity,0)::int AS quantity FROM catalog_items c LEFT JOIN inventory i ON i.item_id=c.id AND i.character_id=$1 WHERE c.id=ANY($2::text[]) ORDER BY c.name`,
        [id ?? null, itemIds],
      )
    ).rows;
    for (const item of inventory)
      item.available = Math.max(
        0,
        item.quantity - (id && item.quantity ? await allocatedCopies(pool, id, item.id) : 0),
      );
    const projects = id
      ? (
          await pool.query(
            'SELECT * FROM profession_projects WHERE character_id=$1 ORDER BY (claimed_at IS NULL) DESC,created_at DESC LIMIT 30',
            [id],
          )
        ).rows
      : [];
    res.set('Cache-Control', 'no-store').json({
      server_time: new Date().toISOString(),
      character: actor ? { id: actor.c.id, name: actor.c.name } : null,
      proficiencies: actor?.proficiencies ?? [],
      inventory,
      projects,
      rooms,
      capabilities: { all_professions: unlimited, unlimited_materials: unlimited },
      progress,
    });
  });
  router.post('/professions/projects', async (req, res) => {
    const b = z
      .object({ character_id: uuid, recipe_id: z.string().min(1).max(100), request_id: uuid })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (db) => {
        const actor = await character(db, b.character_id, res.locals.user.id, true);
        const recipe = craftRecipes.find((r) => r.id === b.recipe_id);
        if (!recipe) throw new AppError(404, 'Receita não encontrada.');
        requireProfession(recipe.profession_id, actor.proficiencies, actor.unlimited);
        const previous = (
          await db.query(
            'SELECT * FROM profession_projects WHERE character_id=$1 AND request_id=$2',
            [b.character_id, b.request_id],
          )
        ).rows[0];
        if (previous) {
          if (previous.recipe_id !== b.recipe_id)
            throw new AppError(409, 'Esta solicitação já foi usada para outra receita.');
          return previous;
        }
        const experience = Number(
          (
            await db.query(
              'SELECT experience FROM character_profession_progress WHERE character_id=$1 AND profession_id=$2',
              [b.character_id, recipe.profession_id],
            )
          ).rows[0]?.experience ?? 0,
        );
        if (!actor.unlimited && professionProgress(experience).level < (recipe.required_level ?? 1))
          throw new AppError(
            403,
            `Esta receita exige nível ${recipe.required_level} em ${professions.find((p) => p.id === recipe.profession_id)!.name}.`,
          );
        if (
          (
            await db.query(
              'SELECT 1 FROM profession_projects WHERE character_id=$1 AND claimed_at IS NULL',
              [b.character_id],
            )
          ).rowCount
        )
          throw new AppError(
            409,
            'Conclua e recolha o trabalho em andamento antes de iniciar outro.',
          );
        if (!actor.unlimited)
          for (const i of [...recipe.ingredients].sort((a, b) =>
            a.item_id.localeCompare(b.item_id),
          )) {
            const row = (
              await db.query(
                'SELECT i.quantity,c.name FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND i.item_id=$2 FOR UPDATE OF i',
                [b.character_id, i.item_id],
              )
            ).rows[0];
            const available =
              (row?.quantity ?? 0) - (await allocatedCopies(db, b.character_id, i.item_id));
            if (available < i.quantity)
              throw new AppError(
                409,
                `Materiais insuficientes: ${row?.name ?? i.item_id}. Peças equipadas ou reservadas não podem ser consumidas.`,
              );
          }
        if (!actor.unlimited)
          for (const i of recipe.ingredients) {
            await db.query(
              'DELETE FROM inventory WHERE character_id=$1 AND item_id=$2 AND quantity=$3',
              [b.character_id, i.item_id, i.quantity],
            );
            await db.query(
              'UPDATE inventory SET quantity=quantity-$3 WHERE character_id=$1 AND item_id=$2',
              [b.character_id, i.item_id, i.quantity],
            );
          }
        return (
          await db.query(
            `INSERT INTO profession_projects(character_id,recipe_id,profession_id,recipe,request_id,ready_at,materials_waived) VALUES($1,$2,$3,$4,$5,clock_timestamp()+($6*interval '1 hour'),$7) RETURNING *`,
            [
              b.character_id,
              recipe.id,
              recipe.profession_id,
              JSON.stringify(recipe),
              b.request_id,
              recipe.hours,
              actor.unlimited,
            ],
          )
        ).rows[0];
      }),
    );
  });
  router.post('/professions/projects/:id/steps', async (req, res) => {
    const id = uuid.parse(req.params.id),
      b = z
        .object({
          revision: z.number().int().min(0),
          request_id: uuid,
          input: z
            .object({
              value: z.number().finite().min(0).max(100).optional(),
              points: z.array(z.number().int().min(0).max(20)).max(20).optional(),
              ratios: z.array(z.number().int().min(0).max(100)).max(10).optional(),
              slots: z.array(z.number().int().min(0).max(20)).max(20).optional(),
              path: z
                .array(
                  z
                    .object({
                      x: z.number().finite().min(0).max(100),
                      y: z.number().finite().min(0).max(100),
                    })
                    .strict(),
                )
                .max(256)
                .optional(),
            })
            .strict(),
        })
        .strict()
        .parse(req.body);
    res.json(
      await transaction(async (db) => {
        const p = await project(db, id, res.locals.user.id);
        const previous = (
          await db.query(
            'SELECT payload FROM profession_project_actions WHERE project_id=$1 AND request_id=$2',
            [id, b.request_id],
          )
        ).rows[0];
        if (previous) {
          if (!isDeepStrictEqual(previous.payload, b))
            throw new AppError(409, 'Esta solicitação já foi usada para outra etapa.');
          return p;
        }
        if (p.claimed_at || p.step >= p.recipe.steps.length)
          throw new AppError(409, 'As etapas deste trabalho já terminaram.');
        if (p.revision !== b.revision)
          throw new AppError(409, 'Este trabalho mudou em outra janela. Atualize a bancada.');
        if (!validWorkshopInput(p.recipe.steps[p.step], b.input))
          throw new AppError(
            400,
            'O ajuste ainda não corresponde ao molde. Confira a indicação dourada e tente novamente.',
          );
        await db.query(
          'INSERT INTO profession_project_actions(project_id,request_id,payload)VALUES($1,$2,$3)',
          [id, b.request_id, JSON.stringify(b)],
        );
        return (
          await db.query(
            'UPDATE profession_projects SET step=step+1,revision=revision+1 WHERE id=$1 RETURNING *',
            [id],
          )
        ).rows[0];
      }),
    );
  });
  router.post('/professions/projects/:id/collect', async (req, res) => {
    const id = uuid.parse(req.params.id);
    z.object({}).strict().parse(req.body);
    res.json(
      await transaction(async (db) => {
        const p = await project(db, id, res.locals.user.id);
        if (p.claimed_at) return p;
        const now = (await db.query('SELECT clock_timestamp() AS now')).rows[0].now as Date;
        if (p.step !== p.recipe.steps.length || new Date(p.ready_at).getTime() > now.getTime())
          throw new AppError(
            409,
            'Conclua as etapas e aguarde o tempo de produção antes de recolher.',
          );
        const recipe = p.recipe as CraftRecipe,
          granted = purchaseContents(recipe.output.item_id).map((item_id) => ({
            item_id,
            quantity: recipe.output.quantity,
          }));
        for (const i of granted)
          await db.query(
            'INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,$2,$3)ON CONFLICT(character_id,item_id)DO UPDATE SET quantity=inventory.quantity+excluded.quantity',
            [p.character_id, i.item_id, i.quantity],
          );
        const experience = recipe.experience ?? 20;
        const awarded = await db.query(
          'INSERT INTO profession_experience_rewards(project_id,character_id,profession_id,experience)VALUES($1,$2,$3,$4)ON CONFLICT(project_id)DO NOTHING RETURNING project_id',
          [id, p.character_id, p.profession_id, experience],
        );
        if (awarded.rowCount)
          await db.query(
            'INSERT INTO character_profession_progress(character_id,profession_id,experience)VALUES($1,$2,$3)ON CONFLICT(character_id,profession_id)DO UPDATE SET experience=character_profession_progress.experience+excluded.experience,updated_at=clock_timestamp()',
            [p.character_id, p.profession_id, experience],
          );
        return (
          await db.query(
            'UPDATE profession_projects SET claimed_at=clock_timestamp(),revision=revision+1,granted=$2 WHERE id=$1 RETURNING *',
            [id, JSON.stringify(granted)],
          )
        ).rows[0];
      }),
    );
  });
  router.get('/professions/rooms/:id/characters', async (req, res) => {
    const id = uuid.parse(req.params.id);
    await managedRoom(pool, id, res.locals.user.id);
    res.json(
      (
        await pool.query(
          `SELECT c.id,c.name,u.name AS player_name FROM characters c JOIN "user" u ON u.id=c.user_id JOIN vtt_rooms r ON r.id=$1 WHERE c.deleted_at IS NULL AND(c.user_id=r.owner_id OR EXISTS(SELECT 1 FROM vtt_members m WHERE m.room_id=r.id AND m.user_id=c.user_id AND m.role IS DISTINCT FROM 'spectator')) ORDER BY c.name`,
          [id],
        )
      ).rows,
    );
  });
  router.post('/professions/material-grants', async (req, res) => {
    const b = z
      .object({
        room_id: uuid,
        character_id: uuid,
        material_id: z.string().max(100),
        quantity: z.number().int().min(1).max(99),
        reason: z.string().trim().min(5).max(500),
        request_id: uuid,
      })
      .strict()
      .parse(req.body);
    if (!professionMaterialIds.has(b.material_id))
      throw new AppError(400, 'Escolha um material de ofício adquirido em mesa.');
    res.json(
      await transaction(async (db) => {
        const room = await managedRoom(db, b.room_id, res.locals.user.id);
        await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          'profession-material:' + res.locals.user.id + ':' + b.request_id,
        ]);
        const target = (
          await db.query(
            `SELECT id,user_id FROM characters c WHERE id=$1 AND deleted_at IS NULL AND(user_id=$2 OR EXISTS(SELECT 1 FROM vtt_members m WHERE m.room_id=$3 AND m.user_id=c.user_id AND m.role IS DISTINCT FROM 'spectator'))`,
            [b.character_id, room.owner_id, room.id],
          )
        ).rows[0];
        if (!target) throw new AppError(403, 'O personagem precisa participar desta mesa.');
        await lockStorage(db, target.user_id, b.character_id);
        const previous = (
          await db.query(
            'SELECT * FROM profession_material_grants WHERE actor_id=$1 AND request_id=$2',
            [res.locals.user.id, b.request_id],
          )
        ).rows[0];
        if (previous) {
          if (!isDeepStrictEqual(previous.payload, b))
            throw new AppError(409, 'Esta entrega já foi usada para outro material.');
          return previous;
        }
        await db.query(
          'INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,$2,$3)ON CONFLICT(character_id,item_id)DO UPDATE SET quantity=inventory.quantity+excluded.quantity',
          [b.character_id, b.material_id, b.quantity],
        );
        return (
          await db.query(
            'INSERT INTO profession_material_grants(actor_id,room_id,character_id,material_id,quantity,reason,request_id,payload)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING *',
            [
              res.locals.user.id,
              b.room_id,
              b.character_id,
              b.material_id,
              b.quantity,
              b.reason,
              b.request_id,
              JSON.stringify(b),
            ],
          )
        ).rows[0];
      }),
    );
  });
  return router;
}

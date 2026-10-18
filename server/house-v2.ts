import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { requireAdministrator } from './administrators.js';
import { house2TokensRouter } from './house2-tokens.js';
import { house2LightItems } from '../shared/house2-items-lighting.js';
import { house2FinishesCatalog } from '../shared/house2-finishes.js';
import {
  house2StartingBalance,
  house2PlotPrice,
  house2PlotExpansion,
  house2Houses,
  house2Furniture,
  house2FurnitureForSale,
  house2LayoutSchema,
  house2Within,
  house2VillagePlots,
  house2HousePlacement,
} from '../shared/house-v2.js';

const uuid = z.string().uuid();
const purchaseSchema = z.object({ character_id: uuid, idempotency_key: uuid }).strict();
const plotSelect = `SELECT p.*,coalesce(p.village_slot,p.number) AS number,c.name owner_name,u.name player_name,
  coalesce(c.user_id=$2,false) AND c.deleted_at IS NULL AS can_edit
  FROM house2_plots p LEFT JOIN characters c ON c.id=p.character_id
  LEFT JOIN "user" u ON u.id=c.user_id`;
async function editPlot(db: PoolClient, id: string, user: string) {
  const p = (
    await db.query(`${plotSelect} WHERE p.id=$1 AND p.retired_at IS NULL FOR UPDATE OF p`, [
      id,
      user,
    ])
  ).rows[0];
  if (!p || !p.can_edit) throw new AppError(403, 'Você só pode editar os terrenos que comprou.');
  return p;
}
async function purchase(
  user: string,
  body: { character_id: string; idempotency_key: string },
  operation: string,
  payload: unknown,
  fn: (db: PoolClient) => Promise<{ amount: number; result: object }>,
) {
  return transaction(async (db) => {
    const character = (
      await db.query(
        'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [body.character_id, user],
      )
    ).rows[0];
    if (!character) throw new AppError(404, 'Personagem não encontrado.');
    await db.query(
      'INSERT INTO house2_accounts(user_id,balance) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [user, house2StartingBalance],
    );
    const account = (
      await db.query('SELECT balance FROM house2_accounts WHERE user_id=$1 FOR UPDATE', [user])
    ).rows[0];
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([operation, payload]))
      .digest('hex');
    const old = (
      await db.query(
        'SELECT fingerprint,result FROM house2_orders WHERE user_id=$1 AND idempotency_key=$2',
        [user, body.idempotency_key],
      )
    ).rows[0];
    if (old) {
      if (old.fingerprint !== fingerprint)
        throw new AppError(409, 'Esta compra já foi usada para outra operação.');
      return { ...old.result, replay: true };
    }
    const { amount, result } = await fn(db);
    if (account.balance < amount) throw new AppError(409, 'Saldo de teste insuficiente.');
    await db.query('UPDATE house2_accounts SET balance=balance-$2 WHERE user_id=$1', [
      user,
      amount,
    ]);
    await db.query(
      'INSERT INTO house2_orders(user_id,idempotency_key,fingerprint,amount,result)VALUES($1,$2,$3,$4,$5)',
      [user, body.idempotency_key, fingerprint, amount, JSON.stringify(result)],
    );
    return { ...result, replay: false };
  });
}
export function house2Router() {
  const router = Router();
  router.use(house2TokensRouter());
  router.get('/house-v2', async (_req, res) => {
    const user = res.locals.user.id;
    const neighborhoods = await pool.query(
      `SELECT n.*,count(p.id)::int total,count(p.id) FILTER(WHERE p.character_id IS NULL)::int available,
      count(p.id) FILTER(WHERE c.user_id=$1 AND c.deleted_at IS NULL)::int owned
      FROM house2_neighborhoods n LEFT JOIN house2_plots p ON p.neighborhood_id=n.id AND p.retired_at IS NULL
      LEFT JOIN characters c ON c.id=p.character_id GROUP BY n.id ORDER BY n.created_at,n.name`,
      [user],
    );
    const balance =
      (await pool.query('SELECT balance FROM house2_accounts WHERE user_id=$1', [user])).rows[0]
        ?.balance ?? house2StartingBalance;
    const inventory = (
      await pool.query(
        'SELECT id,catalog_id,plot_id,x,y,rotation,scale,light_on,light_revision FROM house2_items WHERE user_id=$1 ORDER BY created_at,id',
        [user],
      )
    ).rows;
    const finishes = (
      await pool.query(
        'SELECT catalog_id FROM house2_finish_ownership WHERE user_id=$1 ORDER BY catalog_id',
        [user],
      )
    ).rows.map((r) => r.catalog_id);
    res.json({ neighborhoods: neighborhoods.rows, balance, inventory, finishes });
  });
  router.post('/house-v2/neighborhoods', async (req, res) => {
    const b = z
      .object({
        name: z.string().trim().min(3).max(80),
        description: z.string().trim().max(500),
        terrain: z.enum(['earth', 'grass', 'stone']),
      })
      .strict()
      .parse(req.body);
    const id = await transaction(async (db) => {
      await requireAdministrator(res.locals.user.id, db);
      const n = (
        await db.query(
          'INSERT INTO house2_neighborhoods(name,description,terrain)VALUES($1,$2,$3) RETURNING id',
          [b.name, b.description, b.terrain],
        )
      ).rows[0];
      await db.query(
        'INSERT INTO house2_plots(neighborhood_id,number,village_slot,x,y,price) SELECT $1,ord,ord,x,y,$2 FROM jsonb_to_recordset($3::jsonb) AS p(ord integer,x integer,y integer)',
        [
          n.id,
          house2PlotPrice,
          JSON.stringify(
            house2VillagePlots.map((p, i) => ({
              ord: i + 1,
              x: p.x - house2PlotExpansion,
              y: p.y - house2PlotExpansion,
            })),
          ),
        ],
      );
      return n.id;
    });
    res.status(201).json({ id });
  });
  router.get('/house-v2/neighborhoods/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id;
    const neighborhood = (await pool.query('SELECT * FROM house2_neighborhoods WHERE id=$1', [id]))
      .rows[0];
    if (!neighborhood) throw new AppError(404, 'Vizinhança não encontrada.');
    const plots = (
      await pool.query(
        `${plotSelect} WHERE p.neighborhood_id=$1 AND p.retired_at IS NULL ORDER BY p.village_slot,p.number`,
        [id, user],
      )
    ).rows;
    const items = (
      await pool.query(
        'SELECT i.id,i.catalog_id,i.plot_id,i.x,i.y,i.rotation,i.scale,i.light_on,i.light_revision FROM house2_items i JOIN house2_plots p ON p.id=i.plot_id WHERE p.neighborhood_id=$1 AND p.retired_at IS NULL ORDER BY i.created_at,i.id',
        [id],
      )
    ).rows;
    res.json({ neighborhood, plots, items });
  });
  router.post('/house-v2/items/:id/light', async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id,
      b = z
        .object({ on: z.boolean(), revision: z.number().int().min(0) })
        .strict()
        .parse(req.body);
    const result = await transaction(async (db) => {
      const {
        rows: [item],
      } = await db.query('SELECT * FROM house2_items WHERE id=$1 AND user_id=$2 FOR UPDATE', [
        id,
        user,
      ]);
      if (!item) throw new AppError(404, 'Objeto não encontrado.');
      if (!house2LightItems[item.catalog_id])
        throw new AppError(400, 'Este objeto não possui iluminação.');
      if (item.light_on === b.on)
        return { light_on: item.light_on, light_revision: item.light_revision };
      if (item.light_revision !== b.revision)
        throw new AppError(409, 'A luz mudou em outra janela. Recarregue e tente novamente.');
      return (
        await db.query(
          'UPDATE house2_items SET light_on=$2,light_revision=light_revision+1 WHERE id=$1 RETURNING light_on,light_revision',
          [id, b.on],
        )
      ).rows[0];
    });
    res.json(result);
  });
  router.post('/house-v2/finishes', async (req, res) => {
    const b = purchaseSchema
        .extend({ catalog_id: z.string().max(80) })
        .strict()
        .parse(req.body),
      user = res.locals.user.id,
      spec = house2FinishesCatalog.find((f) => f.id === b.catalog_id);
    if (!spec) throw new AppError(400, 'Escolha um revestimento da loja.');
    res.json(
      await purchase(user, b, 'finish', [b.character_id, b.catalog_id], async (db) => {
        const old = await db.query(
          'SELECT 1 FROM house2_finish_ownership WHERE user_id=$1 AND catalog_id=$2',
          [user, spec.id],
        );
        if (old.rowCount) throw new AppError(409, 'Este revestimento já pertence à sua coleção.');
        await db.query('INSERT INTO house2_finish_ownership(user_id,catalog_id)VALUES($1,$2)', [
          user,
          spec.id,
        ]);
        return { amount: spec.price, result: { catalog_id: spec.id } };
      }),
    );
  });
  router.post('/house-v2/plots/:id/finish', async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id,
      b = z
        .object({
          kind: z.enum(['roof', 'walls', 'floor']),
          catalog_id: z.string().max(80).nullable(),
          revision: z.number().int().min(0),
        })
        .strict()
        .parse(req.body);
    const result = await transaction(async (db) => {
      const p = await editPlot(db, id, user);
      if (!p.house_id) throw new AppError(409, 'Compre uma casa antes de aplicar revestimentos.');
      if (p.revision !== b.revision)
        throw new AppError(409, 'O terreno mudou em outra janela. Recarregue antes de aplicar.');
      if (b.catalog_id) {
        const spec = house2FinishesCatalog.find((f) => f.id === b.catalog_id && f.kind === b.kind),
          owned = await db.query(
            'SELECT 1 FROM house2_finish_ownership WHERE user_id=$1 AND catalog_id=$2',
            [user, b.catalog_id],
          );
        if (!spec || !owned.rowCount)
          throw new AppError(403, 'Compre este revestimento da categoria escolhida primeiro.');
      }
      const finishes = { ...p.finishes };
      if (b.catalog_id) finishes[b.kind] = b.catalog_id;
      else delete finishes[b.kind];
      return (
        await db.query(
          'UPDATE house2_plots SET finishes=$2,revision=revision+1 WHERE id=$1 RETURNING finishes,revision',
          [id, JSON.stringify(finishes)],
        )
      ).rows[0];
    });
    res.json(result);
  });
  router.post('/house-v2/plots/:id/purchase', async (req, res) => {
    const id = uuid.parse(req.params.id),
      b = purchaseSchema.parse(req.body);
    res.json(
      await purchase(res.locals.user.id, b, 'plot', [id, b.character_id], async (db) => {
        const p = (
          await db.query(
            'SELECT * FROM house2_plots WHERE id=$1 AND retired_at IS NULL FOR UPDATE',
            [id],
          )
        ).rows[0];
        if (!p) throw new AppError(404, 'Terreno não encontrado.');
        if (p.character_id) throw new AppError(409, 'Este terreno já foi comprado.');
        await db.query(
          'UPDATE house2_plots SET character_id=$2,purchased_at=now(),revision=revision+1 WHERE id=$1',
          [id, b.character_id],
        );
        return { amount: p.price, result: { plot_id: id } };
      }),
    );
  });
  router.post('/house-v2/plots/:id/house', async (req, res) => {
    const id = uuid.parse(req.params.id),
      b = purchaseSchema
        .extend({ catalog_id: z.string().max(80) })
        .strict()
        .parse(req.body);
    const spec = house2Houses.find((h) => h.id === b.catalog_id);
    if (!spec) throw new AppError(400, 'Escolha uma casa vazia do catálogo.');
    res.json(
      await purchase(
        res.locals.user.id,
        b,
        'house',
        [id, b.character_id, b.catalog_id],
        async (db) => {
          const p = await editPlot(db, id, res.locals.user.id);
          if (p.house_id) throw new AppError(409, 'Este terreno já possui uma casa.');
          const placement = house2HousePlacement(p);
          await db.query(
            'UPDATE house2_plots SET house_id=$2,house_x=$3,house_y=$4,house_rotation=$5,revision=revision+1 WHERE id=$1',
            [id, spec.id, placement.x, placement.y, placement.rotation],
          );
          return { amount: spec.price, result: { plot_id: id, house_id: spec.id } };
        },
      ),
    );
  });
  router.post('/house-v2/furniture', async (req, res) => {
    const b = purchaseSchema
      .extend({ catalog_id: z.string().max(80), plot_id: uuid })
      .strict()
      .parse(req.body);
    const spec = house2Furniture.find((f) => f.id === b.catalog_id);
    if (!spec) throw new AppError(400, 'Mobília não encontrada.');
    res.json(
      await purchase(
        res.locals.user.id,
        b,
        'furniture',
        [b.plot_id, b.character_id, b.catalog_id],
        async (db) => {
          if (!house2FurnitureForSale.some((f) => f.id === spec.id))
            throw new AppError(400, 'Esta mobília não está mais à venda.');
          await editPlot(db, b.plot_id, res.locals.user.id);
          const count = (
            await db.query('SELECT count(*)::int n FROM house2_items WHERE user_id=$1', [
              res.locals.user.id,
            ])
          ).rows[0].n;
          if (count >= 500) throw new AppError(409, 'A coleção de teste chegou a 500 peças.');
          const item = (
            await db.query(
              'INSERT INTO house2_items(user_id,catalog_id)VALUES($1,$2)RETURNING id',
              [res.locals.user.id, spec.id],
            )
          ).rows[0];
          return { amount: spec.price, result: { item_id: item.id } };
        },
      ),
    );
  });
  router.post('/house-v2/items/:id/store', async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id;
    const body = z
      .object({ plot_id: uuid, revision: z.number().int().min(0) })
      .strict()
      .parse(req.body);
    const result = await transaction(async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'house2-layout:' + user,
      ]);
      const plot = await editPlot(db, body.plot_id, user);
      const item = (
        await db.query(
          'SELECT id,plot_id FROM house2_items WHERE id=$1 AND user_id=$2 FOR UPDATE',
          [id, user],
        )
      ).rows[0];
      if (!item) throw new AppError(403, 'Você só pode guardar os seus próprios objetos.');
      if (plot.revision !== body.revision)
        throw new AppError(409, 'O terreno mudou em outra janela. Atualize antes de guardar.');
      if (item.plot_id && item.plot_id !== plot.id)
        throw new AppError(
          409,
          'Este objeto foi colocado em outro terreno. Atualize antes de guardar.',
        );
      let revision = plot.revision;
      if (item.plot_id) {
        await db.query('UPDATE house2_items SET plot_id=NULL,x=NULL,y=NULL WHERE id=$1', [id]);
        revision = (
          await db.query(
            'UPDATE house2_plots SET revision=revision+1 WHERE id=$1 RETURNING revision',
            [plot.id],
          )
        ).rows[0].revision;
      }
      const items = (
        await db.query(
          'SELECT id,x,y,rotation,scale FROM house2_items WHERE user_id=$1 AND plot_id=$2 ORDER BY created_at,id',
          [user, plot.id],
        )
      ).rows;
      return {
        stored: true,
        layout: {
          revision,
          ground: plot.ground ?? [],
          house: plot.house_id
            ? { x: plot.house_x, y: plot.house_y, rotation: plot.house_rotation }
            : null,
          items,
        },
      };
    });
    res.json(result);
  });
  router.put('/house-v2/plots/:id/layout', async (req, res) => {
    const id = uuid.parse(req.params.id),
      b = house2LayoutSchema.parse(req.body),
      user = res.locals.user.id;
    const result = await transaction(async (db) => {
      // Serialize edits of this user's inventory across different plots, too.
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'house2-layout:' + user,
      ]);
      const p = await editPlot(db, id, user);
      if (p.revision !== b.revision)
        throw new AppError(409, 'O terreno mudou em outra janela. Recarregue antes de editar.');
      if (
        b.ground?.some((s) =>
          s.points.some(
            (at) => at.x < p.x || at.y < p.y || at.x > p.x + p.width || at.y > p.y + p.height,
          ),
        )
      )
        throw new AppError(400, 'A pintura deve permanecer dentro do seu terreno.');
      if (Boolean(p.house_id) !== Boolean(b.house))
        throw new AppError(400, 'A casa precisa ser adquirida antes de ser posicionada.');
      if (b.house) {
        if (
          b.house.x !== p.house_x ||
          b.house.y !== p.house_y ||
          b.house.rotation !== p.house_rotation
        )
          throw new AppError(
            403,
            'A casa é fixa no terreno. Você pode ajustar apenas a decoração.',
          );
        const spec = house2Houses.find((h) => h.id === p.house_id);
        if (!spec || !house2Within(p, b.house, spec.width, spec.height))
          throw new AppError(400, 'A casa deve ficar inteiramente no seu terreno.');
      }
      const ids = b.items.map((i) => i.id);
      if (new Set(ids).size !== ids.length)
        throw new AppError(400, 'Uma peça não pode aparecer duas vezes.');
      const items = (
        await db.query(
          'SELECT * FROM house2_items WHERE user_id=$1 AND (plot_id=$2 OR id=ANY($3::uuid[])) ORDER BY id FOR UPDATE',
          [user, id, ids],
        )
      ).rows;
      for (const i of b.items) {
        const owned = items.find((o) => o.id === i.id),
          spec = house2Furniture.find((f) => f.id === owned?.catalog_id);
        if (!owned || !spec || (owned.plot_id && owned.plot_id !== id))
          throw new AppError(403, 'Esta mobília não está disponível no seu terreno.');
        const scale = i.scale ?? owned.scale;
        if (!house2Within(p, i, spec.width * scale, spec.height * scale))
          throw new AppError(400, 'A mobília deve ficar inteiramente no seu terreno.');
      }
      await db.query('UPDATE house2_items SET plot_id=NULL,x=NULL,y=NULL WHERE plot_id=$1', [id]);
      for (const i of b.items)
        await db.query(
          'UPDATE house2_items SET plot_id=$2,x=$3,y=$4,rotation=$5,scale=$6 WHERE id=$1 AND user_id=$7',
          [
            i.id,
            id,
            i.x,
            i.y,
            i.rotation,
            i.scale ?? items.find((o) => o.id === i.id)!.scale,
            user,
          ],
        );
      const updated = (
        await db.query(
          'UPDATE house2_plots SET house_x=$2,house_y=$3,house_rotation=$4,ground=coalesce($5::jsonb,ground),revision=revision+1 WHERE id=$1 RETURNING revision',
          [
            id,
            b.house?.x ?? null,
            b.house?.y ?? null,
            b.house?.rotation ?? 0,
            b.ground === undefined ? null : JSON.stringify(b.ground),
          ],
        )
      ).rows[0];
      return updated;
    });
    res.json(result);
  });
  return router;
}

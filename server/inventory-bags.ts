import { Router } from 'express';
import { z } from 'zod';
import { transaction } from './db.js';
import { AppError } from './services.js';
import { lockStorage, storageState } from './inventory.js';
import { allocatedCopies } from './companion-inventory.js';
import { ensureWardrobe } from './companion-equipment.js';

const place = z.union([z.enum(['character', 'vault']), z.string().uuid()]);
const schema = z
  .object({
    character_id: z.string().uuid(),
    item_id: z.string().min(1).max(100),
    source: place,
    destination: z.union([place, z.literal('discard')]),
    quantity: z.number().int().min(1).max(2147483647),
    idempotency_key: z.string().uuid(),
  })
  .strict();
export function inventoryBagsRouter() {
  const router = Router();
  router.post('/inventory/bags/transfers', async (req, res) => {
    const data = schema.parse(req.body),
      userId = res.locals.user.id;
    if (data.source === data.destination)
      throw new AppError(400, 'Escolha outro inventário de destino.');
    res.json(
      await transaction(async (db) => {
        await lockStorage(db, userId, data.character_id);
        const {
          rows: [previous],
        } = await db.query(
          'SELECT * FROM inventory_bag_operations WHERE user_id=$1 AND idempotency_key=$2',
          [userId, data.idempotency_key],
        );
        if (previous) {
          if (
            ['character_id', 'item_id', 'source', 'destination', 'quantity'].some(
              (k) => previous[k] !== data[k as keyof typeof data],
            )
          )
            throw new AppError(409, 'Este pedido já foi usado para outra transferência.');
          return { ...(await storageState(db, userId, data.character_id)), replayed: true };
        }
        for (const id of [data.source, data.destination].filter(
          (p) => !['character', 'vault', 'discard'].includes(p),
        )) {
          const {
            rows: [row],
          } = await db.query(
            `SELECT to_jsonb(a) AS animal,'mount' AS kind FROM character_mounts a WHERE id=$1 AND character_id=$2
          UNION ALL SELECT to_jsonb(a) AS animal,'pet' AS kind FROM character_pets a WHERE id=$1 AND character_id=$2`,
            [id, data.character_id],
          );
          if (!row) throw new AppError(404, 'Este animal não pertence ao personagem selecionado.');
          await ensureWardrobe(db, {
            ...row.animal,
            kind: row.kind,
            species_id: row.animal.mount_id || row.animal.pet_id,
          });
        }
        const itemId = data.item_id,
          quantity = data.quantity;
        const {
          rows: [stock],
        } = await db.query(
          'SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2 FOR UPDATE',
          [data.character_id, itemId],
        );
        const {
          rows: [vault],
        } = await db.query(
          'SELECT quantity FROM account_vault WHERE user_id=$1 AND item_id=$2 FOR UPDATE',
          [userId, itemId],
        );
        let available = 0;
        if (data.source === 'character')
          available =
            (stock?.quantity || 0) - (await allocatedCopies(db, data.character_id, itemId));
        else if (data.source === 'vault') available = vault?.quantity || 0;
        else {
          const {
            rows: [bag],
          } = await db.query(
            `SELECT i.quantity-(SELECT count(*) FROM companion_equipment e WHERE e.wardrobe_id=i.wardrobe_id AND e.item_id=i.item_id) AS available FROM companion_inventory i WHERE i.wardrobe_id=$1 AND i.item_id=$2 FOR UPDATE`,
            [data.source, itemId],
          );
          available = Number(bag?.available || 0);
        }
        if (available < quantity)
          throw new AppError(
            409,
            'Quantidade livre insuficiente neste inventário. Desequipe as unidades em uso antes de transferir ou excluir.',
          );
        // Aggregate stock changes only at the vault boundary or on a discard.
        const stockDelta =
          (data.source === 'vault' ? quantity : 0) -
          (data.destination === 'vault' || data.destination === 'discard' ? quantity : 0);
        if (
          (stock?.quantity || 0) + stockDelta > 2147483647 ||
          (data.destination === 'vault' && (vault?.quantity || 0) + quantity > 2147483647)
        )
          throw new AppError(409, 'O destino não comporta essa quantidade.');
        if (data.source !== 'character' && data.source !== 'vault') {
          await db.query(
            'DELETE FROM companion_inventory WHERE wardrobe_id=$1 AND item_id=$2 AND quantity=$3',
            [data.source, itemId, quantity],
          );
          await db.query(
            'UPDATE companion_inventory SET quantity=quantity-$3 WHERE wardrobe_id=$1 AND item_id=$2',
            [data.source, itemId, quantity],
          );
        }
        if (!['character', 'vault', 'discard'].includes(data.destination)) {
          const {
            rows: [bag],
          } = await db.query(
            'SELECT quantity FROM companion_inventory WHERE wardrobe_id=$1 AND item_id=$2',
            [data.destination, itemId],
          );
          if ((bag?.quantity || 0) + quantity > 2147483647)
            throw new AppError(409, 'O destino não comporta essa quantidade.');
          await db.query(
            `INSERT INTO companion_inventory(wardrobe_id,character_id,item_id,quantity)VALUES($1,$2,$3,$4) ON CONFLICT(wardrobe_id,item_id)DO UPDATE SET quantity=companion_inventory.quantity+EXCLUDED.quantity`,
            [data.destination, data.character_id, itemId, quantity],
          );
        }
        if (stockDelta < 0) {
          await db.query(
            'DELETE FROM inventory WHERE character_id=$1 AND item_id=$2 AND quantity=$3',
            [data.character_id, itemId, -stockDelta],
          );
          await db.query(
            'UPDATE inventory SET quantity=quantity+$3 WHERE character_id=$1 AND item_id=$2',
            [data.character_id, itemId, stockDelta],
          );
        } else if (stockDelta > 0)
          await db.query(
            `INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,$2,$3)ON CONFLICT(character_id,item_id)DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity`,
            [data.character_id, itemId, stockDelta],
          );
        if (data.source === 'vault') {
          await db.query(
            'DELETE FROM account_vault WHERE user_id=$1 AND item_id=$2 AND quantity=$3',
            [userId, itemId, quantity],
          );
          await db.query(
            'UPDATE account_vault SET quantity=quantity-$3 WHERE user_id=$1 AND item_id=$2',
            [userId, itemId, quantity],
          );
        } else if (data.destination === 'vault')
          await db.query(
            `INSERT INTO account_vault(user_id,item_id,quantity)VALUES($1,$2,$3)ON CONFLICT(user_id,item_id)DO UPDATE SET quantity=account_vault.quantity+EXCLUDED.quantity`,
            [userId, itemId, quantity],
          );
        await db.query(
          `INSERT INTO inventory_bag_operations(user_id,character_id,item_id,source,destination,quantity,idempotency_key)VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            userId,
            data.character_id,
            itemId,
            data.source,
            data.destination,
            quantity,
            data.idempotency_key,
          ],
        );
        return storageState(db, userId, data.character_id);
      }),
    );
  });
  return router;
}

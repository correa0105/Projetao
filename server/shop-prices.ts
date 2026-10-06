import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { houseCatalog } from '../shared/house.js';

type Database = Pick<PoolClient, 'query'>;

// The catalog seed and edits use the same lock so a seed never wins over an edit.
export async function lockCatalogPrices(database: Database) {
  await database.query('SELECT pg_advisory_xact_lock(74261924)');
}

// Lock even when an override does not exist yet; a row lock cannot cover that case.
export async function lockHousePrice(database: Database, id: string) {
  await database.query('SELECT pg_advisory_xact_lock(hashtextextended($1,74261925))', [
    `house-${id}`,
  ]);
}

export async function currentHouseCatalog(database: Database = pool) {
  const { rows } = await database.query(
    'SELECT item_id,price_cp FROM shop_price_overrides WHERE item_id=ANY($1::text[])',
    [houseCatalog.map((item) => `house-${item.id}`)],
  );
  const prices = new Map<string, number>(rows.map((row) => [row.item_id, row.price_cp]));
  return houseCatalog.map((item) => ({
    ...item,
    price_cp: prices.get(`house-${item.id}`) ?? item.price_cp,
  }));
}

export async function currentHousePrice(database: Database, id: string, defaultPrice: number) {
  await lockHousePrice(database, id);
  const {
    rows: [override],
  } = await database.query('SELECT price_cp FROM shop_price_overrides WHERE item_id=$1', [
    `house-${id}`,
  ]);
  return override?.price_cp ?? defaultPrice;
}

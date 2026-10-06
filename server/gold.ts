import type { PoolClient } from 'pg';
import { AppError } from './services.js';

type Database = Pick<PoolClient, 'query'>;

/** Take this account lock before the character lock in every spending transaction. */
export async function currentGoldUnlimited(
  database: Database,
  userId: string,
  lock = true,
): Promise<boolean> {
  const {
    rows: [account],
  } = await database.query(
    'SELECT administrador FROM "user" WHERE id=$1' + (lock ? ' FOR SHARE' : ''),
    [userId],
  );
  return account?.administrador === 1;
}

/** The purchase records its real price; an administrator's saved balance stays unchanged. */
export async function spendGold(
  database: Database,
  character: { id: string; gold_cp: number },
  amount: number,
  unlimited: boolean,
  insufficientMessage: string,
): Promise<number> {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2147483647)
    throw new AppError(409, 'O valor do pedido excede o limite de uma compra.');
  if (unlimited) return character.gold_cp;
  if (character.gold_cp < amount) throw new AppError(409, insufficientMessage);
  const {
    rows: [updated],
  } = await database.query(
    'UPDATE characters SET gold_cp=gold_cp-$2 WHERE id=$1 RETURNING gold_cp',
    [character.id, amount],
  );
  return updated.gold_cp;
}

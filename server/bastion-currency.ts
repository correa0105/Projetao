import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { AppError } from './services.js';
import { economyVersion } from '../shared/economy.js';

export function requireEconomyClient(req: { get(name: string): string | undefined }) {
  if (req.get('X-Economy-Version') !== economyVersion)
    throw new AppError(
      409,
      'A economia foi atualizada. Recarregue a página antes de comprar ou contribuir.',
    );
}

export async function bastionBalance(userId: string, db: Pick<PoolClient, 'query'> = pool) {
  return Number(
    (await db.query('SELECT balance FROM house2_accounts WHERE user_id=$1', [userId])).rows[0]
      ?.balance || 0,
  );
}
export async function changeBastionCredits(
  db: PoolClient,
  userId: string,
  amount: number,
  kind: string,
  reference: string,
  metadata: Record<string, unknown> = {},
) {
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 2147483647)
    throw new AppError(400, 'Valor de créditos inválido.');
  await db.query('INSERT INTO house2_accounts(user_id,balance)VALUES($1,0)ON CONFLICT DO NOTHING', [
    userId,
  ]);
  const account = (
    await db.query('SELECT balance FROM house2_accounts WHERE user_id=$1 FOR UPDATE', [userId])
  ).rows[0];
  const prior = (
    await db.query(
      'SELECT amount,metadata=$4::jsonb AS same FROM bastion_currency_ledger WHERE user_id=$1 AND kind=$2 AND reference=$3',
      [userId, kind, reference, JSON.stringify(metadata)],
    )
  ).rows[0];
  if (prior) {
    if (Number(prior.amount) !== amount || !prior.same)
      throw new AppError(409, 'Este pedido de créditos já foi usado para outra operação.');
    return Number(account.balance);
  }
  const next = Number(account.balance) + amount;
  if (next < 0)
    throw new AppError(
      409,
      'Créditos do Bastião insuficientes. Complete missões para receber créditos.',
    );
  if (next > 2147483647) throw new AppError(409, 'O limite de Créditos do Bastião foi atingido.');
  await db.query('UPDATE house2_accounts SET balance=$2 WHERE user_id=$1', [userId, next]);
  await db.query(
    'INSERT INTO bastion_currency_ledger(user_id,kind,reference,amount,balance_after,metadata)VALUES($1,$2,$3,$4,$5,$6)',
    [userId, kind, reference, amount, next, metadata],
  );
  return next;
}

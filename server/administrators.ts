import type { Pool, PoolClient } from 'pg';
import { pool } from './db.js';
import { AppError } from './services.js';

type Database = Pool | PoolClient;

// Only trusted SQL call sites choose the placeholder; never use request input here.
export const administratorPredicate = (parameter = 1) =>
  `EXISTS(SELECT 1 FROM "user" WHERE id=$${parameter} AND administrador=1)`;

export async function isAdministrator(userId: string, database: Database = pool) {
  const {
    rows: [user],
  } = await database.query('SELECT administrador FROM "user" WHERE id=$1', [userId]);
  return user?.administrador === 1;
}

export async function requireAdministrator(userId: string, database: Database = pool) {
  if (!(await isAdministrator(userId, database)))
    throw new AppError(403, 'Somente administradores podem alterar o conteúdo do sistema.');
}

import type { Pool, PoolClient } from 'pg';
import { pool } from './db.js';
import { AppError } from './services.js';
import { isBasicPreview } from './account-preview.js';
import { adminScopes, type AdminScope } from '../shared/admin-scopes.js';

type Database = Pool | PoolClient;

// Only trusted SQL call sites choose the placeholder; never use request input here.
export const administratorPredicate = (parameter = 1) =>
  `EXISTS(SELECT 1 FROM "user" WHERE id=$${parameter} AND administrador=1${isBasicPreview() ? ' AND false' : ''})`;

export async function isAdministrator(userId: string, database: Database = pool) {
  if (isBasicPreview()) return false;
  const {
    rows: [user],
  } = await database.query('SELECT administrador FROM "user" WHERE id=$1', [userId]);
  return user?.administrador === 1;
}

export async function requireAdministrator(userId: string, database: Database = pool) {
  if (!(await isAdministrator(userId, database)))
    throw new AppError(403, 'Somente administradores podem alterar o conteúdo do sistema.');
}

/** Each router binds one explicit content area; global admin checks stay strict. */
export function administrationFor(scope: AdminScope) {
  if (!adminScopes.includes(scope)) throw new Error('Área administrativa inválida.');
  const predicate = (parameter = 1) => {
    if (!Number.isInteger(parameter) || parameter < 1) throw new Error('Parâmetro SQL inválido.');
    return `EXISTS(SELECT 1 FROM "user" u WHERE u.id=$${parameter} AND (u.administrador=1 OR EXISTS(SELECT 1 FROM administrator_scopes s WHERE s.user_id=u.id AND s.scope='${scope}'))${isBasicPreview() ? ' AND false' : ''})`;
  };
  const has = async (userId: string, database: Database = pool) => {
    if (isBasicPreview()) return false;
    const {
      rows: [row],
    } = await database.query(`SELECT ${predicate()} AS allowed`, [userId]);
    return row.allowed === true;
  };
  const require = async (userId: string, database: Database = pool) => {
    if (!(await has(userId, database)))
      throw new AppError(403, 'Esta conta não pode administrar esta área.');
  };
  return { predicate, has, require };
}
export async function administrativeScopes(
  userId: string,
  database: Database = pool,
): Promise<AdminScope[]> {
  if (isBasicPreview()) return [];
  if (await isAdministrator(userId, database)) return [...adminScopes];
  const { rows } = await database.query(
    'SELECT scope FROM administrator_scopes WHERE user_id=$1 ORDER BY scope',
    [userId],
  );
  return rows
    .map((r) => r.scope)
    .filter((scope): scope is AdminScope => adminScopes.includes(scope));
}

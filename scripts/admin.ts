import { pool } from '../server/db.js';

const [email, value] = process.argv.slice(2);
try {
  if (!email || !['0', '1'].includes(value))
    throw new Error('Uso: node --import tsx scripts/admin.ts email@exemplo.com 0|1');
  const {
    rows: [user],
  } = await pool.query(
    'UPDATE "user" SET administrador=$2 WHERE lower(btrim(email))=lower(btrim($1)) RETURNING email,administrador',
    [email, Number(value)],
  );
  if (!user) throw new Error('Conta não encontrada. Nenhum usuário foi criado ou alterado.');
  console.log(`Administrador de ${user.email}: ${user.administrador}.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

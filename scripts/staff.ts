import { pool } from '../server/db.js';

const [email, role] = process.argv.slice(2);
try {
  if (!email || !['admin', 'staff', 'remove'].includes(role))
    throw new Error('Uso: npm run staff -- email@exemplo.com admin|staff|remove');
  const {
    rows: [user],
  } = await pool.query('SELECT id FROM "user" WHERE lower(email)=lower($1)', [email]);
  if (!user) throw new Error('Conta não encontrada. Cadastre a conta primeiro.');
  if (role === 'remove') await pool.query('DELETE FROM guild_staff WHERE user_id=$1', [user.id]);
  else
    await pool.query(
      'INSERT INTO guild_staff(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role',
      [user.id, role],
    );
  console.log(
    role === 'remove' ? 'Permissão de staff removida.' : `Permissão atualizada: ${role}.`,
  );
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

import { migrate } from '../server/migrate.js';
import { pool } from '../server/db.js';
try {
  await migrate();
} finally {
  await pool.end();
}

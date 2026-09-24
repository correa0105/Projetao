import { seed } from '../server/seed.js';
import { pool } from '../server/db.js';
try {
  await seed();
} finally {
  await pool.end();
}

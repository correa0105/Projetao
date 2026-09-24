import { createApp } from './app.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';
import { pool } from './db.js';

await migrate();
await seed();
const app = createApp();
const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () =>
  console.log('Alvorada Cinzenta disponível em http://localhost:3000'),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });

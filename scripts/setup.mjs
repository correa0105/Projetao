import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env')) {
  console.log('.env já existe. Configurações preservadas.');
} else {
  const databasePassword = randomBytes(24).toString('hex');
  const secret = randomBytes(48).toString('hex');
  const example = readFileSync('.env.example', 'utf8');
  writeFileSync(
    '.env',
    example
      .replaceAll('alvorada_cinzenta_local', databasePassword)
      .replace('replace-with-a-random-secret-of-at-least-32-characters', secret)
      .replace(
        'APP_ORIGIN=http://localhost:3000',
        'APP_ORIGIN=http://localhost:3000,http://localhost:5173',
      ),
    { mode: 0o600 },
  );
  console.log('.env criado com segredos aleatórios. Execute: docker compose up -d --build');
}

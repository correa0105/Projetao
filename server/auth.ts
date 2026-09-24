import { betterAuth } from 'better-auth';
import { pool } from './db.js';

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32 || secret.startsWith('replace-'))
  throw new Error('Defina BETTER_AUTH_SECRET com pelo menos 32 caracteres aleatórios.');
export const origins = (process.env.APP_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((value) => value.trim());
export const auth = betterAuth({
  appName: 'Alvorada Cinzenta',
  database: pool,
  secret,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  trustedOrigins: origins,
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, window: 60, max: 30 },
  advanced: {
    // This header is overwritten from the socket by our Express middleware.
    ipAddress: { ipAddressHeaders: ['x-guild-client-ip'] },
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
  },
});

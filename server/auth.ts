import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import {
  passwordMaximumLength,
  passwordMinimumLength,
  passwordRule,
  validNewPassword,
} from '../shared/password-policy.js';
import { requireRecoveryMail, sendRecoveryMail } from './recovery-mail.js';
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
  emailAndPassword: {
    enabled: true,
    minPasswordLength: passwordMinimumLength,
    maxPasswordLength: passwordMaximumLength,
    resetPasswordTokenExpiresIn: 30 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => sendRecoveryMail(user, url),
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const value =
        ctx.path === '/sign-up/email'
          ? ctx.body?.password
          : ['/reset-password', '/change-password', '/set-password'].includes(ctx.path)
            ? ctx.body?.newPassword
            : undefined;
      if (typeof value === 'string' && !validNewPassword(value))
        throw new APIError('BAD_REQUEST', {
          message: passwordRule,
          code: 'INVALID_PASSWORD_FORMAT',
        });
      if (ctx.path === '/request-password-reset') {
        try {
          await requireRecoveryMail();
        } catch {
          throw new APIError('SERVICE_UNAVAILABLE', {
            message: 'A recuperação por e-mail ainda precisa ser ativada pelo administrador.',
            code: 'RECOVERY_MAIL_UNAVAILABLE',
          });
        }
        return {
          context: {
            body: {
              ...ctx.body,
              redirectTo: new URL('/?recover=1', process.env.BETTER_AUTH_URL || origins[0]).href,
            },
          },
        };
      }
    }),
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      '/request-password-reset': { window: 60, max: 3 },
      '/reset-password': { window: 60, max: 5 },
    },
  },
  advanced: {
    // Overwritten by Express using its explicitly configured proxy trust policy.
    ipAddress: { ipAddressHeaders: ['x-guild-client-ip'] },
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
  },
});

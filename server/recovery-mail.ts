import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { pool } from './db.js';
import { AppError } from './services.js';

type Credential = { email: string; password: string };
function key() {
  return Buffer.from(
    hkdfSync(
      'sha256',
      process.env.BETTER_AUTH_SECRET!,
      'alvorada-recovery-mail',
      'gmail-credential-v1',
      32,
    ),
  );
}
export function encryptMailCredential(value: Credential) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}
export function decryptMailCredential(value: string): Credential {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1') throw Error('Unsupported mail credential version');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString(
      'utf8',
    ),
  );
}
export async function mailCredential() {
  const row = (
    await pool.query('SELECT credential FROM recovery_mail_settings WHERE singleton=true')
  ).rows[0];
  if (!row) return null;
  try {
    return decryptMailCredential(row.credential);
  } catch {
    throw new AppError(
      503,
      'O envio de e-mail precisa ser configurado novamente pelo administrador.',
    );
  }
}
export function gmailTransport(credential: Credential) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: credential.email, pass: credential.password },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
export async function requireRecoveryMail() {
  const credential = await mailCredential();
  if (!credential)
    throw new AppError(
      503,
      'A recuperação por e-mail ainda precisa ser ativada pelo administrador.',
    );
  return credential;
}
function escaped(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
export async function sendRecoveryMail(user: { email: string; name: string }, url: string) {
  const credential = await requireRecoveryMail();
  const transport = gmailTransport(credential);
  try {
    await transport.sendMail({
      from: { name: 'Alvorada Cinzenta', address: credential.email },
      to: user.email,
      subject: 'Recupere sua senha — Alvorada Cinzenta',
      text: `Olá, ${user.name}.\n\nRecebemos um pedido para trocar sua senha na Alvorada Cinzenta.\nAbra este link em até 30 minutos:\n${url}\n\nSe você não fez esse pedido, ignore este e-mail. Sua senha continua a mesma.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:560px"><h1>Recuperar senha</h1><p>Olá, ${escaped(user.name)}.</p><p>Recebemos um pedido para trocar sua senha na Alvorada Cinzenta.</p><p><a href="${escaped(url)}">Criar uma nova senha</a></p><p>Este link expira em 30 minutos e só pode ser usado uma vez.</p><p>Se você não fez esse pedido, ignore este e-mail. Sua senha continua a mesma.</p></div>`,
    });
  } catch {
    // Never expose SMTP responses, credentials, reset tokens or recipient addresses.
    console.error(
      'Não foi possível enviar um e-mail de recuperação. Confira a configuração do Gmail.',
    );
    throw new AppError(
      503,
      'Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.',
    );
  } finally {
    transport.close();
  }
}

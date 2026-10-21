import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAdministrator } from './administrators.js';
import { pool } from './db.js';
import { AppError } from './services.js';
import {
  encryptMailCredential,
  gmailTransport,
  mailCredential,
  requireRecoveryMail,
} from './recovery-mail.js';
export function recoveryMailSettingsRouter() {
  const router = Router();
  router.use('/admin/recovery-mail', async (_req, res, next) => {
    await requireAdministrator(res.locals.user.id);
    next();
  });
  router.get('/admin/recovery-mail', async (_req, res) => {
    const credential = await mailCredential();
    res.json({
      email: res.locals.user.email,
      sender: credential?.email || null,
      configured: !!credential,
    });
  });
  router.use(
    '/admin/recovery-mail',
    rateLimit({
      windowMs: 60000,
      limit: 5,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Aguarde um minuto antes de tentar novamente.' },
    }),
  );
  router.put('/admin/recovery-mail', async (req, res) => {
    const { appPassword } = z
      .object({
        appPassword: z
          .string()
          .max(100)
          .transform((v) => v.replace(/\s/g, ''))
          .pipe(
            z
              .string()
              .regex(
                /^[a-zA-Z0-9]{16}$/,
                'Informe os 16 caracteres da senha de aplicativo do Google.',
              ),
          ),
      })
      .strict()
      .parse(req.body);
    const email = String(res.locals.user.email).toLowerCase();
    if (!email.endsWith('@gmail.com') && !email.endsWith('@googlemail.com'))
      throw new AppError(400, 'Esta configuração usa o Gmail da conta de administrador.');
    const credential = { email, password: appPassword },
      transport = gmailTransport(credential);
    try {
      await transport.verify();
    } catch {
      throw new AppError(
        400,
        'O Gmail não aceitou a conexão. Confira a senha de aplicativo e a verificação em duas etapas.',
      );
    } finally {
      transport.close();
    }
    await pool.query(
      'INSERT INTO recovery_mail_settings(singleton,credential,updated_by) VALUES(true,$1,$2) ON CONFLICT(singleton) DO UPDATE SET credential=EXCLUDED.credential,updated_by=EXCLUDED.updated_by,updated_at=now()',
      [encryptMailCredential(credential), res.locals.user.id],
    );
    res.json({ configured: true, sender: email });
  });
  router.post('/admin/recovery-mail/test', async (_req, res) => {
    const credential = await requireRecoveryMail(),
      transport = gmailTransport(credential);
    try {
      await transport.sendMail({
        from: { name: 'Alvorada Cinzenta', address: credential.email },
        to: res.locals.user.email,
        subject: 'Envio de e-mail ativado — Alvorada Cinzenta',
        text: 'O envio de e-mail da Alvorada Cinzenta está funcionando. Jogadores já podem solicitar um link para recuperar a senha.',
      });
    } catch {
      throw new AppError(503, 'Não foi possível enviar o teste. Confira a configuração do Gmail.');
    } finally {
      transport.close();
    }
    res.json({ ok: true });
  });
  return router;
}

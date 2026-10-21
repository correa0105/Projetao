import type { Express, RequestHandler } from 'express';

/** Enable only when the app port is private and one proxy overwrites forwarded headers. */
export function configureReverseProxy(app: Express, enabled = process.env.TRUST_REVERSE_PROXY) {
  app.set('trust proxy', enabled === '1' ? 1 : false);
}

/** Better Auth must use the same verified client address as the API rate limiter. */
export const authenticationClientIp: RequestHandler = (req, _res, next) => {
  req.headers['x-guild-client-ip'] = req.ip || req.socket.remoteAddress || '127.0.0.1';
  next();
};

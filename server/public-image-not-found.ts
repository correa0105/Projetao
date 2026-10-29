import type { RequestHandler } from 'express';

/** A missing image must not fall through to the SPA document with status 200. */
export const publicImageNotFound: RequestHandler = (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  let path: string;
  try {
    path = decodeURIComponent(req.path);
  } catch {
    return next();
  }
  if (!/\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(path)) return next();
  res
    .status(404)
    .set('Cache-Control', 'no-store')
    .type('text/plain')
    .send('Imagem não encontrada.');
};

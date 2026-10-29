import type { RequestHandler } from 'express';
import replacements from '../shared/public-image-replacements-20261029.json';

/** Stored scene URLs keep working while only their current artwork is shipped. */
export const publicImageReplacements: RequestHandler = (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  let path: string;
  try {
    path = decodeURIComponent(req.path);
  } catch {
    return next();
  }
  const target = (replacements as Record<string, string>)[path];
  if (!target) return next();
  res
    .set('Cache-Control', 'public, max-age=3600')
    .redirect(307, target + (req.query.original === '1' ? '?original=1' : ''));
};

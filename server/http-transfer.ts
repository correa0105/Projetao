import {promisify} from 'node:util';import {gzip} from 'node:zlib';import type {Request,Response,NextFunction} from 'express';import {existsSync} from 'node:fs';import {resolve} from 'node:path';
const zip=promisify(gzip);
/** Compress large JSON responses without changing authentication, visibility or cache policy. */
export async function sendCompressedJson(req:Request,res:Response,items:unknown) {
  const body=JSON.stringify(items);res.vary('Accept-Encoding');res.type('application/json');
  if(body.length>2048&&req.acceptsEncodings('gzip')){const bytes=await zip(Buffer.from(body),{level:4});res.set('Content-Encoding','gzip');return res.send(bytes);}
  return res.send(body);
}
export const sendCatalog = sendCompressedJson;

/** Only content-hashed build assets use immutable caching and optional precompressed bytes. */
export function compressedBundle(req:Request,res:Response,next:NextFunction){
  if(!['GET','HEAD'].includes(req.method)||!/^\/assets\/[A-Za-z0-9_.-]+\.(js|css)$/.test(req.path))return next();
  res.vary('Accept-Encoding');
  const base=resolve('dist/client','.'+req.path);
  const available=(['br','gzip'] as const).filter(encoding=>existsSync(base+(encoding==='br'?'.br':'.gz')));
  const encoding=available.length?req.acceptsEncodings(...available):false;
  if(!encoding)return next();
  res.type(req.path.endsWith('.js')?'application/javascript':'text/css');
  res.set({'Content-Encoding':encoding,'Cache-Control':'public, max-age=31536000, immutable'});
  res.sendFile(base+(encoding==='br'?'.br':'.gz'));
}

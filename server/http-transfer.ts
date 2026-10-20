import {promisify} from 'node:util';import {gzip} from 'node:zlib';import type {Request,Response,NextFunction} from 'express';import {existsSync} from 'node:fs';import {resolve} from 'node:path';
const zip=promisify(gzip);
/** The catalogue contains shared item data; private/session responses retain their existing no-store handling. */
export async function sendCatalog(req:Request,res:Response,items:unknown) {
  const body=JSON.stringify(items);res.vary('Accept-Encoding');res.type('application/json');
  if(body.length>2048&&req.acceptsEncodings('gzip')){const bytes=await zip(Buffer.from(body),{level:4});res.set('Content-Encoding','gzip');return res.send(bytes);}
  return res.send(body);
}
/** Only content-hashed build assets use immutable caching and optional precompressed bytes. */
export function compressedBundle(req:Request,res:Response,next:NextFunction){
  if(!['GET','HEAD'].includes(req.method)||!/^\/assets\/[A-Za-z0-9_.-]+\.(js|css)$/.test(req.path))return next();
  res.vary('Accept-Encoding');if(!req.acceptsEncodings('gzip'))return next();
  const file=resolve('dist/client','.'+req.path)+'.gz';if(!existsSync(file))return next();
  res.vary('Accept-Encoding');res.type(req.path.endsWith('.js')?'application/javascript':'text/css');res.set({'Content-Encoding':'gzip','Cache-Control':'public, max-age=31536000, immutable'});res.sendFile(file);
}

import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {RequestHandler} from 'express';
import {protectedPublicBackground} from '../shared/image-delivery-policy.js';
import {staticAssetCacheControl} from './static-asset-cache.js';

export function optimizedPublicImages(root=resolve('dist/client')):RequestHandler {
  const images=new Map<string,{file:string}>();
  try {
    const manifest=JSON.parse(readFileSync(resolve(root,'optimized-images-20261028/manifest.json'),'utf8'));
    for(const [path,entry] of Object.entries(manifest.images || {})) {
      const file=(entry as {file?:unknown})?.file;
      if(path.startsWith('/') && !protectedPublicBackground(path) && typeof file==='string' &&
        /^\/optimized-images-20261028\/[a-f0-9]{64}\.webp$/.test(file)) images.set(path,{file});
    }
  } catch { /* A release without derivatives still serves every original. */ }
  return (req,res,next)=>{
    if(!['GET','HEAD'].includes(req.method) || req.path.startsWith('/api/'))return next();
    let path:string;try{path=decodeURIComponent(req.path);}catch{return next();}
    const entry=images.get(path);if(!entry)return next();
    // Explicit format negotiation keeps originals available to downloads,
    // image-processing tools and browsers without WebP support.
    res.vary('Accept');
    if(req.query.original==='1' || !/image\/webp/i.test(req.get('Accept') || '') || !req.accepts('image/webp'))return next();
    const cache=staticAssetCacheControl(root,resolve(root,'.'+path));
    if(cache)res.set('Cache-Control',cache);
    res.type('image/webp').set('Content-Location',entry.file).sendFile(resolve(root,'.'+entry.file),error=>{
      if(error && !res.headersSent){res.removeHeader('Content-Type');res.removeHeader('Content-Location');next();}
    });
  };
}

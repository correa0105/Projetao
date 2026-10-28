import {createHash} from 'node:crypto';
import sharp from 'sharp';
import type {Request,Response} from 'express';

const cache=new Map<string,Buffer|null>(),pending=new Map<string,Promise<Buffer|null>>();
let cachedBytes=0;
const maxBytes=32*1024*1024;
/** Call only after the route's current authorization and cache headers. */
export async function sendImagePreview(req:Request,res:Response,original:Buffer) {
  res.vary('Accept');
  if(original.length<40000 || req.query.original==='1' || !/image\/webp/i.test(req.get('Accept')||'') || !req.accepts('image/webp'))return res.send(original);
  const key=createHash('sha256').update(original).digest('hex');
  let preview=cache.get(key);
  if(preview!==undefined){cache.delete(key);cache.set(key,preview);}
  else {
    let job=pending.get(key);
    if(!job && pending.size>=2)return res.send(original);
    if(!job){
      job=(async()=>{
        try{
          const image=sharp(original,{animated:true,limitInputPixels:40_000_000}),meta=await image.metadata();
          if((meta.pages||1)>1 || meta.format==='webp')return null;
          const output=await image.webp({quality:86,alphaQuality:100,effort:2}).toBuffer();
          return output.length<original.length*.85?output:null;
        }catch{return null;}
      })();
      pending.set(key,job);
    }
    try{preview=await job;}finally{if(pending.get(key)===job)pending.delete(key);}
    if(!cache.has(key)){
      while(cache.size>=128 || (preview && cachedBytes+preview.length>maxBytes)){
        const oldest=cache.keys().next().value;if(!oldest)break;
        cachedBytes-=cache.get(oldest)?.length||0;cache.delete(oldest);
      }
      if(!preview || preview.length<=maxBytes){cache.set(key,preview);cachedBytes+=preview?.length||0;}
    }
  }
  return preview ? res.type('image/webp').send(preview) : res.send(original);
}

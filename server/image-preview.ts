import {createHash} from 'node:crypto';
import sharp from 'sharp';
import type {Request,Response} from 'express';
import {vttLibraryImageSide,vttDisplayImageSide} from '../shared/vtt-image-sizes.js';

const cache=new Map<string,Buffer|null>(),pending=new Map<string,Promise<Buffer|null>>();
let cachedBytes=0;
const maxBytes=32*1024*1024;
let thumbnailWorkers=0;
const thumbnailQueue:(()=>void)[]=[];
async function thumbnailSlot(){
  if(thumbnailWorkers<2){thumbnailWorkers++;return;}
  await new Promise<void>(resolve=>thumbnailQueue.push(resolve));
}
function releaseThumbnail(){const next=thumbnailQueue.shift();if(next)next();else thumbnailWorkers--;}
/** Call only after the route's current authorization and cache headers. */
export async function sendImagePreview(req:Request,res:Response,original:Buffer) {
  res.vary('Accept');
  const thumbnail=req.query.thumbnail==='1';
  const display=!thumbnail&&req.query.display==='1',sized=thumbnail||display,side=thumbnail?vttLibraryImageSide:vttDisplayImageSide;
  if((!sized&&original.length<40000) || req.query.original==='1' || !/image\/webp/i.test(req.get('Accept')||'') || !req.accepts('image/webp'))return res.send(original);
  const key=createHash('sha256').update(original).digest('hex')+(sized?':'+(thumbnail?'thumbnail':'display')+'-'+side+'-v2':'');
  let preview=cache.get(key);
  if(preview!==undefined){cache.delete(key);cache.set(key,preview);}
  else {
    let job=pending.get(key);
    if(!job && pending.size>=(sized?16:2))return res.send(original);
    if(!job){
      job=(async()=>{
        if(sized)await thumbnailSlot();
        try{
          let image=sharp(original,{animated:!thumbnail,limitInputPixels:40_000_000});const meta=await image.metadata();
          if(!thumbnail&&(meta.pages||1)>1)return null;
          if(!sized&&meta.format==='webp')return null;
          if(sized)image=image.resize({width:side,height:side,fit:'inside',withoutEnlargement:true});
          const output=await image.webp({quality:thumbnail?60:display?78:86,alphaQuality:100,effort:2}).toBuffer();
          return output.length<original.length*.85?output:null;
        }catch{return null;}finally{if(sized)releaseThumbnail();}
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

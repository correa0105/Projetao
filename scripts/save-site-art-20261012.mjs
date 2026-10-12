import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
sharp.cache(false);
const [key,source]=process.argv.slice(2);
const spec=JSON.parse(await fs.readFile('data/site-art-plan-20261012.json')).find(p=>p.key===key);
if(!spec||!source)throw Error('Known art key and native source required');
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await fs.readFile(source),meta=await sharp(bytes).metadata();
await fs.mkdir(path.dirname(spec.output),{recursive:true});
let rendered;
if(spec.kind==='house'){
 if(!meta.hasAlpha)throw Error('Transparent source required');
 rendered=await sharp(bytes).trim({threshold:8}).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).extend({top:8,bottom:8,left:8,right:8,background:{r:0,g:0,b:0,alpha:0}}).webp({quality:95,alphaQuality:100,effort:6}).toBuffer();
}else if(spec.kind==='book-patch'){
 const patch=await sharp(bytes).resize(532,321,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let y=0;y<321;y++)for(let x=0;x<532;x++){
  const edge=Math.min(x,531-x,y,320-y);patch.data[(y*532+x)*4+3]=Math.round(255*Math.min(1,edge/14));
 }
 const input=await sharp(patch.data,{raw:patch.info}).png().toBuffer();
 rendered=await sharp('public/character-library-v1.png').composite([{input,left:1140,top:620}]).webp({quality:96,effort:6}).toBuffer();
}else rendered=await sharp(bytes).webp({quality:95,effort:6}).toBuffer();
await fs.writeFile(spec.output,rendered);
const outMeta=await sharp(rendered).metadata();
const record={...spec,source,source_sha256:hash(bytes),sha256:hash(rendered),width:outMeta.width,height:outMeta.height,generator:'built-in image_gen',normalization:spec.kind==='house'?'Alpha crop, proportional resize, clear 8px margin, WebP95; no mirroring or bitmap rotation':spec.kind==='book-patch'?'Edited crop resized to source footprint, feathered 14px edges and placed back at original coordinates; original full scene otherwise preserved':'WebP95 export'};
await fs.mkdir('data/site-art-completed-20261012',{recursive:true});
await fs.writeFile(`data/site-art-completed-20261012/${key}.json`,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({key,output:spec.output,width:outMeta.width,height:outMeta.height}));

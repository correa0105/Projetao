import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';import sharp from 'sharp';
import {protectedPublicBackground,imageDeliverySide} from '../shared/image-delivery-policy.ts';

// Explicitly authorized delivery copies. Never overwrite an original or flatten
// an animation/atlas. Delivery copies fit their use; atlas coordinates stay native.
const version='optimized-images-20261028',root=path.join('public',version);
const audit=JSON.parse(await readFile('.local/public-image-audit-20261028.json','utf8'));
await mkdir(root,{recursive:true});sharp.concurrency(1);sharp.cache({memory:48,files:12,items:48});
let manifest={version,images:{},skipped:{},summary:{}};
try{manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));}catch{}
const entries=audit.entries.filter(e=>e.size>=24000&&!e.error&&!protectedPublicBackground(e.path));
let index=0,done=0;const hash=b=>createHash('sha256').update(b).digest('hex');
async function save(){const all=Object.values(manifest.images);manifest.summary={optimized:all.length,sourceBytes:all.reduce((s,e)=>s+e.sourceBytes,0),deliveredBytes:all.reduce((s,e)=>s+e.bytes,0),protectedBackgrounds:audit.entries.filter(e=>protectedPublicBackground(e.path)).length,animatedSources:audit.summary.animated.length,atlasCoordinatesPreserved:true};await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest));}
await Promise.all(Array.from({length:5},async()=>{while(index<entries.length){const e=entries[index++];try{
 const source=await readFile(e.file),sourceSha256=hash(source),previous=manifest.images[e.path];
 if(e.pages>1){manifest.skipped[e.path]='Animated original retained';continue;}
 if(e.path.endsWith('.svg')&&/<(?:animate\w*|set|script|symbol|view)\b|@keyframes|\banimation\s*:/i.test(source.toString('utf8'))){manifest.skipped[e.path]='Animated or reusable SVG retained';continue;}
 if(e.path.endsWith('.svg')&&/(?:href|xlink:href)\s*=\s*["'](?!#|data:image\/)[^"']+/i.test(source.toString('utf8'))){manifest.skipped[e.path]='SVG with external references retained';continue;}
 const side=imageDeliverySide(e.path);
 if(previous?.sourceSha256===sourceSha256 && (!side || Math.max(previous.width,previous.height)<=side)) {try{await stat('public'+previous.file);continue;}catch{}}
 let image=sharp(source,{limitInputPixels:100_000_000});
 const original=await image.metadata();
 if(side && Math.max(original.width,original.height)>side)image=image.resize({width:side,height:side,fit:'inside',withoutEnlargement:true});
 const output=await image.webp({quality:84,alphaQuality:100,effort:3}).toBuffer();
 if(output.length>=source.length*.85){manifest.skipped[e.path]='Already compact';continue;}
 const file='/'+version+'/'+hash(output)+'.webp';await writeFile('public'+file,output);
 const meta=await sharp(output).metadata();
 manifest.images[e.path]={file,bytes:output.length,sourceBytes:source.length,sourceSha256,width:meta.width,height:meta.height,alpha:!!meta.hasAlpha};
 }catch(error){manifest.skipped[e.path]=String(error.message).slice(0,180);}finally{done++;if(done%250===0)console.log(JSON.stringify({processed:done,total:entries.length,optimized:Object.keys(manifest.images).length}));}
}}));
await save();await writeFile('.local/image-optimization-result-20261028.json',JSON.stringify(manifest.summary,null,2));console.log(JSON.stringify(manifest.summary));

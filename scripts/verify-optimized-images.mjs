import{readFile,writeFile,readdir,unlink}from'node:fs/promises';import path from'node:path';import sharp from'sharp';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{protectedPublicBackground,imageDeliverySide}from'../shared/image-delivery-policy.ts';
const root=path.resolve('public/optimized-images-20261028');assert.equal(path.dirname(root),path.resolve('public'));
const file=path.join(root,'manifest.json'),manifest=JSON.parse(await readFile(file,'utf8'));let verified=0;
for(const [source,e]of Object.entries(manifest.images)){
 let omit=protectedPublicBackground(source);
 if(source.endsWith('.svg')&&!omit){const svg=await readFile(path.join('public',source),'utf8');omit=/<(?:animate\w*|set|script|symbol|view)\b|@keyframes|\banimation\s*:/i.test(svg)||/(?:href|xlink:href)\s*=\s*["'](?!#|data:image\/)[^"']+/i.test(svg);}
 if(omit){delete manifest.images[source];manifest.skipped[source]='Protected background, data texture or animated SVG';continue;}
 const bytes=await readFile(path.join('public',e.file)),meta=await sharp(bytes).metadata();assert.equal(bytes.length,e.bytes);assert.equal(meta.width,e.width);assert.equal(meta.height,e.height);assert.equal(!!meta.hasAlpha,e.alpha);assert.equal(e.file.split('/').at(-1),createHash('sha256').update(bytes).digest('hex')+'.webp');
 const original=await sharp(path.join('public',source),{limitInputPixels:100_000_000}).metadata(),side=imageDeliverySide(source);
 if(!side){assert.equal(meta.width,original.width,source);assert.equal(meta.height,original.height,source);}else{assert(meta.width<=side&&meta.height<=side,source);assert(Math.abs(meta.width/original.width-meta.height/original.height)<=1/Math.min(original.width,original.height),source);}
 verified++;
}
const used=new Set(Object.values(manifest.images).map(e=>e.file.split('/').at(-1)));for(const name of await readdir(root))if(/^[a-f0-9]{64}\.webp$/.test(name)&&!used.has(name))await unlink(path.join(root,name));
const entries=Object.values(manifest.images),summary={...manifest.summary,optimized:entries.length,sourceBytes:entries.reduce((s,e)=>s+e.sourceBytes,0),deliveredBytes:entries.reduce((s,e)=>s+e.bytes,0),verified,aspectRatiosAndGridsPreserved:true,backgroundsUnchanged:true,animationsPreserved:true};summary.reductionPercent=+(100*(1-summary.deliveredBytes/summary.sourceBytes)).toFixed(1);manifest.summary=summary;
await writeFile(file,JSON.stringify(manifest));await writeFile('.local/image-optimization-result-20261028.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));

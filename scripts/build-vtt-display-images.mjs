import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {protectedPublicBackground,imageDeliverySide} from '../shared/image-delivery-policy.ts';
import {vttDisplayImageSide} from '../shared/vtt-image-sizes.ts';

const proofDir='.local/vtt-library-pixels-20261029',manifestFile='public/optimized-images-20261028/manifest.json';
await mkdir(proofDir,{recursive:true});
const before=await readFile(manifestFile),manifest=JSON.parse(before),images={},changes=[];
try{await stat(proofDir+'/manifest-before.json');}catch{await writeFile(proofDir+'/manifest-before.json',before);}
const hash=b=>createHash('sha256').update(b).digest('hex');
sharp.concurrency(1);sharp.cache({memory:48,files:12,items:48});
const entries=Object.entries(manifest.images).filter(([url])=>url.startsWith('/vtt/')&&!protectedPublicBackground(url)&&imageDeliverySide(url)!==null);
let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<entries.length){
 const [url,previous]=entries[next++];
 if(Math.max(previous.width,previous.height)<=vttDisplayImageSide){images[url]=previous.file;continue;}
 const source=await readFile('public'+url);assert.equal(hash(source),previous.sourceSha256,url);
 const output=await sharp(source,{limitInputPixels:100_000_000}).resize({width:vttDisplayImageSide,height:vttDisplayImageSide,fit:'inside',withoutEnlargement:true}).webp({quality:78,alphaQuality:100,effort:3}).toBuffer();
 const file='/optimized-images-20261028/'+hash(output)+'.webp',meta=await sharp(output).metadata();
 await writeFile('public'+file,output);assert.equal(hash(await readFile('public'+url)),previous.sourceSha256,url);
 const updated={...previous,file,bytes:output.length,width:meta.width,height:meta.height,alpha:!!meta.hasAlpha};
 manifest.images[url]=updated;images[url]=file;changes.push({path:url,previous,updated});
}}));
const aliases=JSON.parse(await readFile('shared/public-image-replacements-20261029.json'));
for(const [from,to]of Object.entries(aliases))if(images[to])images[from]=images[to];
await writeFile('shared/vtt-display-images.json',JSON.stringify(images,null,2)+'\n');
// Keep the original comparison when a completed build is run again.
const baseline=JSON.parse(await readFile(proofDir+'/manifest-before.json'));
changes.length=0;
for(const [url,updated]of Object.entries(manifest.images)){
 const previous=baseline.images[url];
 if(previous&&JSON.stringify(previous)!==JSON.stringify(updated)){
  assert(url.startsWith('/vtt/')&&!protectedPublicBackground(url)&&imageDeliverySide(url)!==null,url);
  assert.equal(hash(await readFile('public'+url)),updated.sourceSha256,url);
  changes.push({path:url,previous,updated});
 }
}
const all=Object.values(manifest.images);Object.assign(manifest.summary,{sourceBytes:all.reduce((s,e)=>s+e.sourceBytes,0),deliveredBytes:all.reduce((s,e)=>s+e.bytes,0)});
manifest.summary.reductionPercent=Math.round((1-manifest.summary.deliveredBytes/manifest.summary.sourceBytes)*100);
await writeFile(manifestFile,JSON.stringify(manifest));
const result={passed:true,originalsUnchanged:true,images:changes,logicalUrls:Object.keys(images).length,previousBytes:changes.reduce((s,e)=>s+e.previous.bytes,0),displayBytes:changes.reduce((s,e)=>s+e.updated.bytes,0)};
await writeFile(proofDir+'/display-images.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,images:changes.length}));

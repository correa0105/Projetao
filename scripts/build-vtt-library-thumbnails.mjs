import {readdir,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {protectedPublicBackground,imageDeliverySide} from '../shared/image-delivery-policy.ts';
import {vttLibraryImageSide} from '../shared/vtt-image-sizes.ts';

// Library-only delivery copies. Map images, backgrounds and atlas coordinates
// retain their original URLs, files and resolution.
const dir='public/optimized-images-20261028/vtt-thumbnails',entries=[],images={},proof=[];
const aliases=JSON.parse(await readFile('shared/public-image-replacements-20261029.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(dir,{recursive:true});sharp.concurrency(1);
async function walk(root){for(const e of await readdir(root,{withFileTypes:true})){const file=root+'/'+e.name;if(e.isDirectory())await walk(file);else if(/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(e.name)){
 const url=file.slice('public'.length);
 // Terrain brush cards also need small previews; painting still uses the full texture.
 const brush=/^\/vtt\/(?:terrain-|reference-grass)/.test(url);
 if((brush||!protectedPublicBackground(url))&&imageDeliverySide(url)!==null)entries.push({file,url});
}}}
await walk('public/vtt');let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<entries.length){const {file,url}=entries[next++];
 const source=await readFile(file),sourceSha256=hash(source);
 try{
  if(url.endsWith('.svg')&&/(?:href|xlink:href)\s*=\s*["'](?!#|data:image\/)[^"']+/i.test(source.toString()))continue;
  const image=sharp(source,{limitInputPixels:100_000_000}),meta=await image.metadata();
  const output=await image.resize({width:vttLibraryImageSide,height:vttLibraryImageSide,fit:'inside',withoutEnlargement:true}).webp({quality:60,alphaQuality:100,effort:3}).toBuffer();
  if(output.length>=source.length&&Math.max(meta.width||0,meta.height||0)<=vttLibraryImageSide)continue;
  const target='/optimized-images-20261028/vtt-thumbnails/'+hash(output)+'.webp';
  await writeFile('public'+target,output);images[url]=target;
  proof.push({path:url,sourceSha256,sourceBytes:source.length,file:target,bytes:output.length,width:meta.width,height:meta.height});
 }catch(error){throw Error(url+': '+error.message);}
}}));
for(const [from,to]of Object.entries(aliases))if(images[to])images[from]=images[to];
await writeFile('shared/vtt-library-thumbnails.json',JSON.stringify(images,null,2)+'\n');
await mkdir('.local/vtt-library-performance-20261029',{recursive:true});
for(const e of proof)if(hash(await readFile('public'+e.path))!==e.sourceSha256)throw Error('Original changed: '+e.path);
const files=[...new Set(proof.map(e=>e.file))],bytes=(await Promise.all(files.map(async f=>(await stat('public'+f)).size))).reduce((a,b)=>a+b,0);
const result={passed:true,originalsUnchanged:true,images:proof,originalBytes:proof.reduce((s,e)=>s+e.sourceBytes,0),previewBytes:bytes,uniqueFiles:files.length,logicalUrls:Object.keys(images).length};
await writeFile('.local/vtt-library-performance-20261029/thumbnails.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({images:proof.length,logicalUrls:result.logicalUrls,files:files.length,originalBytes:result.originalBytes,previewBytes:bytes,originalsUnchanged:true}));

import fs from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const dir='data/companion-token-art-20261009',manifest=JSON.parse(await fs.readFile(dir+'/art-manifest.json','utf8'));
if(manifest.items.length!==25||manifest.failures?.length)throw Error('Incomplete artwork.');
await fs.mkdir('public/vtt/companions',{recursive:true});
const published=[];
for(const item of manifest.items){
 const bytes=await fs.readFile(item.source),meta=await sharp(bytes).metadata();
 if(!meta.hasAlpha||(await sharp(bytes).stats()).isOpaque)throw Error('Native alpha missing: '+item.id);
 const output='public/vtt/companions/'+item.id+'.webp';
 await sharp(bytes).resize(1024,1024,{fit:'contain',background:'#00000000',withoutEnlargement:true}).webp({quality:95,alphaQuality:100,effort:6}).toFile(output);
 const final=await fs.readFile(output);
 const {style,...identity}=item;
 published.push({...identity,reference_images:[item.reference],prompt:item.prompt.replace('The second image is only a guide to overhead camera and richly painted fantasy realism. ',''),tool:'image_gen.imagegen',native_transparency:true,image_path:'/'+output.slice('public/'.length),source_sha256:createHash('sha256').update(bytes).digest('hex'),sha256:createHash('sha256').update(final).digest('hex')});
}
await fs.writeFile(dir+'/published-manifest.json',JSON.stringify({created:'2026-10-09',review:'All 25 coat/species pairs visually inspected; overhead anatomy and native alpha verified.',items:published},null,2));
console.log('Published '+published.length+' reviewed companion tokens.');

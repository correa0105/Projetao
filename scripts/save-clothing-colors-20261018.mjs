import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const input=JSON.parse(await fs.readFile(process.argv[2]||'.local/clothing-color-art-input.json','utf8'));assert.equal(input.length,32);
await fs.mkdir('public/shop/clothing-colors-20261018',{recursive:true});
const assets=[];
for(const entry of input){
 const stats=await sharp(entry.source).stats();assert(!stats.isOpaque,entry.id+' must be transparent');
 const bytes=await sharp(entry.source).resize(512,512,{fit:'inside'}).webp({quality:95,alphaQuality:100,effort:6}).toBuffer();
 const url='/shop/clothing-colors-20261018/'+entry.id+'.webp';await fs.writeFile('public'+url,bytes);
 assets.push({id:entry.id,model:entry.model,color:entry.color,label:entry.label,reference:'public/shop/clothing-20261018/'+entry.model+'.webp',prompt:entry.prompt,nativeFile:path.basename(entry.source),url,sha256:createHash('sha256').update(bytes).digest('hex')});
}
assert.equal(new Set(assets.map(x=>x.sha256)).size,32);
await fs.writeFile('data/clothing-colors-art-20261018.json',JSON.stringify({method:'built-in image_gen edits',saved:true,assets},null,2)+'\n');
const collection=JSON.parse(await fs.readFile('data/shop-clothing-colors-20261018.json','utf8'));collection.ready=true;
await fs.writeFile('data/shop-clothing-colors-20261018.json',JSON.stringify(collection,null,2)+'\n');
await fs.mkdir('.local/clothing-color-review',{recursive:true});
for(let page=0;page<2;page++){
 const entries=collection.items.slice(page*20,page*20+20),tiles=[];
 for(let i=0;i<entries.length;i++){const image=await sharp('public'+entries[i].image_path).resize(210,210,{fit:'contain',background:{r:30,g:25,b:18,alpha:1}}).png().toBuffer();tiles.push({input:image,left:(i%5)*220+5,top:Math.floor(i/5)*220+5});}
 await sharp({create:{width:1100,height:880,channels:4,background:'#1e1912'}}).composite(tiles).png().toFile('.local/clothing-color-review/page-'+page+'.png');
}
console.log(JSON.stringify({saved:assets.length,models:8,colorsPerModel:5,alpha:true}));

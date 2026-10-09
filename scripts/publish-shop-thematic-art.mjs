import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const directory='data/shop-thematic-art-20261009',manifest=JSON.parse(await fs.readFile(directory+'/art-manifest.json','utf8')),
 records=JSON.parse(await fs.readFile(directory+'/review-records.json','utf8'));
assert.equal(manifest.items.length,122);assert.equal(records.length,122);assert.equal(manifest.failures?.length||0,0);
const catalogs=['data/shop-export/loja.json','data/emporium-expansion.json','data/equipment-catalog.json'],loaded=[];
for(const file of catalogs){const original=JSON.parse(await fs.readFile(file,'utf8'));loaded.push({file,original,data:structuredClone(original)});}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),published=[];
await fs.mkdir('public/shop/thematic-20261009',{recursive:true});
for(const item of manifest.items){
 const bytes=await fs.readFile(item.source),record=records.find(r=>r.id===item.id);
 assert.equal(hash(bytes),record.source_sha256,item.id+' changed since review');
 const output='public/shop/thematic-20261009/'+item.id+'.webp',image_path='/shop/thematic-20261009/'+item.id+'.webp';
 await sharp(bytes).resize(768,768,{fit:'contain',background:'#00000000',withoutEnlargement:true}).webp({quality:95,alphaQuality:100,effort:6}).toFile(output);
 let matches=0;
 for(const catalog of loaded)for(const entry of Array.isArray(catalog.data)?catalog.data:catalog.data.items)if(entry.id===item.id){entry.image_path=image_path;matches++;}
 assert.ok(matches>0,'Catalog ID absent: '+item.id);
 published.push({...item,tool:'image_gen.imagegen',native_transparency:true,image_path,source_sha256:record.source_sha256,sha256:hash(await fs.readFile(output)),review:'All six contact sheets visually inspected; physical motifs match item tier, element or target. Outside RGB in supreme potion is fully transparent, verified against the alpha channel.'});
}
for(const catalog of loaded){
 const stripped=structuredClone(catalog.data);
 const entries=Array.isArray(stripped)?stripped:stripped.items,old=Array.isArray(catalog.original)?catalog.original:catalog.original.items;
 for(const entry of entries){const original=old.find(i=>i.id===entry.id);if(original.image_path===undefined)delete entry.image_path;else entry.image_path=original.image_path;}
 assert.deepEqual(stripped,catalog.original,'Only artwork paths may change');
 await fs.writeFile(catalog.file,JSON.stringify(catalog.data,null,2)+'\n');
}
await fs.writeFile(directory+'/published-manifest.json',JSON.stringify({date:'2026-10-09',tool:'built-in image_gen',items:published},null,2));
console.log('Published 122 distinct thematic icons. Catalog IDs, prices, rules and other fields preserved.');

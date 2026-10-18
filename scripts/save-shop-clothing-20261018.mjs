import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const assets=JSON.parse(await fs.readFile(process.argv[2]||'.local/clothing-art-input.json','utf8'));
assert.equal(assets.length,8);
await fs.mkdir('public/shop/clothing-20261018',{recursive:true});
for(const asset of assets){
 const stats=await sharp(asset.source).stats();assert(!stats.isOpaque,asset.id);
 const bytes=await sharp(asset.source).resize(512,512,{fit:'inside'}).webp({quality:95,alphaQuality:100,effort:6}).toBuffer();
 asset.url='/shop/clothing-20261018/'+asset.id+'.webp';await fs.writeFile('public'+asset.url,bytes);
 asset.sha256=createHash('sha256').update(bytes).digest('hex');asset.nativeFile=path.basename(asset.source);delete asset.source;
}
assert.equal(new Set(assets.map(a=>a.sha256)).size,8);
await fs.writeFile('data/shop-clothing-art-20261018.json',JSON.stringify({method:'built-in image_gen',assets},null,2)+'\n');
const catalog=JSON.parse(await fs.readFile('data/shop-clothing-20261018.json','utf8'));catalog.ready=true;
await fs.writeFile('data/shop-clothing-20261018.json',JSON.stringify(catalog,null,2)+'\n');console.log('Saved eight distinct transparent medieval clothing products.');

import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const sha=b=>createHash('sha256').update(b).digest('hex');
const plants=JSON.parse(await fs.readFile('shared/vtt-plants-catalog.json','utf8')),houses=JSON.parse(await fs.readFile('shared/vtt-houses-catalog.json','utf8'));
assert.equal(plants.length,25);assert.equal(houses.length,25);const hashes=new Set(),rows=[];
for(const [type,assets] of [['plants',plants],['houses',houses]])for(const asset of assets){
  const record=JSON.parse(await fs.readFile('data/vtt/'+type+'-completed-20261014/'+asset.id+'.json','utf8'));
  const source=await fs.readFile(record.source);assert.equal(sha(source),record.sourceSha256);assert.equal(record.tool,'built-in image_gen');
  const layers=type==='plants'?[record]:record.layers;
  for(const layer of layers){
    const bytes=await fs.readFile('public'+layer.image),meta=await sharp(bytes).metadata(),stats=await sharp(bytes).stats();
    assert.equal(sha(bytes),layer.sha256);assert(meta.hasAlpha&&!stats.isOpaque);assert.equal(meta.width,layer.pixelWidth);assert.equal(meta.height,layer.pixelHeight);
    assert.equal(hashes.has(layer.sha256),false,'Duplicate art');hashes.add(layer.sha256);assert(bytes.length<800000,'Asset too heavy: '+layer.image);
    if(type==='plants')assert(Math.abs(asset.width/asset.height-meta.width/meta.height)<.001);
    else {assert.equal(meta.width,1024);assert.equal(meta.height,1024);assert.equal(asset[layer.kind==='roof'?'image':'interior'],layer.image);}
    rows.push({id:asset.id,image:layer.image,bytes:bytes.length,alpha:true});
  }
}
assert.equal(rows.length,75);await fs.mkdir('test-results/vtt-nature',{recursive:true});
await fs.writeFile('test-results/vtt-nature/media.json',JSON.stringify({passed:true,plants:25,houses:25,images:75,transparent:true,originals:50,unique:true,bytes:rows.reduce((n,r)=>n+r.bytes,0),rows},null,2));
console.log('25 plants, 25 houses, 75 transparent WebPs and 50 native originals passed.');

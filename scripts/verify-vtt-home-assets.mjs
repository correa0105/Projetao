import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const furniture=JSON.parse(await fs.readFile('shared/vtt-home-furniture-catalog.json'));
const houses=JSON.parse(await fs.readFile('shared/vtt-houses-catalog.json'));
assert.equal(furniture.length,100);assert.equal(new Set(furniture.map(a=>a.name)).size,100);
assert.equal(houses.filter(a=>a.category==='Casas').length,25);
assert.equal(houses.filter(a=>a.category==='Casas vazias').length,25);
const records=await Promise.all((await fs.readdir('.local/home-generated')).map(async f=>JSON.parse(await fs.readFile('.local/home-generated/'+f))));
const active=[...furniture.map(a=>a.image),...houses.filter(a=>a.category==='Casas vazias').map(a=>a.interior)];
const manifest=[],hashes=new Set(),tiles=[];
await fs.mkdir('test-results/home-assets',{recursive:true});
for(const [i,url] of active.entries()){
 const record=records.find(r=>'/'+r.public.replace(/^public\//,'')===url);assert(record,url);
 const bytes=await fs.readFile('public'+url),native=await fs.readFile(record.native);
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let transparent=0,solid=0;for(let p=3;p<data.length;p+=4){if(data[p]===0)transparent++;if(data[p]>128)solid++;}
 assert(transparent>10&&solid>100,'Missing alpha or empty sprite: '+url);
 assert(info.width>=250&&info.height>=250,'Insufficient sprite detail: '+url);
 if(i<100){assert(!hashes.has(sha(native)),'Duplicate furniture art: '+url);hashes.add(sha(native));}
 manifest.push({...record,url,sha256:sha(bytes),nativeSha256:sha(native),width:info.width,height:info.height,transparentPixels:transparent});
 if(i<100){const a=furniture[i];const label=a.id.slice(-3)+' '+a.name;
  const tile=await sharp(bytes).resize(180,180,{fit:'contain',background:'#192128'}).extend({top:0,bottom:30,left:0,right:0,background:'#192128'}).composite([{input:Buffer.from('<svg width="180" height="210"><text x="5" y="198" fill="white" font-size="11">'+label+'</text></svg>')}]).png().toBuffer();
  tiles.push({input:tile,left:i%10*180,top:Math.floor(i/10)*210});
 }
}
await sharp({create:{width:1800,height:2100,channels:4,background:'#192128'}}).composite(tiles).png().toFile('test-results/home-assets/all-100.png');
for(const [from,to]of [[0,'first-50.png'],[1050,'second-50.png']])await sharp('test-results/home-assets/all-100.png').extract({left:0,top:from,width:1800,height:1050}).toFile('test-results/home-assets/'+to);
await fs.writeFile('data/vtt/home-assets-manifest-20261014.json',JSON.stringify({mode:'built-in',furniture:100,emptyHouses:25,assets:manifest},null,2)+'\n');
const report={passed:true,furniture:100,distinctFurniture:hashes.size,emptyHouses:25,furnishedHouses:25,transparent:true,fullResolution:true,assets:125};
await fs.writeFile('test-results/home-assets/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));

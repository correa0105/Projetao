import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import sharp from'sharp';sharp.cache(false);
const q=JSON.parse(await fs.readFile('data/vtt/overhead-prompts-20261015.json','utf8')),rows=[],hashes=new Set(),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(q.length,371);
await fs.mkdir('data/vtt/overhead-completed-20261015',{recursive:true});await fs.mkdir('test-results/overhead',{recursive:true});
for(const request of q){
 const r=JSON.parse(await fs.readFile('.local/overhead-generated/'+request.id+'.json','utf8'));assert.equal(r.saved,true,'Not completed: '+r.id);
 const source=await fs.readFile(r.native),native=await sharp(source).metadata();assert(native.hasAlpha,'Native PNG has no alpha: '+r.id);
 const bytes=await fs.readFile(r.public),meta=await sharp(bytes).metadata(),stats=await sharp(bytes).stats(),thumb=await fs.readFile(r.thumbnail),tm=await sharp(thumb).metadata();
 assert(meta.hasAlpha&&!stats.isOpaque,'Opaque art: '+r.id);assert(tm.width<=224&&tm.height<=224,r.id+' thumbnail too large');assert(bytes.length<1600000,r.id+' too heavy');
 const hash=sha(bytes);assert(!hashes.has(hash),'Duplicate art: '+r.id);hashes.add(hash);
 const raw=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let clear=0,solid=0;for(let i=3;i<raw.data.length;i+=4){if(raw.data[i]<8)clear++;if(raw.data[i]>240)solid++;}
 const total=raw.info.width*raw.info.height;assert(clear/total>.02,'No transparent margin: '+r.id);assert(solid/total>.015,'Empty art: '+r.id);
 if(r.bounds)assert(Math.abs(meta.width/meta.height-r.width/r.height)<.002,r.id+' wrong building aspect');
 let parentSourceSha256; if(r.parent){const parent=JSON.parse(await fs.readFile('.local/overhead-generated/'+r.parent+'.json','utf8'));parentSourceSha256=sha(await fs.readFile(parent.native));const pm=await sharp(await fs.readFile(parent.public)).metadata();assert.equal(meta.width,pm.width);assert.equal(meta.height,pm.height);}
 const record={parent:r.parent,parentSourceSha256,id:r.id,name:r.name,kind:r.kind,tool:'built-in image_gen',prompt:r.prompt,source:r.native,sourceSha256:sha(source),sourcePixels:{width:native.width,height:native.height},image:'/'+r.public.replace(/^public\//,''),thumbnail:'/'+r.thumbnail.replace(/^public\//,''),sha256:hash,thumbnailSha256:sha(thumb),pixelWidth:meta.width,pixelHeight:meta.height,bytes:bytes.length,clearFraction:clear/total,opaqueFraction:solid/total,legacy:request.legacy,physicalSize:{width:r.width,height:r.height}};
 await fs.writeFile('data/vtt/overhead-completed-20261015/'+r.id+'.json',JSON.stringify(record,null,2)+'\n');rows.push(record);
}
const counts={};for(const r of rows)counts[r.kind]=(counts[r.kind]||0)+1;
const report={passed:true,images:rows.length,nativeOriginals:rows.length,thumbnails:rows.length,unique:true,transparent:true,counts,bytes:rows.reduce((n,r)=>n+r.bytes,0),rows};
await fs.writeFile('test-results/overhead/media.json',JSON.stringify(report,null,2)+'\n');console.log({passed:true,images:rows.length,counts,bytes:report.bytes});

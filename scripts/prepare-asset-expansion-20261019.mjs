import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const plan = JSON.parse(await fs.readFile('data/asset-expansion-20261019.json', 'utf8'));
const partial = process.argv.includes('--partial');
const resultDir = '.local/asset-expansion-20261019/results';
const metadata = [], furniture = [], heraldry = [], scenes = [], warnings = [];
for (const planned of plan.jobs) {
  let job;
  try { job = JSON.parse(await fs.readFile(path.join(resultDir, planned.id + '.json'), 'utf8')); }
  catch (e) { if (partial && e.code === 'ENOENT') continue; throw e; }
  const source = await fs.readFile(job.source);
  const original = '.local/asset-expansion-20261019/originals/' + job.id + '.png';
  await fs.writeFile(original, source);
  const file = 'public' + job.image;
  await fs.mkdir(path.dirname(file), { recursive: true });
  let bytes, native = await sharp(source).metadata();
  if (job.transparent) {
    assert(native.hasAlpha, job.id + ': missing native transparency');
    const {data, info} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let minX=info.width, minY=info.height, maxX=-1, maxY=-1, clear=0;
    for (let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
      const alpha=data[(y*info.width+x)*4+3];
      if(alpha<8) clear++;
      if(alpha>16){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    }
    assert(clear>info.width*info.height*.03 && maxX>=minX,job.id+': invalid alpha');
    if(job.kind==='frame') {
      const center=(Math.floor(info.height/2)*info.width+Math.floor(info.width/2))*4+3;
      assert(data[center]<8,job.id+': frame center must be transparent');
    }
    if(Math.min(minX,minY,info.width-1-maxX,info.height-1-maxY)<2) warnings.push(job.id+': inspect original edge');
    const w=maxX-minX+1,h=maxY-minY+1;
    const pad=Math.max(2,Math.ceil(Math.max(w,h)*.075));
    const limit=job.kind==='house2'?1100:768;
    const alignLongAxis=job.kind==='house2' && (
      (job.height/job.width>1.3 && w/h>1.3) || (job.width/job.height>1.3 && h/w>1.3)
    );
    const cropped=await sharp(source).extract({left:minX,top:minY,width:w,height:h}).png().toBuffer();
    bytes=await sharp(cropped)
      .rotate(alignLongAxis?90:0)
      .extend({top:pad,bottom:pad,left:pad,right:pad,background:{r:0,g:0,b:0,alpha:0}})
      .resize({width:limit,height:limit,fit:'inside',withoutEnlargement:true})
      .webp({quality:95,alphaQuality:100,effort:5}).toBuffer();
  } else {
    bytes=await sharp(source).resize({width:1920,withoutEnlargement:true}).webp({quality:94,effort:5}).toBuffer();
  }
  await fs.writeFile(file,bytes);
  const m=await sharp(bytes).metadata();
  const entry={id:job.id,kind:job.kind,name:job.name,image:job.image,width:m.width,height:m.height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:path.basename(job.source),sourceSha256:createHash('sha256').update(source).digest('hex'),prompt:job.prompt};
  if(job.kind==='house2') {
    const thumbnail=job.image.replace('/expansion-20261019/','/expansion-thumbs-20261019/');
    await fs.mkdir(path.dirname('public'+thumbnail),{recursive:true});
    await sharp(bytes).resize({width:200,height:200,fit:'inside'}).webp({quality:86,alphaQuality:100}).toFile('public'+thumbnail);
    furniture.push({id:job.id,name:job.name,category:job.category,width:job.width,height:Math.round(job.width*m.height/m.width*100)/100,image:job.image,thumbnail});
  } else if(job.kind==='scene') scenes.push({id:job.key,name:job.name,image:job.image});
  else heraldry.push({kind:job.kind,id:job.key,name:job.name,image:job.image});
  metadata.push(entry);
}
await fs.writeFile('shared/house2-expansion-20261019.json',JSON.stringify(furniture,null,2)+'\n');
await fs.writeFile('shared/guild-crest-expansion-20261019.json',JSON.stringify(heraldry,null,2)+'\n');
await fs.writeFile('shared/rp-scenes-integrated-20261019.json',JSON.stringify(scenes,null,2)+'\n');
await fs.writeFile('data/asset-expansion-20261019-results.json',JSON.stringify({method:'built-in image_gen; individually generated assets; alpha-preserving WebP conversion',assets:metadata,warnings},null,2)+'\n');
if(!partial){assert.equal(furniture.length,100);assert.equal(heraldry.length,60);assert.equal(scenes.length,8);}
console.log({prepared:metadata.length,furniture:furniture.length,heraldry:heraldry.length,scenes:scenes.length,warnings});

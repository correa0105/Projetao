import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const [id,source]=process.argv.slice(2),plan=JSON.parse(await fs.readFile('data/vtt/houses-plan-20261014.json','utf8'));
const asset=plan.assets.find(a=>a.id===id);if(!asset||!source)throw Error('Expected a planned house ID and generated layer PNG.');
const bytes=await fs.readFile(source),meta=await sharp(bytes).metadata(),stats=await sharp(bytes).stats();
if(!meta.hasAlpha||stats.isOpaque||meta.width/meta.height<1.65)throw Error('Expected two separate overhead house layers on transparent alpha.');
const sources='data/vtt/houses-sources-20261014',records='data/vtt/houses-completed-20261014',directory='public/vtt/houses-20261014';
for(const folder of [sources,records,directory])await fs.mkdir(folder,{recursive:true});
await fs.writeFile(path.join(sources,id+'.png'),bytes);
const half=Math.floor(meta.width/2),layers=[];
for(const [index,kind] of ['roof','interior'].entries()){
  const crop=await sharp(bytes).extract({left:index*half,top:0,width:half,height:meta.height}).png().toBuffer();
  const cropStats=await sharp(crop).stats();if(cropStats.isOpaque)throw Error('Missing transparent margin: '+kind);
  const rect=kind==='roof'?{left:72,top:92,width:880,height:840}:{left:123,top:143,width:778,height:738};
  const layer=await sharp(crop).trim().resize({width:rect.width,height:rect.height,fit:'fill'}).png().toBuffer();
  const output=await sharp({create:{width:1024,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:layer,left:rect.left,top:rect.top}]).webp({quality:94}).toBuffer();
  const image='/vtt/houses-20261014/'+id+'-'+kind+'.webp';await fs.writeFile('public'+image,output);
  layers.push({kind,image,sha256:createHash('sha256').update(output).digest('hex'),pixelWidth:1024,pixelHeight:1024,registeredRectangle:rect});
}
const record={...asset,source:sources+'/'+id+'.png',sourceSha256:createHash('sha256').update(bytes).digest('hex'),tool:'built-in image_gen',layers};
await fs.writeFile(path.join(records,id+'.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({id,layers:2,saved:true}));

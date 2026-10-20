import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
sharp.cache(false);
async function replaceFile(from,to){
  for(let attempt=0;;attempt++){
    try{fs.renameSync(from,to);return;}
    catch(error){if(!['EBUSY','EPERM','EACCES'].includes(error.code)||attempt>=49)throw error;await new Promise(resolve=>setTimeout(resolve,100));}
  }
}
const [id,source,promptFile] = process.argv.slice(2);
const plan=JSON.parse(fs.readFileSync('data/vtt/scenery-plan-20261012.json','utf8'));
const asset=plan.find(a=>a.id===id); if(!asset) throw new Error('Unknown asset');
if(promptFile){
  const repair=JSON.parse(fs.readFileSync(promptFile,'utf8')).find(a=>a.id===id);if(!repair)throw Error('Missing repair prompt');
  asset.prompt=repair.prompt;
  asset.repaired=true;
  const record=`data/vtt/scenery-completed-20261012/${id}.json`,backup=`data/vtt/scenery-rejected-20261012/${id}-perspective-v1`;
  fs.mkdirSync('data/vtt/scenery-rejected-20261012',{recursive:true});
  if(fs.existsSync(record)&&!fs.existsSync(backup+'.json')){fs.copyFileSync(record,backup+'.json');fs.copyFileSync(`public/vtt/scenery-assets-20261012/${id}.webp`,backup+'.webp');}
}
const directory='public/vtt/scenery-assets-20261012';
fs.mkdirSync(directory,{recursive:true}); fs.mkdirSync('data/vtt/scenery-completed-20261012',{recursive:true});
const output=path.join(directory,id+'.webp');
const temporary=output+`.${process.pid}.tmp`;
fs.appendFileSync('data/vtt/scenery-generated-attempts-20261012.jsonl',JSON.stringify({id,source,prompt:asset.prompt,at:new Date().toISOString()})+'\n');
const sourceMeta=await sharp(source).metadata(),sourceStats=await sharp(source).stats();
if(!sourceMeta.hasAlpha||sourceStats.isOpaque)throw Error('Source must have genuine transparent alpha');
const buffer=await sharp(source).trim().resize({width:764,height:764,fit:'inside'}).extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}}).webp({quality:94}).toBuffer();
const meta=await sharp(buffer).metadata();
if(!meta.hasAlpha) throw new Error('Asset must have transparent alpha');
const stats=await sharp(buffer).stats();
if(stats.isOpaque) throw new Error('Asset has an opaque background');
const longest = Math.max(asset.width,asset.height);
asset.width=Math.max(.001,Number((longest*meta.width/Math.max(meta.width,meta.height)).toFixed(4)));
asset.height=Math.max(.001,Number((longest*meta.height/Math.max(meta.width,meta.height)).toFixed(4)));
fs.writeFileSync(temporary,buffer);
await replaceFile(temporary,output);
const record=`data/vtt/scenery-completed-20261012/${id}.json`;
fs.writeFileSync(record+'.tmp',JSON.stringify({...asset,source,sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex'),pixelWidth:meta.width,pixelHeight:meta.height},null,2)+'\n');
await replaceFile(record+'.tmp',record);
console.log(JSON.stringify({id,width:meta.width,height:meta.height}));

import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
sharp.cache(false);
const [id,source,promptFile]=process.argv.slice(2);
const plan=JSON.parse(fs.readFileSync('data/vtt/scenery-v2-plan-20261012.json'));
const asset=plan.find(a=>a.id===id);if(!asset)throw Error('Unknown v2 asset');
if(promptFile){const repair=JSON.parse(fs.readFileSync(promptFile)).find(a=>a.id===id);if(!repair)throw Error('Missing repair prompt');asset.prompt=repair.prompt;asset.repaired=true;}
const sourceMeta=await sharp(source).metadata(),sourceStats=await sharp(source).stats();
if(!sourceMeta.hasAlpha||sourceStats.isOpaque)throw Error('Genuine transparent source required');
const directory='public/vtt/scenery-v2-20261012',records='data/vtt/scenery-v2-completed-20261012';
fs.mkdirSync(directory,{recursive:true});fs.mkdirSync(records,{recursive:true});
const buffer=await sharp(source).trim().resize({width:764,height:764,fit:'inside'}).extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}}).webp({quality:94}).toBuffer();
const meta=await sharp(buffer).metadata();const longest=Math.max(asset.width,asset.height);
const image='/vtt/scenery-v2-20261012/'+id+'.webp';
const record={...asset,width:Number((longest*meta.width/Math.max(meta.width,meta.height)).toFixed(4)),height:Number((longest*meta.height/Math.max(meta.width,meta.height)).toFixed(4)),image,source,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),pixelWidth:meta.width,pixelHeight:meta.height};
async function replace(from,to){for(let i=0;;i++){try{fs.renameSync(from,to);return;}catch(e){if(i>=49||!['EBUSY','EPERM','EACCES'].includes(e.code))throw e;await new Promise(r=>setTimeout(r,100));}}}
fs.writeFileSync(directory+'/'+id+'.tmp',buffer);await replace(directory+'/'+id+'.tmp','public'+image);
fs.writeFileSync(records+'/'+id+'.tmp',JSON.stringify(record,null,2)+'\n');await replace(records+'/'+id+'.tmp',records+'/'+id+'.json');
console.log(JSON.stringify({id,width:meta.width,height:meta.height}));

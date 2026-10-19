import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {guildFacilities} from '../shared/guild-facilities.ts';
import {guildFloorScale} from '../shared/guild-floor.ts';
const inputs=JSON.parse(await fs.readFile(process.argv[2],'utf8')),assets=[];
await fs.mkdir('public/guild/facilities-20261019',{recursive:true});
for(const input of inputs){
 const native=await fs.readFile(input.source),bytes=await sharp(native).trim({background:'#00000000',threshold:1}).resize({width:900,height:900,fit:'inside',withoutEnlargement:true}).webp({quality:92}).toBuffer();
 if((await sharp(bytes).stats()).isOpaque)throw Error('Missing alpha '+input.id);
 await fs.writeFile('public'+input.url,bytes);
 const facility=guildFacilities.find(f=>f.room===input.id),width=Math.round(facility.scale*guildFloorScale(facility.y,input.id)*836),item=await sharp(bytes).resize({width}).png().toBuffer(),size=await sharp(item).metadata();
 await sharp('public'+input.room).resize(836,470).composite([{input:item,left:Math.round(facility.x*836-width/2),top:Math.round(facility.y*470-size.height)}]).png().toFile('.local/guild-refit-'+input.id+'.png');
 assets.push({...input,source:path.basename(input.source),sha256:createHash('sha256').update(bytes).digest('hex'),nativeSha256:createHash('sha256').update(native).digest('hex')});
}
await fs.writeFile('data/guild-facility-refit-20261019.json',JSON.stringify({generator:'built-in image_gen',assets},null,2)+'\n');
await sharp({create:{width:1672,height:1880,channels:4,background:'#17130f'}}).composite(assets.map((asset,i)=>({input:'.local/guild-refit-'+asset.id+'.png',left:i%2*836,top:Math.floor(i/2)*470}))).png().toFile('.local/guild-refit-review.png');
console.log('Eight room-specific props and composition previews prepared.');

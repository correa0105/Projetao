import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const inputs=JSON.parse(await fs.readFile(process.argv[2],'utf8')),assets=[];
await fs.mkdir('public/sheet/icons-20261019',{recursive:true});
for(const input of inputs){const native=await fs.readFile(input.source),bytes=await sharp(native).trim({background:'#00000000',threshold:1}).resize(256,256,{fit:'contain',background:'#00000000'}).webp({quality:94}).toBuffer();if((await sharp(bytes).stats()).isOpaque)throw Error('Missing alpha '+input.id);await fs.writeFile('public'+input.url,bytes);assets.push({...input,source:path.basename(input.source),sha256:createHash('sha256').update(bytes).digest('hex'),nativeSha256:createHash('sha256').update(native).digest('hex')});}
await fs.writeFile('data/sheet-icons-20261019.json',JSON.stringify({generator:'built-in image_gen',assets},null,2)+'\n');
await sharp({create:{width:1280,height:256,channels:4,background:'#191610'}}).composite(assets.map((asset,i)=>({input:'public'+asset.url,left:i*256,top:0}))).png().toFile('.local/sheet-icons-review.png');console.log('Prepared five realistic character sheet icons.');

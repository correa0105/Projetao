import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const dir='data/companion-token-art-20261009',manifest=JSON.parse(await fs.readFile(dir+'/art-manifest.json','utf8'));
if(manifest.items.length!==25||manifest.failures?.length)throw Error('Incomplete native generation.');
const composites=[],metadata=[];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for(const [i,item]of manifest.items.entries()){
 const source=await fs.readFile(item.source),meta=await sharp(source).metadata(),stats=await sharp(source).stats();
 if(!meta.hasAlpha||stats.isOpaque)throw Error('Native transparency missing: '+item.id);
 const x=(i%5)*300,y=Math.floor(i/5)*194;
 for(const [n,file]of [item.reference,item.source].entries())composites.push({input:await sharp(file).resize(140,155,{fit:'contain',background:'#00000000'}).png().toBuffer(),left:x+n*146,top:y});
 const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="36"><text x="5" y="14" font-family="Arial" font-size="12" fill="#f4e5c5">${escape(item.label)}</text><text x="5" y="30" font-family="Arial" font-size="10" fill="#9badb1">Loja / Token visto de cima</text></svg>`);
 composites.push({input:label,left:x,top:y+157});
 metadata.push({id:item.id,width:meta.width,height:meta.height,source_sha256:createHash('sha256').update(source).digest('hex'),transparent:true});
}
await sharp({create:{width:1500,height:970,channels:4,background:'#222a2b'}}).composite(composites).png().toFile(dir+'/token-review-contact.png');
await fs.writeFile(dir+'/native-qa.json',JSON.stringify(metadata,null,2));
console.log(path.resolve(dir+'/token-review-contact.png'));

import fs from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const directory='data/shop-thematic-art-20261009',manifest=JSON.parse(await fs.readFile(directory+'/art-manifest.json','utf8'));
if(manifest.items.length!==122||manifest.failures?.length)throw Error('Incomplete native artwork');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const records=[];
for(let start=0;start<manifest.items.length;start+=24){
 const group=manifest.items.slice(start,start+24),layers=[],labels=[];
 for(const [i,item] of group.entries()){
  const bytes=await fs.readFile(item.source),meta=await sharp(bytes).metadata(),stats=await sharp(bytes).stats();
  if(!meta.hasAlpha||stats.isOpaque)throw Error('Native alpha absent: '+item.id);
  const left=(i%6)*220,top=Math.floor(i/6)*238;
  const thumb=await sharp(bytes).resize(206,190,{fit:'contain',background:'#00000000'}).png().toBuffer();
  layers.push({input:thumb,left:left+7,top:top+5});
  const words=item.id.replaceAll('-',' '),parts=words.match(/.{1,31}(?:\s|$)|.{1,31}/g)||[words];
  labels.push(...parts.slice(0,3).map((s,k)=>`<text x="${left+110}" y="${top+208+k*13}" text-anchor="middle" fill="#e1d3b5" font-family="Arial" font-size="11">${esc(s.trim())}</text>`));
  records.push({id:item.id,source:item.source,source_sha256:createHash('sha256').update(bytes).digest('hex'),width:meta.width,height:meta.height,native_alpha:true,review:'pending'});
 }
 layers.push({input:Buffer.from(`<svg width="1320" height="952">${labels.join('')}</svg>`),left:0,top:0});
 const output=directory+`/review-${Math.floor(start/24)+1}.png`;
 await sharp({create:{width:1320,height:952,channels:4,background:'#23251fff'}}).composite(layers).png().toFile(output);
 console.log(output);
}
await fs.writeFile(directory+'/review-records.json',JSON.stringify(records,null,2));

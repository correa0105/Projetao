import fs from 'node:fs';
import sharp from 'sharp';
const ids=['grass','earth','sand','stone','wood','snow'],pieces=[];
for(let i=0;i<ids.length;i++){
 const id=ids[i],tile=await sharp('public/vtt/scenery-v2-20261012/terrain-'+id+'.webp').resize(192,192).png().toBuffer();
 const x=(i%3)*592,y=Math.floor(i/3)*610;
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)pieces.push({input:tile,left:x+8+col*192,top:y+8+row*192});
 pieces.push({input:Buffer.from(`<svg width="592" height="24"><text x="8" y="18" font-family="Arial" font-size="16" fill="white">${id} · 3 × 3</text></svg>`),left:x,top:y+582});
}
const output='data/vtt/terrain-v2-tiling-review-20261012.png';
await sharp({create:{width:1776,height:1220,channels:4,background:'#20281e'}}).composite(pieces).png().toFile(output);
console.log(output);

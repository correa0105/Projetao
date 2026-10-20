import fs from 'node:fs';
import sharp from 'sharp';
const pending=process.argv[2]==='pending';
const start=pending?0:Number(process.argv[2]||0),count=Number(process.argv[3]||40);
const reviewedFile='data/vtt/scenery-v2-reviewed-20261012.json';
const reviewed=fs.existsSync(reviewedFile)?JSON.parse(fs.readFileSync(reviewedFile,'utf8')):[];
const repairs=JSON.parse(fs.readFileSync('data/vtt/scenery-v2-pending-repairs-20261012.json'));
const records=fs.readdirSync('data/vtt/scenery-v2-completed-20261012').filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(fs.readFileSync('data/vtt/scenery-v2-completed-20261012/'+f,'utf8'))).filter(a=>!pending||(!repairs.includes(a.id)||a.repaired)&&!reviewed.some(r=>r.id===a.id&&r.sha256===a.sha256)).slice(start,start+count);
const columns=8,cell=210,rows=Math.max(1,Math.ceil(records.length/columns));
const pieces=[];
for(let i=0;i<records.length;i++){
  const a=records[i],x=(i%columns)*cell,y=Math.floor(i/columns)*cell;
  pieces.push({input:await sharp('public'+a.image).resize(196,178,{fit:'contain',background:'#333d2d'}).png().toBuffer(),left:x+7,top:y+4});
  const label=(a.id+' · '+a.category).replaceAll('&','&amp;').replaceAll('<','&lt;');
  pieces.push({input:Buffer.from(`<svg width="210" height="24"><text x="7" y="16" font-family="Arial" font-size="12" fill="#f1e8cb">${label}</text></svg>`),left:x,top:y+183});
}
const output=`data/vtt/scenery-v2-review-${pending?'pending-'+Date.now():String(start).padStart(4,'0')}.png`;
await sharp({create:{width:columns*cell,height:rows*cell,channels:4,background:'#20281e'}}).composite(pieces).png().toFile(output);
fs.writeFileSync(output.replace('.png','.json'),JSON.stringify(records.map(a=>({id:a.id,name:a.name,sha256:a.sha256})),null,2)+'\n');
console.log(JSON.stringify({output,count:records.length}));

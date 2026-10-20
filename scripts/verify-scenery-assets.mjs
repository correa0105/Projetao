import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
sharp.cache(false);
const catalog=JSON.parse(fs.readFileSync('shared/vtt-scenery-catalog.json'));
const plan=JSON.parse(fs.readFileSync('data/vtt/scenery-v2-plan-20261012.json'));
const reviews=JSON.parse(fs.readFileSync('data/vtt/scenery-v2-reviewed-20261012.json'));
const hashes=new Set(),ids=new Set(),categories={},errors=[];
for(const a of catalog){
 if(!plan.some(p=>p.id===a.id&&p.category===a.category))errors.push(a.id+': not a new planned asset');
 if(ids.has(a.id))errors.push(a.id+': duplicate ID');ids.add(a.id);
 const file='public'+a.image,bytes=fs.readFileSync(file),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(hashes.has(hash))errors.push(a.id+': duplicate image');hashes.add(hash);
 if(!reviews.some(r=>r.id===a.id&&r.sha256===hash))errors.push(a.id+': pending visual review');
 const record=JSON.parse(fs.readFileSync('data/vtt/scenery-v2-completed-20261012/'+a.id+'.json'));
 if(record.sha256!==hash)errors.push(a.id+': provenance hash mismatch');
 const meta=await sharp(bytes).metadata(),stats=await sharp(bytes).stats();
 if(!meta.hasAlpha||stats.isOpaque)errors.push(a.id+': invalid transparency');
 if(Math.abs(a.width/a.height-meta.width/meta.height)/(meta.width/meta.height)>.04)errors.push(a.id+': distorted proportions');
 categories[a.category]=(categories[a.category]||0)+1;
}
const expected=Number(process.argv[2]||250);
if(catalog.length!==expected)errors.push(`Expected ${expected}, available ${catalog.length}`);
if(expected===250)for(const category of new Set(plan.map(a=>a.category)))if(categories[category]!==25)errors.push(category+': expected 25 assets');
const pending=JSON.parse(fs.readFileSync('data/vtt/scenery-v2-pending-repairs-20261012.json'));if(pending.length)errors.push('Pending corrections: '+pending.join(', '));
const terrainReviews=JSON.parse(fs.readFileSync('data/vtt/terrain-v2-reviewed-20261012.json'));
for(const id of ['grass','earth','sand','stone','wood','snow']){
 const record=JSON.parse(fs.readFileSync('data/vtt/terrain-v2-completed-20261012/'+id+'.json'));
 const bytes=fs.readFileSync('public'+record.image),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const meta=await sharp(bytes).metadata();
 if(meta.width!==768||meta.height!==768||meta.hasAlpha)errors.push(id+': invalid ground texture');
 if(hash!==record.sha256||!terrainReviews.some(r=>r.id===id&&r.sha256===hash))errors.push(id+': unreviewed ground texture');
 if(hashes.has(hash))errors.push(id+': duplicate texture');hashes.add(hash);
}
const result={expected,available:catalog.length,reviewed:reviews.length,categories,errors};
fs.writeFileSync('data/vtt/scenery-v2-validation-20261012.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));if(errors.length)process.exitCode=1;

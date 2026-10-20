import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifests = [
  {file:'data/class-level-badges-v2-20261019.json', size:384, result:a=>'.local/badge-art-v2-result-'+a.id+'-'+a.tier+'.json'},
  {file:'data/training-badges-20261019.json', size:256, result:a=>'.local/training-art-result-'+a.id+'.json'},
];
let expected=0, saved=0;
for(const group of manifests) {
  const manifest=JSON.parse(await fs.readFile(group.file,'utf8'));
  for(const asset of manifest.assets) {
    expected++;
    const replacementFile=group.file.includes('class-level')?'.local/badge-art-replacement-'+asset.id+'-'+asset.tier+'.json':'.local/training-art-replacement-'+asset.id+'.json';
    const replacement=JSON.parse(await fs.readFile(replacementFile,'utf8').catch(()=>'{"nativePath":null}'));
    const result=replacement.nativePath?replacement:JSON.parse(await fs.readFile(group.result(asset),'utf8').catch(()=>'{"nativePath":null}'));
    if(replacement.prompt){asset.originalPrompt??=asset.prompt;asset.prompt=replacement.prompt;asset.replacesNativePath??=asset.nativePath;}
    const source=result.nativePath||asset.nativePath;
    if(!source)continue;
    const original=await fs.readFile(source), sourceHash=hash(original), target='public'+asset.url;
    let output;
    if(asset.sha256 && asset.sourceSha256===sourceHash) {
      output=await fs.readFile(target);assert.equal(hash(output),asset.sha256);
    } else {
      const trimmed=await sharp(original).trim({threshold:1}).toBuffer();
      const inner=Math.round(group.size*.46)*2;
      output=await sharp(trimmed).resize(inner,inner,{fit:'contain',background:'#00000000'})
        .extend({top:(group.size-inner)/2,bottom:(group.size-inner)/2,left:(group.size-inner)/2,right:(group.size-inner)/2,background:'#00000000'})
        .webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
      await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,output);
    }
    const {data,info}=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let empty=0,solid=0;
    for(let i=3;i<data.length;i+=4){if(data[i]===0)empty++;if(data[i]>=240)solid++;}
    assert(empty/(info.width*info.height)>.1,'Real transparency required: '+target);
    assert(solid/(info.width*info.height)>.1,'Solid illustrated subject required: '+target);
    assert.equal(info.width,group.size);assert.equal(info.height,group.size);
    Object.assign(asset,{nativePath:source,sourceSha256:sourceHash,sha256:hash(output),bytes:output.length,width:info.width,height:info.height,transparentFraction:empty/(info.width*info.height)});
    saved++;
  }
  manifest.ready=manifest.assets.every(a=>a.sha256);
  await fs.writeFile(group.file,JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({saved,expected,ready:saved===expected}));
if(process.argv.includes('--require-complete'))assert.equal(saved,expected,'Finish every planned illustration before release');

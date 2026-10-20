import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';import assert from 'node:assert/strict';import {createHash}from'node:crypto';
const file='data/vtt/monster-test-cards-20261019.json',manifest=JSON.parse(await fs.readFile(file));
let saved=0;for(const a of manifest.assets)for(const kind of ['body','token']){
const result=JSON.parse(await fs.readFile('.local/monster-test-art-'+a.id+'-'+kind+'.json').catch(()=>'{"nativePath":null}'));if(!result.nativePath)continue;
const original=await fs.readFile(result.nativePath),size=kind==='body'?900:640;
const output=await sharp(original).resize(size,size,{fit:'contain',background:'#00000000'}).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
const{data,info}=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});let empty=0,soft=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)empty++;if(data[i]>0&&data[i]<240)soft++;}assert(empty/(size*size)>.08,a.id+' alpha');assert.equal(info.width,size);assert.equal(info.height,size);
const target='public'+a[kind+'Url'];await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,output);
a[kind]={...result,reference:result.reference||manifest.styleReference,prompt:result.prompt||a.prompt,sourceSha256:createHash('sha256').update(original).digest('hex'),sha256:createHash('sha256').update(output).digest('hex'),width:size,height:size,bytes:output.length,transparentFraction:empty/(size*size),softAlphaPixels:soft};saved++;
}
manifest.ready=saved===8;await fs.writeFile(file,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({saved,ready:manifest.ready}));if(process.argv.includes('--require-complete'))assert.equal(saved,8);

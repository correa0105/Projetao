import fs from 'node:fs/promises';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import sharp from 'sharp';
import{GuildCrest,crestNames}from'../src/GuildCrest';import{crestSchema}from'../shared/guilds';import{additionalCrestIcons,additionalCrestFields,additionalCrestOrnaments}from'../shared/guild-crest-options';
sharp.cache(false);await fs.mkdir('test-results/community',{recursive:true});
const base=crestSchema.parse({}),icons=crestSchema.shape.icon.removeDefault().options,fields=crestSchema.shape.field.removeDefault().options,rims=crestSchema.shape.ornament.removeDefault().options,shapes=crestSchema.shape.border.removeDefault().options;
assert.equal(additionalCrestIcons.length,25);assert.equal(additionalCrestFields.length,10);assert.equal(additionalCrestOrnaments.length,10);
let count=0;
async function sheet(name:string,items:{label:string;values:object}[],columns:number){const cell=174,h=192,parts:any[]=[];
 for(const [i,item]of items.entries()){
  const crest=crestSchema.parse({...base,...item.values});let svg=renderToStaticMarkup(<GuildCrest crest={crest} size={156}/>);
  assert(svg.includes('data-crest-layer="rim"'));assert(svg.includes('scale(.84)'));assert(!svg.includes('stroke-width="0.6"'));
  const img=await sharp(Buffer.from(svg)).resize(156,156).png().toBuffer();parts.push({input:img,left:i%columns*cell+9,top:Math.floor(i/columns)*h+4});
  const text=Buffer.from(`<svg width="${cell}" height="30"><text x="${cell/2}" y="17" text-anchor="middle" font-family="Arial" font-size="11" fill="#e7d2a7">${item.label}</text></svg>`);parts.push({input:text,left:i%columns*cell,top:Math.floor(i/columns)*h+160});count++;
 }
 await fs.writeFile('test-results/community/'+name+'.png',await sharp({create:{width:columns*cell,height:Math.ceil(items.length/columns)*h,channels:4,background:'#171814'}}).composite(parts).png().toBuffer());
}
await sheet('crest-symbols',icons.map(icon=>({label:crestNames[icon],values:{icon,ornament:'beveled',field:'plain'}})),7);
await sheet('crest-fields',fields.flatMap(field=>['shield','round'].map(border=>({label:crestNames[field]+' · '+crestNames[border],values:{field,border,ornament:'beveled'}}))),8);
await sheet('crest-borders',rims.flatMap(ornament=>['shield','round'].map(border=>({label:crestNames[ornament]+' · '+crestNames[border],values:{ornament,border}}))),8);
for(const border of shapes)for(const field of fields)for(const ornament of rims)crestSchema.parse({...base,border,field,ornament,icon:'griffin'});
// Check that every field stays inside its inset clip, for all six legacy shapes.
for(const border of shapes){
 const values={...base,border,field:'plain',fieldColor:'#e82d32',fieldColor2:'#294de5',iconColor:'#43b985',ornament:'beveled'};
 const original=renderToStaticMarkup(<GuildCrest crest={values as any} size={180}/>);
 const clip=original.match(/<clipPath[^>]*>(.*?)<\/clipPath>/)?.[1];assert(clip,'Missing field clip');
 const mask=await sharp(Buffer.from('<svg width="180" height="194" viewBox="-10 -10 120 130">'+clip!.replace('<path ','<path fill="white" ')+'</svg>')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const before=await sharp(Buffer.from(original)).ensureAlpha().raw().toBuffer();
 for(const field of fields){const svg=renderToStaticMarkup(<GuildCrest crest={{...values,field} as any} size={180}/>),after=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  for(let i=0;i<before.length;i+=4)if(mask.data[i+3]===0)assert.deepEqual(after.subarray(i,i+4),before.subarray(i,i+4),border+' / '+field+' paints on the rim');
 }
}
await fs.writeFile('test-results/community/crest-validation.json',JSON.stringify({passed:true,icons:icons.length,fields:fields.length,borders:rims.length,shapes:shapes.length,rendered:count,validated:shapes.length*fields.length*rims.length,fieldRimPixelChecks:shapes.length*fields.length},null,2));console.log({passed:true,count});

// Extend the existing native material-skin library without rewriting old art.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir='data/shop-magic-completion-20261009';
const recipes=JSON.parse(await fs.readFile(dir+'/variant-recipes.json'));
const manifest=JSON.parse(await fs.readFile(dir+'/art-manifest.json'));
const candidates=new Map(JSON.parse(await fs.readFile(dir+'/candidates.json')).items.map(x=>[x.id,x]));
const oldIds=new Set([...JSON.parse(await fs.readFile('data/shop-export/loja.json')).items,...JSON.parse(await fs.readFile('data/emporium-expansion.json')).items].map(x=>x.id));
const cache=new Map();
async function image(url,size,requireAlpha=false){
 assert(/^\/shop\/[a-zA-Z0-9/_-]+\.(png|webp)$/.test(url),'Unsafe reference: '+url);
 const key=url+size;
 if(!cache.has(key)){
  const bytes=await sharp('public'+url).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();
  const {width,height,hasAlpha}=await sharp(bytes).metadata();
  if(requireAlpha)assert(hasAlpha,'Physical reference needs alpha');
  cache.set(key,{href:'data:image/png;base64,'+bytes.toString('base64'),width,height});
 }
 return cache.get(key);
}
for(const r of recipes){
 assert(candidates.has(r.id)&&!oldIds.has(r.id),'Only new concrete candidates may receive skins');
 const existing=manifest.assets.find(x=>x.id===r.id);
 if(existing?.review==='approved')continue;
 const base=await image(r.reference,512,true),tex=await image(r.texture,256);
 const color=r.color,bonus=r.enhancement||0,decoration=r.decoration_tier??bonus,w=base.width+32,h=base.height+32;
 assert(Number.isInteger(decoration)&&decoration>=0&&decoration<=8,'Reviewed decoration density required');
 const seed=parseInt(createHash('sha256').update(r.family).digest('hex').slice(0,5),16)%47+1;
 const definition=`<image id="model" href="${base.href}" x="16" y="16" width="${base.width}" height="${base.height}"/>`;
 const model='<use href="#model"/>';
 // Etched bands and the visible number of small diamonds distinguish tiers.
 const etched=Array.from({length:5+decoration*2},(_,i)=>{
  const y=16+((i+1)*base.height)/(6+decoration*2),x=16+base.width*.42;
  return `<path d="M16 ${y}H${x}l8 -6 8 12 8 -6H${w-16}"/>`;
 }).join('');
 const diamonds=Array.from({length:decoration},(_,i)=>{
  const x=w/2+(i-(decoration-1)/2)*22,y=h*.44;
  return `<path d="M${x} ${y-12}l6 12 -6 12 -6 -12Z"/>`;
 }).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${definition}<mask id="shape" mask-type="alpha">${model}</mask><filter id="aura" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${r.glow}" result="blur"/><feFlood flood-color="${color}" flood-opacity=".4"/><feComposite in2="blur" operator="in"/></filter><filter id="material"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="2" seed="${seed}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="${r.material==='flame'?10:0}" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#aura)">${model}</g>${model}<g mask="url(#shape)"><image href="${tex.href}" x="16" y="16" width="${base.width}" height="${base.height}" preserveAspectRatio="xMidYMid slice" opacity="${r.opacity}" filter="url(#material)"/><g fill="none" stroke="${color}" stroke-width=".8" opacity=".45">${etched}</g><g fill="none" stroke="${color}" stroke-width="1.8" opacity=".85">${diamonds}</g></g></svg>\n`;
 const dest=`/shop/magic-completion-20261009/${r.id}.svg`;
 await fs.writeFile('public'+dest,svg);
 const a={id:r.id,path:dest,mode:'native SVG material skin',reference:r.reference,texture:r.texture,physical_model:r.model,family:r.family,enhancement:bonus,...(r.spell_level!=null?{spell_level:r.spell_level,decoration_tier:decoration}:{}),width:w,height:h,sha256:createHash('sha256').update(svg).digest('hex'),review:'pending visual review'};
 assert(!manifest.assets.some(x=>x.id!==r.id&&x.sha256===a.sha256),'Repeated image');
 manifest.assets=manifest.assets.filter(x=>x.id!==r.id);
 manifest.assets.push(a);
}
await fs.writeFile(dir+'/art-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared original material skins for',recipes.length,'new concrete forms; existing approved art preserved.');

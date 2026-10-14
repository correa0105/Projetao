import sharp from 'sharp';
import {build} from 'esbuild';import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const bundle=await build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import{CardFace}from'./src/Cards';import{cards}from'./shared/cards';createRoot(document.getElementById('deck')).render(React.createElement(React.Fragment,null,...[1,2,3].flatMap(level=>cards.map(card=>React.createElement(CardFace,{key:card.id+level,card,level})))));",resolveDir:process.cwd()},outfile:'qa.js',external:['/cards/*','/achievement-wood-v1.png'],bundle:true,write:false,platform:'browser',format:'iife'});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('http://127.0.0.1:3071/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/'){await route.fulfill({contentType:'text/html',body:'<div id="deck" style="display:grid;grid-template-columns:repeat(8,100px);gap:10px"></div>'});return;}if(/^\/cards\/tarot-symbolic-20261013\/[a-z]+-[12]\.webp$/.test(url.pathname)){await route.fulfill({contentType:'image/webp',body:await fs.readFile('public'+url.pathname)});return;}await route.fulfill({status:404});});
 await page.goto('http://127.0.0.1:3071/');await page.addStyleTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.css')).text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});await page.waitForSelector('.arcana-card-face');assert.deepEqual(errors,[]);
 const faces=await page.locator('.arcana-card-face').evaluateAll(els=>els.map(el=>({level:Number(el.dataset.level),rarity:el.dataset.rarity,ink:getComputedStyle(el).getPropertyValue('--card-frame-ink'),paths:[...el.querySelectorAll('.arcana-card-frame path')].map(p=>p.getAttribute('d')),foil:!!el.querySelector('.arcana-card-metallic'),text:el.textContent,animation:getComputedStyle(el).animationName})));
 assert.equal(faces.length,24);for(const face of faces){assert.deepEqual(face.paths,faces[0].paths);assert.equal(face.foil,face.level===3);assert.equal(face.animation,'none');assert(!/Comum|Incomum|Rara|Lendária/.test(face.text));}
 for(const level of [1,2,3])assert.equal(new Set(faces.filter(f=>f.level===level).map(f=>f.ink)).size,1);
 assert.equal(await page.locator('.arcana-card-effects').count(),0);
 for(const face of await page.locator('.arcana-card-face[data-level="1"]').all()){await face.hover();assert.equal(await face.evaluate(el=>getComputedStyle(el).outlineStyle),'none');}
 const silver=[];
 for(const face of await page.locator('.arcana-card-face[data-level="3"]').all()){
   const shot=await face.screenshot(),render=await sharp(shot).removeAlpha().raw().toBuffer({resolveWithObject:true});
   const url=await face.locator('.arcana-card-art').evaluate(el=>getComputedStyle(el).backgroundImage.slice(5,-2));
   const original=await sharp('public'+new URL(url).pathname).resize(render.info.width,render.info.height,{fit:'fill'}).removeAlpha().raw().toBuffer();
   const backgrounds=[],ink=[];
   for(let y=Math.floor(render.info.height*.12);y<render.info.height*.8;y++)for(let x=Math.floor(render.info.width*.15);x<render.info.width*.85;x++){
     const p=(y*render.info.width+x)*3,rgb=[...original.subarray(p,p+3)],value=rgb.reduce((a,b)=>a+b)/3,luminance=[...render.data.subarray(p,p+3)].reduce((a,b)=>a+b)/3;
     if(value>=30&&value<=70&&Math.max(...rgb)-Math.min(...rgb)<7)backgrounds.push(luminance);
     if(value<15)ink.push(luminance);
   }
   const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
   assert(backgrounds.length>80);assert(mean(backgrounds)>145,'Chrome paper must be silver: '+mean(backgrounds));
   if(ink.length>80)assert(mean(ink)<100,'Black engraved strokes must stay readable');
   silver.push({name:await face.locator('.arcana-card-name').textContent(),background:mean(backgrounds),ink:mean(ink),samples:backgrounds.length});
 }
 assert.equal(await page.locator('.arcana-card-face[data-level="1"] .card-material-defs,.arcana-card-face[data-level="2"] .card-material-defs').count(),0);
 await fs.writeFile('test-results/tarot-art/silver-background.json',JSON.stringify({passed:true,chromeOnly:true,silver},null,2));
 await page.emulateMedia({reducedMotion:'reduce'});assert(await page.locator('.arcana-card-face,.arcana-card-metallic').evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==='none')));
 await fs.mkdir('test-results/tarot-art',{recursive:true});
 await page.screenshot({path:'test-results/tarot-art/finishes-final.png',fullPage:true});
 await fs.writeFile('test-results/tarot-art/rarity-effects.json',JSON.stringify({passed:true,sharedFrame:true,noGreenOutlines:true,threeFinishes:true,noContinuousAnimation:true,faces},null,2));console.log('Shared frame, no green outlines and three static finishes passed.');
}finally{await browser.close();}

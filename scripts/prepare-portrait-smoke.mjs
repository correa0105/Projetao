import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const source='C:/Users/limaw/.codex/generated_images/01a10677-429a-7d71-8bb4-fdfa42c38a62/exec-b0aeb6d3-4a29-4439-9f18-27c70c174f72.png';
const stats=await sharp(source).stats();if(stats.isOpaque)throw Error('Native transparent smoke required');
await mkdir('public/vtt/effects',{recursive:true});
await sharp(source).resize(512,512).webp({quality:95,alphaQuality:100}).toFile('public/vtt/effects/portrait-smoke-v1.webp');
await writeFile('data/vtt/portrait-smoke-20261009.json',JSON.stringify({tool:'built-in image_gen',date:'2026-10-09',source,asset:'/vtt/effects/portrait-smoke-v1.webp',description:'Original realistic silver-gray volumetric smoke framing a transparent bust-shaped opening. No character, face, background or text. Native alpha retained; technical resize only.'},null,2));
console.log('Prepared native-alpha portrait smoke texture.');

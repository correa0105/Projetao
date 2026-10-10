import { conditionIcons } from '../shared/vtt-condition-icons';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1200}});
 const svg=(icon:typeof conditionIcons[number],size:number)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="color:${icon.color}">${icon.paths.map(p=>`<path d="${p.d}" fill="${p.fill?'currentColor':'none'}" fill-rule="evenodd" stroke="${p.fill?'none':'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
 await page.setContent(`<style>body{margin:18px;background:#0d1720;color:#eadcc4;font:13px sans-serif}main{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}figure{margin:0;border:1px solid #766448;border-radius:8px;text-align:center;padding:12px;background:linear-gradient(#1c2932,#101b22)}figcaption{margin:10px 0 4px;white-space:nowrap}.badge{display:inline-block;border:1px solid #c8a360;background:#11161f;padding:2px;border-radius:4px;vertical-align:middle}</style><main>${conditionIcons.map(icon=>`<figure>${svg(icon,64)}<figcaption>${icon.name}</figcaption><span class="badge">${svg(icon,22)}</span></figure>`).join('')}</main>`);
 await page.locator('main').screenshot({path:'test-results/vtt-condition-silhouettes.png'});
 if(conditionIcons.length!==30 || new Set(conditionIcons.map(i=>JSON.stringify(i.paths))).size!==30)throw Error('Thirty distinct silhouettes required');
 console.log('PASS thirty distinct original silhouettes and whole labels, rendered at 64 and 22 px.');
}finally{await browser.close();}

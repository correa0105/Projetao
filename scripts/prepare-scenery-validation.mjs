import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const target=process.argv[2];if(!target||!fs.existsSync(path.join(target,'.git')))throw Error('Existing validation worktree required');
const git=process.env.GIT_EXECUTABLE||'git';
const modified=['src/Vtt.tsx','src/vtt-canvas.ts','shared/vtt.ts','shared/vtt-protocol.ts','src/vtt-library-tabs.css','docs/CONTEXTO.md'];
for(const file of modified){
  const original=execFileSync(git,['show','HEAD:'+file],{encoding:'utf8'}).split('\n');
  const diff=execFileSync(git,['diff','--unified=0','--',file],{encoding:'utf8'});
  const hunks=[];let current;
  for(const line of diff.split('\n')){
    const header=line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if(header){current={start:Number(header[1]),count:header[2]===undefined?1:Number(header[2]),body:[]};hunks.push(current);}
    else if(current&&(line.startsWith('+')||line.startsWith('-')||line.startsWith(' ')))current.body.push(line);
  }
  const selected=hunks.filter(h=>{const text=h.body.join('\n');return (file==='shared/vtt-protocol.ts'||file==='src/vtt-library-tabs.css'||/terrain|scenery|Scenery|Terrain/.test(text))&&!text.includes('VttMonsterVariants');});
  for(const h of selected.reverse()){const next=h.body.filter(l=>l.startsWith('+')||l.startsWith(' ')).map(l=>l.slice(1));original.splice(h.count?h.start-1:h.start,h.count,...next);}
  const output=path.join(target,file);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,original.join('\n'));
  console.log(JSON.stringify({file,hunks:selected.length}));
}
const files=['src/VttSceneryAssets.tsx','src/VttTerrainBrush.tsx','src/vtt-scenery-assets.css','src/vtt-terrain-canvas.ts','shared/vtt-scenery-assets.ts','shared/vtt-scenery-catalog.json','shared/vtt-terrain.ts','scripts/save-scenery-v2.mjs','scripts/save-terrain-v2.mjs','scripts/plan-scenery-v2.mjs','scripts/refresh-scenery-catalog.mjs','scripts/review-scenery-assets.mjs','scripts/smoke-vtt-scenery.ts','scripts/test-vtt-scenery-isolated.mjs','docs/VTT-SCENERY-20261012.md'];
for(const file of files){const output=path.join(target,file);fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(file,output);}
const catalog=JSON.parse(fs.readFileSync('shared/vtt-scenery-catalog.json','utf8'));
for(const image of [...catalog.map(a=>a.image),...['grass','earth','sand','stone','wood','snow'].map(id=>'/vtt/scenery-v2-20261012/terrain-'+id+'.webp')]){const output=path.join(target,'public',image.slice(1));fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(path.join('public',image.slice(1)),output);}
if(!fs.existsSync(path.join(target,'node_modules')))fs.symlinkSync(path.resolve('node_modules'),path.join(target,'node_modules'),'junction');
fs.copyFileSync('public/vtt/scenery-v2-20261012/catalog.json',path.join(target,'public/vtt/scenery-v2-20261012/catalog.json'));
// These catalog entries and this exact media are already present in the running release.
fs.copyFileSync('shared/vtt-animated-assets.ts',path.join(target,'shared/vtt-animated-assets.ts'));
const windmill='public/vtt/animated-assets-20261009/windmill-side-v5.webp';
fs.copyFileSync(windmill,path.join(target,windmill));
// Provenance and validation belong to this release; unrelated work stays out.
for(const file of ['scripts/verify-scenery-assets.mjs','scripts/review-terrain-v2.mjs','scripts/review-terrain-performance.mjs','scripts/prepare-scenery-validation.mjs','scripts/prepare-scenery-publication.mjs','scripts/audit-scenery-server-baseline.mjs',
 'data/vtt/scenery-v2-plan-20261012.json','data/vtt/scenery-v2-repair-prompts-20261012.json','data/vtt/scenery-v2-repair-extra-20261012.json','data/vtt/scenery-v2-repair-objects-20261012.json','data/vtt/scenery-v2-repair-structures-20261012.json','data/vtt/scenery-v2-table-repair-20261012.json','data/vtt/scenery-v2-pending-repairs-20261012.json','data/vtt/terrain-v2-plan-20261012.json','data/vtt/terrain-v2-reviewed-20261012.json',
 'data/vtt/scenery-v2-reviewed-20261012.json','data/vtt/scenery-v2-validation-20261012.json','data/vtt/terrain-performance-20261012.json']){
 if(!fs.existsSync(file))continue;const output=path.join(target,file);fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(file,output);
}
for(const asset of catalog){const file='data/vtt/scenery-v2-completed-20261012/'+asset.id+'.json';if(!fs.existsSync(file))continue;const output=path.join(target,file);fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(file,output);}
for(const id of ['grass','earth','sand','stone','wood','snow']){const file='data/vtt/terrain-v2-completed-20261012/'+id+'.json';const output=path.join(target,file);fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(file,output);}
console.log(JSON.stringify({assets:catalog.length,target}));

import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
// Compare approved layers against the release the user reviewed, even after
// this change is committed. Fixtures remain private/ignored in test-results.
for (const [source, target] of [
  ['src/vtt-effects-rebuilt-fire.ts', 'test-results/elemental-baseline-fire.ts'],
  ['src/vtt-effects-physical.ts', 'test-results/elemental-baseline-earth.ts'],
]) {
  const previous = execFileSync(
    'git',
    ['show', '38f2c06f6ca60fdeca8625927635d54806baf5d1:' + source],
    { encoding: 'utf8' },
  );
  await fs.writeFile(target, previous.replaceAll("from './", "from '../src/"));
}
const ids = [
  'chain-lightning',
  'lava',
  'bless',
  'sonic',
  'inferno',
  'blue-fire',
  'earthquake',
  'rage',
  'ember-comet',
  'fire-surge',
  'fire-geyser',
  'fire-spiral',
  'acid-splash',
  'water-geyser',
  'tidal-wave',
  'sand-veil',
  'soul-vortex',
  'spirit-procession',
  'ghost-wake',
  'dimensional-rift',
  'prism-pulse',
];
let html = await fs.readFile('test-results/vtt-cinematic-assets.html', 'utf8');
html = html.replaceAll('return metric(can);', 'return undefined;').replace(
  '</script>',
  `
import {renderEffect} from '/src/vtt-effects-canvas.ts';
import * as materials from '/src/vtt-elemental-materials.ts';
import {drawRebuiltFire as oldFire} from '/test-results/elemental-baseline-fire.ts';
import {drawRebuiltFire as newFire} from '/src/vtt-effects-rebuilt-fire.ts';
import {naturalEarth as oldEarth} from '/test-results/elemental-baseline-earth.ts';
import {naturalEarth as newEarth} from '/src/vtt-effects-physical.ts';
await materials.elementalMaterialsReady;
window.reviewIds=${JSON.stringify(ids)};
window.elementalReview=(t=1.1,start=0,count=7)=>{const rows=reviewIds.slice(start,start+count),grid=document.getElementById('grid');if(grid.dataset.start!==String(start)||grid.children.length!==rows.length){grid.innerHTML='';grid.dataset.start=start;for(const id of rows){const fig=document.createElement('figure'),can=canvas(),cap=document.createElement('figcaption');cap.textContent=effectLibrary.find(e=>e.kind===id).name;fig.append(can,cap);grid.append(fig);}}rows.forEach((id,i)=>drawEffect(effectLibrary.find(e=>e.kind===id),t,true,grid.children[i].querySelector('canvas')));};
window.sequence=(id)=>{const grid=document.getElementById('grid');grid.innerHTML='';for(const t of [.0,.23,.46,.69,.92,1.15]){const fig=document.createElement('figure'),can=canvas();fig.append(can);grid.append(fig);drawEffect(effectLibrary.find(e=>e.kind===id),t,true,can);}};
window.elementalState=(id,t,reduced)=>{const model=effectLibrary.find(e=>e.kind===id),can=canvas(),c=can.getContext('2d');c.translate(210,210);const e={id,kind:id,color:model.color,scale:1,opacity:1,at:0,duration:0,intensity:.85};for(const pass of ['behind','front'])renderEffect(c,e,200,200,{now:t,reducedMotion:reduced,image:art,pass});return can.toDataURL();};
window.materialDiff=(kind,a,b)=>{const px=[];for(const t of [a,b]){const can=canvas();materials.elementalMaterial(can.getContext('2d'),kind,t,210,210,kind==='electric'?380:256,kind==='electric'?100:256);px.push(can.getContext('2d').getImageData(0,0,420,420).data);}let diff=0,mass=0;for(let i=0;i<px[0].length;i+=4){for(let k=0;k<4;k++){const a=k===3?px[0][i+3]:px[0][i+k]*px[0][i+3]/255,b=k===3?px[1][i+3]:px[1][i+k]*px[1][i+3]/255;diff+=Math.abs(a-b);mass+=Math.max(a,b);}}return diff/Math.max(1,mass);};
window.preserved=(id,t)=>{const model=effectLibrary.find(e=>e.kind===id), e={id,kind:id,color:model.color,intensity:.85}, f=effectFootprint(200,200,100,100,art);const out=[];for(const old of [true,false]){const can=canvas(),c=can.getContext('2d');c.translate(210,210);if(id==='earthquake')(old?oldEarth:newEarth)(c,e,f,t,seededRandom(id),true);else(old?oldFire:newFire)(c,e,t,seededRandom(id),false,1);out.push(can.toDataURL());}return out[0]===out[1];};
window.mediaInfo=()=>({media:materials.elementalMediaCount(),tiles:materials.elementalTileCount()});
</script>`,
);
await fs.writeFile('test-results/vtt-elemental-review.html', html);
const server = await createServer({
  optimizeDeps: { entries: ['test-results/vtt-elemental-review.html'] },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1900, height: 1350 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + 'test-results/vtt-elemental-review.html');
  await page.waitForFunction(() => window.elementalReview);
  for (const start of [0, 7, 14]) {
    await page.evaluate((s) => window.elementalReview(1.1, s, 7), start);
    await page
      .locator('#grid')
      .screenshot({ path: 'test-results/elemental-list-' + start + '.png' });
  }
  for (const id of ids) {
    assert.equal(
      await page.evaluate((id) => window.elementalState(id, 1500, true), id),
      await page.evaluate((id) => window.elementalState(id, 4300, true), id),
      id + ' reduced',
    );
  }
  for (const id of ['inferno', 'rage', 'earthquake'])
    for (const t of [0.1, 1.1, 3.7])
      assert(
        await page.evaluate(([id, t]) => window.preserved(id, t), [id, t]),
        id + ' approved pass changed',
      );
  const fields = {};
  for (const kind of [
    'lava',
    'blessing',
    'resonance',
    'acid',
    'electric',
    'water',
    'rift',
    'prism',
    'fire-volume',
    'water-jet',
  ]) {
    fields[kind] = {
      seam: await page.evaluate((k) => window.materialDiff(k, 0.001, 32 / 24 - 0.001), kind),
      evolution: await page.evaluate((k) => window.materialDiff(k, 0.1, 0.65), kind),
    };
    assert(fields[kind].seam < 0.09, kind + ' loop seam');
    assert(fields[kind].evolution > 0.012, kind + ' frozen');
  }
  for (const id of [
    'blue-fire',
    'ember-comet',
    'water-geyser',
    'acid-splash',
    'soul-vortex',
    'dimensional-rift',
  ]) {
    await page.evaluate((id) => window.sequence(id), id);
    await page
      .locator('#grid')
      .screenshot({ path: 'test-results/elemental-sequence-' + id + '.png' });
  }
  await page.evaluate(() => window.elementalReview(2, 7, 6));
  const submission = await page.evaluate(() => {
    const begin = performance.now();
    for (let i = 0; i < 120; i++) elementalReview(3 + i / 60, 7, 6);
    return (performance.now() - begin) / 120;
  });
  const cadence = await page.evaluate(async () => {
    let last = performance.now(),
      sum = 0;
    for (let i = 0; i < 70; i++) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      if (i > 4) sum += now - last;
      last = now;
      elementalReview(6 + i / 60, 7, 6);
    }
    return sum / 65;
  });
  const media = await page.evaluate(() => window.mediaInfo());
  assert.equal(media.media, 21);
  assert.equal(media.tiles, 10);
  assert(submission < 32);
  assert(cadence < 35);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/elemental-qa.json',
    JSON.stringify({ ids, fields, media, submission, cadence, errors }, null, 2),
  );
  console.log(
    'PASS 21 effects; approved inferno/rage bases and earthquake foreground identical; 21 media, 10 bounded tiles; draw ' +
      submission.toFixed(2) +
      'ms, RAF ' +
      cadence.toFixed(2) +
      'ms.',
  );
} finally {
  await browser.close();
  await server.close();
}

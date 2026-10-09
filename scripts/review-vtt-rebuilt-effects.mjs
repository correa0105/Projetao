import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const stage = '.';
let html = await fs.readFile(stage + '/test-results/vtt-cinematic-assets.html', 'utf8');
const ids = [
  'vortex',
  'fire',
  'lava',
  'bless',
  'sonic',
  'inferno',
  'blue-fire',
  'thunderstorm',
  'lunar-halo',
  'starfield',
  'comets',
  'mirror-shield',
  'rage',
  'sleep',
  'fear',
  'ember-comet',
  'fire-surge',
  'fire-geyser',
  'fire-spiral',
  'electric-cage',
  'ball-lightning',
  'storm-vortex',
  'static-corona',
  'poison-breath',
  'wind-shear',
  'soul-vortex',
  'spirit-procession',
  'ghost-wake',
];
html = html.replaceAll('return metric(can);', 'return undefined;').replace(
  '</script>',
  `
import {renderEffect} from '/src/vtt-effects-canvas.ts';
window.rebuiltIds=${JSON.stringify(ids)};
window.rebuiltReview=(time=1.1,start=0,count=10)=>{const rows=rebuiltIds.slice(start,start+count),grid=document.getElementById('grid');if(grid.children.length!==rows.length||grid.dataset.start!==String(start)){grid.innerHTML='';grid.dataset.start=start;for(const id of rows){const fig=document.createElement('figure'),can=canvas(),cap=document.createElement('figcaption');cap.textContent=(rebuiltIds.indexOf(id)+1)+'. '+effectLibrary.find(e=>e.kind===id).name;fig.append(can,cap);grid.append(fig);}}rows.forEach((id,i)=>drawEffect(effectLibrary.find(e=>e.kind===id),time,true,grid.children[i].querySelector('canvas')));};
window.rebuiltStates=(id,time,reduced)=>{const model=effectLibrary.find(e=>e.kind===id),can=canvas(),c=can.getContext('2d');c.translate(210,210);const e={id,kind:id,color:model.color,scale:1,opacity:1,at:0,duration:0,intensity:.85};for(const pass of ['behind','front'])renderEffect(c,e,200,200,{now:time,reducedMotion:reduced,image:art,pass});return can.toDataURL();};
window.fieldDiff=(kind,a,b)=>{const one=canvas(),two=canvas();return import('/src/vtt-effects-temporal.ts').then(m=>{for(const [can,t] of [[one,a],[two,b]]){m.temporalField(can.getContext('2d'),kind,t,210,210,256,256);}const p=one.getContext('2d').getImageData(0,0,420,420).data,q=two.getContext('2d').getImageData(0,0,420,420).data;let difference=0,visible=0;for(let i=3;i<p.length;i+=4){difference+=Math.abs(p[i]-q[i]);visible+=p[i];}return difference/Math.max(1,visible);});};
window.alphaShape=id=>{const can=canvas();drawEffect(effectLibrary.find(e=>e.kind===id),1.3,false,can);const px=can.getContext('2d').getImageData(0,0,420,420).data;return Array.from({length:px.length/4},(_,i)=>px[i*4+3]);};
</script>`,
);
await fs.writeFile(stage + '/test-results/vtt-rebuilt-review.html', html);
const server = await createServer({ root: stage, server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1150 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + 'test-results/vtt-rebuilt-review.html');
  await page.waitForFunction(() => window.rebuiltReview);
  for (const start of [0, 10, 20]) {
    await page.evaluate((start) => window.rebuiltReview(1.1, start, 10), start);
    await page
      .locator('#grid')
      .screenshot({ path: stage + '/test-results/rebuilt-list-' + start + '.png' });
  }
  for (const id of ids) {
    const first = await page.evaluate((id) => window.rebuiltStates(id, 1500, true), id),
      next = await page.evaluate((id) => window.rebuiltStates(id, 4300, true), id);
    assert.equal(first, next, id + ' reduced motion');
  }
  const materials = {};
  for (const kind of ['ring', 'wave', 'geyser', 'spiral', 'tongue', 'vapour', 'vortex']) {
    materials[kind] = {
      seam: await page.evaluate((k) => window.fieldDiff(k, 0.001, 1.999), kind),
      evolution: await page.evaluate((k) => window.fieldDiff(k, 0.1, 0.65), kind),
    };
    assert(materials[kind].seam < 0.08, kind + ' loop seam');
    assert(materials[kind].evolution > 0.08, kind + ' density does not evolve');
  }
  const shapes = {};
  for (const id of [
    'lunar-halo',
    'starfield',
    'comets',
    'mirror-shield',
    'sleep',
    'fear',
    'soul-vortex',
    'spirit-procession',
    'ghost-wake',
  ])
    shapes[id] = await page.evaluate((id) => window.alphaShape(id), id);
  for (const [i, a] of Object.keys(shapes).entries())
    for (const b of Object.keys(shapes).slice(i + 1)) {
      let diff = 0,
        mass = 0;
      for (let j = 0; j < shapes[a].length; j++) {
        diff += Math.abs(shapes[a][j] - shapes[b][j]);
        mass += Math.max(shapes[a][j], shapes[b][j]);
      }
      assert(diff / mass > 0.16, a + ' / ' + b + ' have the same silhouette');
    }
  await page.evaluate(() => window.rebuiltReview(2.3, 13, 6));
  await page.locator('#grid').screenshot({ path: stage + '/test-results/rebuilt-fire-motion.png' });
  const submission = await page.evaluate(() => {
    const begin = performance.now();
    for (let i = 0; i < 120; i++) window.rebuiltReview(3 + i / 60, 13, 6);
    return (performance.now() - begin) / 120;
  });
  const cadence = await page.evaluate(async () => {
    const times = [];
    let last = performance.now();
    for (let i = 0; i < 70; i++) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      if (i > 4) times.push(now - last);
      last = now;
      window.rebuiltReview(6 + i / 60, 13, 6);
    }
    return times.reduce((a, b) => a + b, 0) / times.length;
  });
  assert(submission < 32, 'draw submission ' + submission);
  assert(cadence < 35, 'RAF cadence ' + cadence);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    stage + '/test-results/rebuilt-qa.json',
    JSON.stringify({ ids, materials, submission, cadence, errors }, null, 2),
  );
  console.log(
    'PASS 28 rebuilt effects: frozen reduced motion, seven evolving/seamless fields, distinct magical/spectral silhouettes; draw ' +
      submission.toFixed(2) +
      'ms, RAF ' +
      cadence.toFixed(2) +
      'ms.',
  );
} finally {
  await browser.close();
  await server.close();
}

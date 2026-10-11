import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

await fs.mkdir('test-results', { recursive: true });
const path = '/audio/vtt-rolls-20261011/fahh-natural-one-no-music-v2.wav';
const html = `<div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{VttRollSounds}from'/src/VttRollSounds.tsx';import{SiteMusicProvider,useSoundEffects}from'/src/SiteMusic.tsx';import{rollFormula}from'/shared/vtt-roll.ts';
window.plays=[];window.instances=[];window.decoded=[];window.failures=[];
const play=HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play=function(){if(this.src.endsWith('fahh-natural-one-no-music-v2.wav')){window.plays.push({src:this.src,volume:this.volume});window.instances.push(this);this.addEventListener('loadedmetadata',()=>window.decoded.push(this.duration),{once:true});return play.call(this).catch(e=>{window.failures.push(e.message);throw e;});}return play.call(this);};
const initial={roomId:'room-a',messages:[{id:'history',author:'Jogador',text:'Teste',roll:rollFormula('1d20',()=>1),created_at:new Date().toISOString(),private:false}],enabled:true,volume:.5};
let setState;
function Controls(){const channel=useSoundEffects();return React.createElement('button',{id:'mute',onClick:channel.toggle},'Mudo: '+channel.muted);}
function Demo(){const[state,set]=React.useState(initial);setState=set;return React.createElement(React.Fragment,{},React.createElement('button',{id:'arm',onClick:()=>{}},'Habilitar áudio'),React.createElement(Controls),React.createElement(VttRollSounds,state));}
const root=createRoot(document.querySelector('#root'));const mount=()=>root.render(React.createElement(SiteMusicProvider,{},React.createElement(Demo)));mount();
window.update=patch=>setState(previous=>({...previous,...patch}));
window.message=(id,formula,values,age=0,priv=false)=>{const dice=[...values];return{id,author:'Jogador',text:'Rolagem',roll:rollFormula(formula,()=>dice.shift()),created_at:new Date(Date.now()-age).toISOString(),private:priv};};
window.append=(id,formula,values,age=0,priv=false)=>setState(previous=>({...previous,messages:[...previous.messages,message(id,formula,values,age,priv)]}));
window.poll=()=>setState(previous=>({...previous,messages:[...previous.messages]}));
window.unmount=()=>root.render(null);window.mount=mount;window.ready=true;
</script>`;
await fs.writeFile('test-results/natural-one-sound.html', html);
const server = await createServer({
  cacheDir: '.local/vite-natural-one-sound',
  optimizeDeps: {
    entries: ['test-results/natural-one-sound.html'],
    include: ['react', 'react-dom/client', 'react/jsx-runtime'],
  },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const origin = server.resolvedUrls.local[0];
try {
  const errors = [];
  async function client(width) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('alvorada-music-muted', 'true');
      localStorage.setItem('alvorada-effects-muted', 'false');
      localStorage.setItem('alvorada-effects-volume', '.4');
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/audio/**', (route) =>
      new URL(route.request().url()).pathname === path
        ? route.continue()
        : route.fulfill({ path: 'public' + path, contentType: 'audio/wav' }),
    );
    await page.goto(origin + 'test-results/natural-one-sound.html');
    await page.waitForFunction(() => window.ready);
    await page.locator('#arm').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.plays.length), 0, 'initial history replayed');
    return page;
  }
  const a = await client(1440),
    b = await client(390),
    peers = [a, b];
  async function append(id, formula, values, age = 0, priv = false) {
    for (const p of peers)
      await p.evaluate((args) => window.append(...args), [id, formula, values, age, priv]);
    await a.waitForTimeout(80);
  }
  const counts = async () => Promise.all(peers.map((p) => p.evaluate(() => window.plays.length)));
  for (const [id, formula, values] of [
    ['ordinary', '1d20', [12]],
    ['bonus-one', '1d20-8', [9]],
    ['other-die', '1d6', [1]],
    ['mixed', '1d20+1d6', [20, 1]],
  ])
    await append(id, formula, values);
  assert.deepEqual(await counts(), [0, 0], 'wrong die or total triggered');
  await append('natural', '1d20+7', [1]);
  for (const p of peers) await p.waitForFunction(() => window.decoded.length > 0);
  assert.deepEqual(await counts(), [1, 1], 'natural one did not play for both participants');
  for (const p of peers) {
    const report = await p.evaluate(() => ({
      volume: plays[0].volume,
      duration: decoded[0],
      failures,
    }));
    assert.equal(report.volume, 0.2);
    assert(Math.abs(report.duration - 1.38) < 0.005, 'trimmed audio has the wrong duration');
    assert.deepEqual(report.failures, []);
    await p.evaluate(() => {
      poll();
      poll();
      poll();
    });
  }
  await a.waitForTimeout(80);
  assert.deepEqual(await counts(), [1, 1], 'poll duplicated playback');
  await append('advantage', '2d20kh1+5', [1, 19]);
  await append('disadvantage', '2d20kl1', [18, 1]);
  await append('double-one', '2d20', [1, 1]);
  assert.deepEqual(await counts(), [4, 4], 'advantage/disadvantage or double one repeats');
  await append('stale', '1d20', [1], 60000);
  assert.deepEqual(await counts(), [4, 4], 'old paged history replayed');
  for (const p of peers) await p.evaluate(() => update({ enabled: false }));
  await append('disabled', '1d20', [1]);
  assert.deepEqual(await counts(), [4, 4]);
  for (const p of peers) {
    assert(await p.evaluate(() => instances.every((a) => a.paused)));
    await p.evaluate(() => update({ enabled: true, volume: 0.75 }));
  }
  await a.waitForTimeout(80);
  assert.deepEqual(await counts(), [4, 4], 'enabling sound replayed suppressed roll');
  await append('volume', '1d20', [1]);
  assert.deepEqual(await counts(), [5, 5]);
  for (const p of peers)
    assert.equal(await p.evaluate(() => plays.at(-1).volume), 0.30000000000000004);
  for (const p of peers) await p.locator('#mute').click();
  await append('muted', '1d20', [1]);
  assert.deepEqual(await counts(), [5, 5]);
  for (const p of peers) {
    assert(await p.evaluate(() => instances.every((a) => a.paused)));
    await p.locator('#mute').click();
  }
  await append('authorized-private', '1d20', [1], 0, true);
  assert.deepEqual(await counts(), [6, 6]);
  for (const p of peers)
    await p.evaluate(() =>
      Object.defineProperty(document, 'hidden', { value: true, configurable: true }),
    );
  await append('background', '1d20', [1]);
  assert.deepEqual(await counts(), [6, 6]);
  for (const p of peers) {
    await p.evaluate(() => {
      delete document.hidden;
      poll();
    });
    await p.evaluate(() =>
      update({ roomId: 'room-b', messages: [message('new-room-history', '1d20', [1])] }),
    );
  }
  await a.waitForTimeout(80);
  assert.deepEqual(await counts(), [6, 6], 'room switch replayed history');
  for (const p of peers) assert(await p.evaluate(() => instances.every((a) => a.paused)));
  await append('new-room-roll', '1d20', [1]);
  assert.deepEqual(await counts(), [7, 7]);
  for (const p of peers) {
    await p.evaluate(() => unmount());
    await p.waitForTimeout(50);
    assert(await p.evaluate(() => instances.every((a) => a.paused)));
    await p.evaluate(() => mount());
    await p.waitForTimeout(80);
  }
  assert.deepEqual(await counts(), [7, 7], 'remount replayed history');
  const response = await a.request.get(origin + path.slice(1));
  assert.equal(response.status(), 200);
  const bytes = await response.body(),
    original = await fs.readFile('public' + path);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    createHash('sha256').update(original).digest('hex'),
  );
  const report = {
    participants: 2,
    plays: await counts(),
    duration: await a.evaluate(() => decoded[0]),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    errors,
  };
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/natural-one-sound-metrics.json',
    JSON.stringify(report, null, 2),
  );
  console.log(
    'PASS trimmed WAV decoded/played in Edge desktop/mobile; two participants, natural/mixed/bonus/advantage/disadvantage, single cue, history/poll/room guards, local/global mute, volume, hidden document and cleanup.',
  );
} finally {
  await browser.close();
  await server.close();
}

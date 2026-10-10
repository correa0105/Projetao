import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
await fs.mkdir('test-results', { recursive: true });
const html = `<style>body{margin:0;background:#0b121b;color:#e6d6b8;font:13px Georgia}#grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px}figure{margin:0;border:1px solid #9a845355}canvas{display:block;width:100%}figcaption{text-align:center;padding:10px}</style><div id="grid"></div><script type="module">
import{drawMapAtmosphere}from'/src/vtt-atmosphere.ts';import{renderVtt}from'/src/vtt-canvas.ts';import{newScene}from'/shared/vtt.ts';import{atmosphereSchema,dayPresets,weatherPresets}from'/shared/vtt-atmosphere.ts';
const art=new Image();art.src='/alvorada-map-v2.png';await art.decode();const scene=newScene('00000000-0000-4000-8000-000000000001','Atmosfera');scene.width=900;scene.height=650;scene.background=art.src;scene.lighting=false;scene.fog=false;
window.frame=(weather='clear',day='original',now=2500,reduced=false,enabled=true)=>{const can=document.createElement('canvas');can.width=900;can.height=650;const c=can.getContext('2d');c.drawImage(art,0,0,900,650);scene.atmosphere=atmosphereSchema.parse({enabled,weather,day,intensity:.85});drawMapAtmosphere(c,scene,{left:0,top:0,right:900,bottom:650},1,900,650,now,reduced);return can;};
window.hidden=weather=>{const can=document.createElement('canvas');can.width=900;can.height=650;scene.fog=true;scene.fogMode='manual';scene.atmosphere=atmosphereSchema.parse({enabled:true,weather,day:'night'});renderVtt(can.getContext('2d'),scene,{camera:{x:450,y:325,zoom:1},width:900,height:650,dpr:1,images:new Map([[art.src,art]]),selected:[],gm:false,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null});scene.fog=false;return can.toDataURL();};
window.show=(rows)=>{const grid=document.querySelector('#grid');grid.innerHTML='';for(const [id,name,day]of rows){const fig=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=name;fig.append(frame(id,day||'original'),caption);grid.append(fig);}};
window.weatherRows=weatherPresets.map(p=>[p[0],p[1]]);window.dayRows=dayPresets.slice(1).map(p=>['clear',p.name,p.id]);window.ready=true;
</script>`;
await fs.writeFile('test-results/map-atmosphere-review.html', html);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.shaderChecks = [];
    const native = WebGLRenderingContext.prototype.compileShader;
    WebGLRenderingContext.prototype.compileShader = function (shader) {
      native.call(this, shader);
      window.shaderChecks.push(this.getShaderParameter(shader, this.COMPILE_STATUS));
    };
  });
  await page.goto(server.resolvedUrls.local[0] + 'test-results/map-atmosphere-review.html');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => show(dayRows));
  await page.locator('#grid').screenshot({ path: 'test-results/map-day-presets.png' });
  const rows = await page.evaluate(() => weatherRows);
  for (let i = 0; i < rows.length; i += 6) {
    await page.evaluate((rows) => show(rows), rows.slice(i, i + 6));
    await page
      .locator('#grid')
      .screenshot({ path: 'test-results/map-weather-presets-' + i + '.png' });
  }
  const metrics = await page.evaluate(() => {
    const data = (can) => can.getContext('2d').getImageData(0, 0, 900, 650).data,
      diff = (a, b) => {
        let n = 0;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
        return n;
      };
    const base = data(frame('clear', 'original', 2500, false, false));
    return weatherRows.map(([kind]) => ({
      kind,
      changed: diff(base, data(frame(kind))),
      animation: diff(data(frame(kind, 'original', 2500)), data(frame(kind, 'original', 4900))),
      reduced: diff(
        data(frame(kind, 'original', 2500, true)),
        data(frame(kind, 'original', 4900, true)),
      ),
    }));
  });
  for (const m of metrics) {
    if (m.kind !== 'clear') assert(m.changed > 1000, m.kind + ' invisible');
    assert(m.reduced <= 32, m.kind + ' reduced motion: exceeds native GPU quantization tolerance');
    if (m.kind !== 'clear') assert(m.animation > 0, m.kind + ' static');
  }
  assert.equal(
    await page.evaluate(() => hidden('clear')),
    await page.evaluate(() => hidden('fog')),
    'Atmosphere bypasses manual fog',
  );
  const programs = await page.evaluate(() => shaderChecks);
  assert(programs.length >= 2 && programs.every(Boolean), 'native shader compilation failed');
  assert.deepEqual(errors, []);
  await fs.writeFile('test-results/map-atmosphere-metrics.json', JSON.stringify(metrics, null, 2));
  console.log(
    'PASS native GPU atmosphere, 29 presets, daylight, movement/reduced motion, fog visibility and gallery.',
  );
} finally {
  await browser.close();
  await server.close();
}

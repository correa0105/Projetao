import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
await fs.mkdir('test-results', { recursive: true });
const html = `<style>body{margin:0;background:#0b121b;color:#e6d6b8;font:13px Georgia}#grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px}figure{margin:0;border:1px solid #9a845355}canvas{display:block;width:100%}figcaption{text-align:center;padding:10px}</style><div id="grid"></div><script type="module">
import{drawMapAtmosphere}from'/src/vtt-atmosphere.ts';import{drawMapAtmosphere as originalWeather}from'/.local/living-original/src/vtt-atmosphere.ts';import{drawWeatherFlows}from'/src/vtt-atmosphere-flows.ts';import{renderVtt}from'/src/vtt-canvas.ts';import{newScene}from'/shared/vtt.ts';import{atmosphereSchema,dayPresets,weatherPresets}from'/shared/vtt-atmosphere.ts';
const art=new Image();art.src='/alvorada-map-v2.png';await art.decode();const scene=newScene('00000000-0000-4000-8000-000000000001','Atmosfera');scene.width=900;scene.height=650;scene.background=art.src;scene.lighting=false;scene.fog=false;
window.frame=(weather='clear',day='original',now=2500,reduced=false,enabled=true,zoom=1)=>{const can=document.createElement('canvas');can.width=900;can.height=650;const c=can.getContext('2d');c.drawImage(art,0,0,900,650);scene.width=900/zoom;scene.height=650/zoom;scene.atmosphere=atmosphereSchema.parse({enabled,weather,day,intensity:.65});c.scale(zoom,zoom);drawMapAtmosphere(c,scene,{left:0,top:0,right:900/zoom,bottom:650/zoom},zoom,900,650,now,reduced);c.setTransform(1,0,0,1,0,0);return can;};
window.transition=()=>{const can=document.createElement('canvas');can.width=900;can.height=650;const c=can.getContext('2d'),result=[];scene.width=900;scene.height=650;for(const [day,now]of [['original',0],['night',100],['night',1000],['night',1900]]){c.clearRect(0,0,900,650);c.drawImage(art,0,0,900,650);scene.atmosphere=atmosphereSchema.parse({enabled:true,day});drawMapAtmosphere(c,scene,{left:0,top:0,right:900,bottom:650},1,900,650,now,false);result.push(Array.from(c.getImageData(0,0,900,650).data));}return result;};
window.hidden=weather=>{const can=document.createElement('canvas');can.width=900;can.height=650;scene.fog=true;scene.fogMode='manual';scene.atmosphere=atmosphereSchema.parse({enabled:true,weather,day:'night'});renderVtt(can.getContext('2d'),scene,{camera:{x:450,y:325,zoom:1},width:900,height:650,dpr:1,images:new Map([[art.src,art]]),selected:[],gm:false,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null});scene.fog=false;return can.toDataURL();};
window.show=(rows)=>{const grid=document.querySelector('#grid');grid.innerHTML='';for(const [id,name,day]of rows){const fig=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=name;fig.append(frame(id,day||'original'),caption);grid.append(fig);}};
window.weatherRows=weatherPresets.filter(p=>p[0]!=='meteors').map(p=>[p[0],p[1]]);window.dayRows=dayPresets.slice(1).map(p=>['clear',p.name,p.id]);window.preservedSky=()=>{const render=fn=>{const can=document.createElement('canvas');can.width=900;can.height=650;scene.width=900;scene.height=650;scene.atmosphere=atmosphereSchema.parse({enabled:true,weather:'luminous-sky'});fn(can.getContext('2d'),scene,{left:0,top:0,right:900,bottom:650},1,900,650,2500,true);return can.getContext('2d').getImageData(0,0,900,650).data;};const a=render(drawMapAtmosphere),b=render(originalWeather);let max=0;for(let i=0;i<a.length;i++)max=Math.max(max,Math.abs(a[i]-b[i]));return max;};
window.trajectories=weather=>{const a=atmosphereSchema.parse({enabled:true,weather}),frames=[];for(const t of [3,3.05]){const can=document.createElement('canvas');can.width=900;can.height=650;const c=can.getContext('2d'),points=[];const name=weather==='blizzard'?'translate':'moveTo',native=c[name].bind(c);c[name]=(x,y)=>{points.push([x,y]);native(x,y);};drawWeatherFlows(c,scene.id,a,t,900,650);frames.push(points.slice(0,200));}const positive=(v,extent)=>v>extent/2?v-extent:v<-extent/2?v+extent:v;const speeds=frames[0].map((p,i)=>({x:Math.abs(positive(frames[1][i][0]-p[0],1200)*20),y:Math.abs(positive(frames[1][i][1]-p[1],950)*20)}));const median=axis=>speeds.map(v=>v[axis]).sort((a,b)=>a-b)[Math.floor(speeds.length/2)];return{x:median('x'),y:median('y')};};window.ready=true;
</script>`;
await fs.writeFile('test-results/map-atmosphere-review.html', html);
const server = await createServer({
  optimizeDeps: { entries: ['test-results/map-atmosphere-review.html'] },
  server: { host: '127.0.0.1', port: 0 },
});
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
    const visible = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4)
        if (Math.max(...[0, 1, 2].map((k) => Math.abs(a[i + k] - b[i + k]))) > 12) n++;
      return n / (900 * 650);
    };
    return weatherRows.map(([kind]) => ({
      kind,
      changed: diff(base, data(frame(kind))),
      animation: diff(data(frame(kind, 'original', 2500)), data(frame(kind, 'original', 4900))),
      reduced: diff(
        data(frame(kind, 'original', 2500, true)),
        data(frame(kind, 'original', 4900, true)),
      ),
      coverage: visible(base, data(frame(kind))),
      zoomedOut: visible(base, data(frame(kind, 'original', 2500, false, true, 0.2))),
    }));
  });
  await fs.writeFile('test-results/map-atmosphere-metrics.json', JSON.stringify(metrics, null, 2));
  for (const m of metrics) {
    if (m.kind !== 'clear') {
      assert(m.coverage > 0.003, m.kind + ' barely visible');
      assert(m.zoomedOut > 0.003, m.kind + ' disappears when zoomed out');
    }
    assert(m.reduced <= 32, m.kind + ' reduced motion: exceeds native GPU quantization tolerance');
    if (m.kind !== 'clear') assert(m.animation > 0, m.kind + ' static');
  }
  const transition = await page.evaluate(() => window.transition());
  assert.deepEqual(transition[0], transition[1], 'daylight selection jumps');
  const delta = (a, b) => a.reduce((n, v, i) => n + Math.abs(v - b[i]), 0);
  assert(delta(transition[0], transition[2]) > 100000);
  assert(
    delta(transition[0], transition[3]) > delta(transition[0], transition[2]) * 1.6,
    'daylight does not fade progressively',
  );
  assert.equal(
    await page.evaluate(() => hidden('clear')),
    await page.evaluate(() => hidden('fog')),
    'Atmosphere bypasses manual fog',
  );
  const sky = await page.evaluate(() => preservedSky());
  assert(sky <= 2, 'approved luminous sky changed: ' + sky);
  const speeds = {};
  for (const weather of ['rain', 'thunderstorm', 'blizzard', 'wind', 'sandstorm'])
    speeds[weather] = await page.evaluate((id) => trajectories(id), weather);
  assert(speeds.rain.y > 450);
  assert(speeds.thunderstorm.y > 800);
  assert(speeds.blizzard.y > 220);
  assert(speeds.wind.x > 700);
  assert(speeds.sandstorm.x > 600);
  await fs.writeFile(
    'test-results/weather-polish-preservation.json',
    JSON.stringify(
      { luminousSkyMaxRgbaDelta: sky, nativeParticlePixelsPerSecond: speeds },
      null,
      2,
    ),
  );
  const programs = await page.evaluate(() => shaderChecks);
  assert(programs.length >= 2 && programs.every(Boolean), 'native shader compilation failed');
  assert.deepEqual(errors, []);
  await fs.writeFile('test-results/map-atmosphere-metrics.json', JSON.stringify(metrics, null, 2));
  console.log(
    'PASS native GPU atmosphere, 28 available presets, daylight, movement/reduced motion, fog visibility and gallery.',
  );
} finally {
  await browser.close();
  await server.close();
}

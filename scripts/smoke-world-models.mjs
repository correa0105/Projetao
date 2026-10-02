import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Render the actual models close up, without any database or player data.
const server = await createServer({ server: { port: 3033, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /shader|THREE|WebGL/i.test(m.text())) errors.push(m.text());
});
try {
  await page.goto('http://localhost:3033');
  await page.setContent('<body style="margin:0;background:#182b30"></body>');
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { createWorldFleet } = await import('/src/world-fleet.ts');
    const { createWorldDragon } = await import('/src/world-dragon.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1440, 800);
    renderer.setPixelRatio(1);
    document.body.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#182b30');
    scene.add(new THREE.HemisphereLight('#c5d4da', '#3e352b', 2));
    const light = new THREE.DirectionalLight('#ffe2b8', 2.25);
    light.position.set(-3, -4, 8);
    scene.add(light);
    const camera = new THREE.OrthographicCamera(-3.5, 3.5, 1.95, -1.95, 0.01, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -5, 7);
    camera.lookAt(0, 0, 0.15);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({ color: '#193f48', roughness: 0.55 }),
    );
    water.position.z = -0.025;
    scene.add(water);
    const fleet = createWorldFleet(() => 0);
    fleet.update(0);
    for (let i = 1; i <= 754; i++) fleet.update(i * 0.05);
    const ship = fleet.group.getObjectByName('pirate-ship-1');
    ship.position.set(-2.3, 0, 0.035);
    ship.visible = true;
    ship.rotation.set(0, 0, -0.5);
    ship.scale.setScalar(1.4);
    scene.add(ship);
    const kraken = fleet.group.getObjectByName('sea-kraken');
    kraken.position.x = 0;
    kraken.position.y = 0;
    scene.add(kraken);
    const dragon = createWorldDragon(() => 0);
    dragon.update(4);
    const body = dragon.group.children[0];
    body.position.set(2.3, 0, 0.8);
    body.rotation.z = -0.4;
    body.scale.setScalar(0.72);
    scene.add(body);
    await new Promise((r) => setTimeout(r, 1200));
    renderer.render(scene, camera);
    window.modelPreview = { renderer, scene, camera, fleet, dragon, time: 37.7 };
  });
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/world-models-closeup.png' });
  await page.evaluate(() => {
    const p = window.modelPreview;
    for (let i = 1; i <= 7; i++) p.fleet.update(p.time + i * 0.05);
    p.renderer.render(p.scene, p.camera);
  });
  await page.screenshot({ path: 'test-results/world-models-slap.png' });
  expect(errors).toEqual([]);
  console.log('Materiais e modelos: renderização próxima sem erros WebGL/shader.');
} finally {
  await browser.close();
  await server.close();
}

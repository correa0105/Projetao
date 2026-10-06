import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/effects-editor-preview.html',
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="vtt-workspace"><div class="vtt-stage" style="flex:1" id="preview"></div></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {VttEffects} from '/src/VttEffects.tsx';import '/src/styles.css';import '/src/theme.css';import '/src/vtt.css';
function Demo(){const [presets,setPresets]=React.useState(Array.from({length:80},(_,i)=>({id:crypto.randomUUID(),name:'Efeito '+i,kind:'fire',color:'#ad7654',duration:5,scale:1})));return React.createElement(VttEffects,{presets,busy:false,save:async p=>setPresets(v=>[...v,p]),remove:async()=>{},apply:async()=>{},clear:async()=>{},preview:()=>{},editDeath:async()=>{}});}createRoot(document.getElementById('preview')).render(React.createElement(Demo));
</script></body></html>`,
);
const server = await createServer({ server: { host: '127.0.0.1', port: 3038, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('http://127.0.0.1:3038/test-results/effects-editor-preview.html');
    await page.getByRole('button', { name: 'Efeitos do mestre', exact: true }).click();
    const menu = page.getByRole('region', { name: 'Efeitos salvos do mestre' });
    await expect(menu.locator('.vtt-effects-row')).toHaveCount(80);
    await menu.getByRole('button', { name: 'Novo efeito', exact: true }).click();
    await expect(menu.getByRole('form', { name: 'Editor de efeito' })).toBeVisible();
    const input = menu.getByLabel('Nome do efeito', { exact: true });
    await expect(input).toBeFocused();
    expect(await menu.evaluate((el) => el.scrollTop)).toBe(0);
    expect((await input.boundingBox()).y).toBeGreaterThanOrEqual((await menu.boundingBox()).y);
    await input.fill('Efeito novo');
    await menu.getByLabel('Modelo do efeito').selectOption('frost');
    await menu.getByLabel('Efeito infinito').check();
    await page.screenshot({ path: 'test-results/vtt-effects-editor-' + width + '.png' });
    await menu.getByRole('button', { name: 'Salvar efeito', exact: true }).click();
    await expect(menu.locator('.vtt-effects-row')).toHaveCount(81);
    await expect(menu.locator('.vtt-effects-row').last()).toContainText('Efeito novo');
  }
  expect(errors).toEqual([]);
  console.log(
    'Novo efeito: editor imediatamente visível/focado, lista de 80 presets, salvar sem token, infinito e layouts 1440/390/320 OK.',
  );
} finally {
  await browser.close();
  await server.close();
}

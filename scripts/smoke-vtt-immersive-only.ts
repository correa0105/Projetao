import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { smokeImmersiveAudio } from './smoke-vtt-immersive';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3004';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3004, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const contexts = await Promise.all(
  [0, 1].map(() =>
    browser.newContext({
      viewport: { width: 1440, height: 950 },
      permissions: ['microphone'],
      extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
    }),
  ),
);
const pages = await Promise.all(contexts.map((c) => c.newPage())),
  errors: string[] = [];
await mkdir('test-results', { recursive: true });
for (const p of pages) {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') console.log('BROWSER', m.text());
  });
  await p.addInitScript(() => {
    const OldAudio = window.Audio;
    (window as any).__vttAudios = [];
    (window as any).Audio = function (src?: string) {
      const a = new OldAudio(src);
      (window as any).__vttAudios.push(a);
      return a;
    };
    window.Audio.prototype = OldAudio.prototype;
    const OldPeer = window.RTCPeerConnection;
    (window as any).__vttPeers = [];
    (window as any).RTCPeerConnection = function (config: RTCConfiguration) {
      const p = new OldPeer(config);
      (window as any).__vttPeers.push(p);
      return p;
    };
    window.RTCPeerConnection.prototype = OldPeer.prototype;
    localStorage.setItem('alvorada-effects-muted', 'false');
    localStorage.setItem('alvorada-music-muted', 'false');
  });
}
try {
  for (let i = 0; i < contexts.length; i++) {
    const r = await contexts[i].request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: {
        name: i ? 'Jogador de voz' : 'Mestre de voz',
        email: randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      },
    });
    expect(r.ok()).toBe(true);
  }
  const made = await contexts[0].request.post(origin + '/api/vtt', {
    headers: { Origin: origin },
    data: { name: 'Teste de imersão' },
  });
  expect(made.ok()).toBe(true);
  const room = await made.json();
  const join = await contexts[1].request.post(origin + '/api/vtt/join', {
    headers: { Origin: origin },
    data: { invite: room.invite, role: 'player' },
  });
  expect(join.ok()).toBe(true);
  for (const p of pages) {
    await p.goto(origin + '/#vtt?room=' + room.id);
    await p.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
    await expect(p.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
    await p.getByRole('button', { name: 'Som', exact: true }).click();
    await p.getByRole('button', { name: 'Ativar áudio neste navegador', exact: true }).click();
  }
  const result = await smokeImmersiveAudio(pages[0], pages[1]);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/vtt-immersive-browser-20261026.json',
    JSON.stringify({ passed: true, ...result, errors }, null, 2),
  );
  console.log(JSON.stringify(result));
} catch (e) {
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: `test-results/vtt-immersive-failure-${i}.png` });
    console.log(
      'DIAGNOSTIC',
      i,
      JSON.stringify(
        await pages[i].evaluate(async () => ({
          audios: (window as any).__vttAudios.map((a: HTMLAudioElement) => ({
            src: a.src,
            paused: a.paused,
            ready: a.readyState,
            stream: !!a.srcObject,
            tracks: a.srcObject
              ? (a.srcObject as MediaStream)
                  .getTracks()
                  .map((t) => ({
                    id: t.id,
                    ready: t.readyState,
                    muted: t.muted,
                    enabled: t.enabled,
                  }))
              : [],
          })),
          peers: await Promise.all(
            (window as any).__vttPeers.map(async (p: RTCPeerConnection) => ({
              state: p.connectionState,
              ice: p.iceConnectionState,
              signal: p.signalingState,
              senders: p
                .getSenders()
                .map((s) => ({ track: s.track?.id, state: s.track?.readyState })),
              stats: [...(await p.getStats()).values()].filter((s: any) =>
                ['outbound-rtp', 'inbound-rtp'].includes(s.type),
              ),
            })),
          ),
          text: document.querySelector('.vtt-voice-panel')?.textContent,
        })),
      ),
    );
  }
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}

import { expect, type Page } from '@playwright/test';
import { screenEffectPresets } from '../shared/vtt-screen-effects';
import { monsterVoices } from '../shared/vtt-voice';
export async function smokeImmersiveAudio(page: Page, peer: Page) {
  await page.getByRole('button', { name: 'Músicas', exact: true }).click();
  await page.getByLabel('Cenário dos sons').selectOption('Taverna e cidade');
  await page.getByLabel('Buscar sons').fill('dia feira');
  await expect(page.locator('[data-sound-id]')).toHaveCount(1);
  await expect(page.locator('[data-sound-id="music-scene-market-day"]')).toBeVisible();
  await page.getByRole('button', { name: 'Ampliar biblioteca de sons' }).click();
  const expanded = await page.locator('.vtt-panel').boundingBox();
  expect(expanded!.width).toBeGreaterThan(600);
  await page.screenshot({ path: 'test-results/vtt-audio-expanded-20261026.png' });
  await page.getByRole('button', { name: 'Recolher biblioteca de sons' }).click();
  await page.getByRole('button', { name: 'Efeitos de tela', exact: true }).click();
  if (!(await peer.locator('.vtt-soundboard').isVisible()))
    await peer.getByRole('button', { name: 'Som', exact: true }).click();
  for (const preset of screenEffectPresets) {
    await page
      .locator('.vtt-screen-presets button')
      .filter({ has: page.getByText(preset.name, { exact: true }) })
      .click();
    await page.getByLabel('Duração do efeito de tela').fill('5');
    await page.getByRole('button', { name: 'Disparar ' + preset.name, exact: true }).click();
    await expect(peer.locator('[data-screen-effect="' + preset.id + '"]')).toBeAttached();
    await expect
      .poll(() =>
        peer.locator('.vtt-screen-overlay').evaluate((c: HTMLCanvasElement) => {
          const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
          return d.some((n, i) => i % 4 === 3 && n > 0);
        }),
      )
      .toBe(true);
    if (preset.id === 'earthquake') {
      await expect
        .poll(() => peer.locator('.vtt-workspace').evaluate((e) => e.style.translate))
        .not.toBe('');
      await page.screenshot({ path: 'test-results/vtt-screen-earthquake-20261026.png' });
      await page.getByRole('button', { name: 'Mutar som', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Ativar som', exact: true })).toBeVisible();
      await expect
        .poll(() =>
          peer.evaluate(() =>
            (window as any).__vttAudios
              .filter((a: HTMLAudioElement) => a.src.includes('sfx-screen-earthquake'))
              .every((a: HTMLAudioElement) => a.volume < 0.004),
          ),
        )
        .toBe(true);
    }
    await page.getByRole('button', { name: 'Encerrar efeito', exact: true }).click();
    await expect
      .poll(() => peer.locator('.vtt-workspace').evaluate((e) => e.style.translate))
      .toBe('');
  }
  await page.getByRole('button', { name: 'Microfone', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Microfone e vozes de monstros' }),
    other = peer.getByRole('region', { name: 'Microfone e vozes de monstros' });
  await panel.getByRole('button', { name: 'Entrar na conversa', exact: true }).click();
  await other.getByRole('button', { name: 'Entrar na conversa', exact: true }).click();
  await expect(panel.getByText(/2 na conversa/)).toBeVisible({ timeout: 15000 });
  await panel.getByRole('button', { name: 'Ativar microfone', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Desligar microfone', exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect
    .poll(() => panel.getByRole('meter').getAttribute('aria-valuenow'), { timeout: 15000 })
    .not.toBe('0');
  await expect(panel.getByText(/1 conexões de áudio/)).toBeVisible({ timeout: 20000 });
  const remoteAudio = () =>
    peer.evaluate(() =>
      (window as any).__vttAudios
        .filter((a: HTMLAudioElement) => a.srcObject instanceof MediaStream)
        .map((a: HTMLAudioElement) => ({
          paused: a.paused,
          ready: a.readyState,
          tracks: (a.srcObject as MediaStream)
            .getAudioTracks()
            .map((t) => ({ ready: t.readyState, muted: t.muted })),
        })),
    );
  await expect
    .poll(
      async () =>
        (await remoteAudio()).some(
          (a: any) => !a.paused && a.tracks.some((t: any) => t.ready === 'live' && !t.muted),
        ),
      { timeout: 30000 },
    )
    .toBe(true);
  await other.getByRole('button', { name: 'Ativar microfone', exact: true }).click();
  await expect(other.getByRole('button', { name: 'Desligar microfone', exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as any).__vttAudios.some(
            (a: HTMLAudioElement) =>
              a.srcObject instanceof MediaStream &&
              !a.paused &&
              (a.srcObject as MediaStream)
                .getAudioTracks()
                .some((t) => t.readyState === 'live' && !t.muted),
          ),
        ),
      { timeout: 30000 },
    )
    .toBe(true);
  for (const p of monsterVoices) {
    await panel
      .locator('.vtt-voice-presets button')
      .filter({ has: page.getByText(p.name, { exact: true }) })
      .click();
    await expect(panel.locator('.vtt-voice-presets button[aria-pressed="true"] strong')).toHaveText(
      p.name,
    );
  }
  await panel.getByRole('button', { name: 'Gravar fala', exact: true }).click();
  await page.waitForTimeout(1500);
  await panel.getByRole('button', { name: 'Parar gravação', exact: true }).click();
  await expect(panel.locator('audio')).toBeVisible();
  await expect
    .poll(() => panel.locator('audio').evaluate((a: HTMLAudioElement) => a.readyState))
    .toBeGreaterThanOrEqual(1);
  await panel.getByRole('button', { name: 'Tocar fala na mesa', exact: true }).click();
  await expect.poll(() => peer.evaluate(() => (window as any).__vttAudios.some((a:HTMLAudioElement) => a.src.includes('/api/vtt/assets/') && a.readyState >= 3))).toBe(true);
  await panel.getByRole('button', { name: 'Mutar minha voz', exact: true }).click();
  await expect.poll(() => panel.getByRole('meter').getAttribute('aria-valuenow')).toBe('0');
  await page.screenshot({ path: 'test-results/vtt-voice-monsters-20261026.png' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await panel.evaluate((e) => ({ width: e.clientWidth, scroll: e.scrollWidth }));
    if (bounds.scroll > bounds.width + 1)
      console.log(
        'VOICE_OVERFLOW',
        width,
        await panel.evaluate((e) =>
          [...e.querySelectorAll('*')]
            .filter((c) => c.getBoundingClientRect().right > e.getBoundingClientRect().right + 1)
            .map((c) => ({
              tag: c.tagName,
              class: c.className,
              width: c.clientWidth,
              scroll: c.scrollWidth,
              text: c.textContent?.slice(0, 80),
            })),
        ),
      );
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
    await page.screenshot({ path: `test-results/vtt-voice-${width}-20261026.png` });
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  await panel.getByRole('button', { name: 'Sair da conversa', exact: true }).click();
  await panel.getByRole('button', { name: 'Desligar microfone', exact: true }).click();
  await other.getByRole('button', { name: 'Sair da conversa', exact: true }).click();
  await other.getByRole('button', { name: 'Desligar microfone', exact: true }).click();
  await expect.poll(async () => (await remoteAudio()).every((a: any) => a.paused)).toBe(true);
  await page.getByRole('button', { name: 'Músicas', exact: true }).click();
  const stopAll=page.getByRole('button',{name:'Parar todos',exact:true});
  if(await stopAll.isEnabled())await stopAll.click();
  return {
    screenEffects: screenEffectPresets.length,
    voicePresets: monsterVoices.length,
    voiceConnection: true,
    voiceRecording: true,
    recordedVoiceShared: true,
    voiceMute: true,
    responsive: true,
    screenMute: true,
    expandedLibrary: true,
  };
}

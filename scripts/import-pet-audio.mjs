// Download freely licensed animal recordings, isolate one call and write local PCM clips.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
const sources = [
  { id: 'dog', title: 'Barking of a dog 2.ogg', length: 1.5 },
  { id: 'cat', title: 'Meow.ogg', length: 1 },
  { id: 'owl', title: 'Tawny Owl (Strix aluco) (W1CDR0001519 BD8).ogg', length: 2.5 },
  { id: 'raven', title: 'Common Raven.ogg', length: 1.7 },
  { id: 'fox', title: 'Red Fox (Vulpes vulpes) (W1CDR0001529 BD12).ogg', length: 1.7 },
  { id: 'frog', title: 'Single Frog Croak.oga', length: 1.2 },
  { id: 'guinea-pig', freesound: 583077, author: 'Breviceps', length: 1.6 },
  { id: 'rat', freesound: 143125, author: 'Zabuhailo', length: 0.9 },
];
await mkdir('.local/pet-audio', { recursive: true });
await mkdir('public/audio/pets', { recursive: true });
const manifest = [];
for (const source of sources) {
  let url, author, license, page;
  if (source.title) {
    const api = new URL('https://commons.wikimedia.org/w/api.php');
    api.search = new URLSearchParams({
      action: 'query',
      titles: 'File:' + source.title,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      format: 'json',
    });
    const response = await fetch(api).then((r) => r.json());
    const info = Object.values(response.query.pages)[0].imageinfo?.[0];
    if (!info) throw new Error('Gravação não encontrada: ' + source.title);
    url = info.url;
    const meta = info.extmetadata;
    author = ['owl', 'fox'].includes(source.id)
      ? 'The British Library Board; gravação de Aubrey John Williams'
      : meta.Artist?.value.replace(/<[^>]*>/g, '') || 'Wikimedia Commons';
    license = meta.LicenseShortName?.value;
    if (!/CC BY|CC0|Public domain|PD/i.test(license || ''))
      throw new Error('Licença não permitida: ' + license);
    page = info.descriptionurl;
  } else {
    page = `https://freesound.org/people/${source.author}/sounds/${source.freesound}/`;
    const html = await fetch(page).then((r) => r.text());
    url = html.match(/https:\/\/cdn\.freesound\.org\/previews\/[^\s<>"']+-hq\.mp3/)?.[0];
    if (!url) throw new Error('Preview indisponível.');
    author = source.author;
    license = 'CC0';
  }
  const cached = `.local/pet-audio/${source.id}`;
  let bytes;
  if (existsSync(cached)) bytes = await readFile(cached);
  else {
    const audio = await fetch(url);
    if (!audio.ok) throw new Error('Download indisponível: ' + source.id);
    bytes = Buffer.from(await audio.arrayBuffer());
  }
  await writeFile(`.local/pet-audio/${source.id}`, bytes);
  manifest.push({
    ...source,
    author,
    license,
    source: page,
    license_url:
      license === 'CC0'
        ? 'https://creativecommons.org/publicdomain/zero/1.0/'
        : license === 'Public domain'
          ? 'https://creativecommons.org/publicdomain/mark/1.0/'
          : 'https://creativecommons.org/licenses/' +
            license.toLowerCase().replace('cc ', '').replaceAll(' ', '/') +
            '/',
    changes: 'Trecho curto em mono, volume nivelado e fades; sem alteração de altura da voz.',
  });
  console.log(`${source.id}: ${license}, ${bytes.length} bytes.`);
}
const server = createServer(async (req, res) => {
  const id = req.url?.slice(1);
  if (sources.some((source) => source.id === id)) res.end(await readFile(`.local/pet-audio/${id}`));
  else {
    res.setHeader('Content-Type', 'text/html');
    res.end('<html></html>');
  }
});
await new Promise((resolve) => server.listen(3049, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3049');
  for (const source of sources) {
    const data = await page.evaluate(async ({ id, length }) => {
      const ctx = new AudioContext(),
        input = await ctx.decodeAudioData(await fetch('/' + id).then((r) => r.arrayBuffer()));
      const rate = input.sampleRate,
        mono = new Float32Array(input.length);
      for (let c = 0; c < input.numberOfChannels; c++) {
        const samples = input.getChannelData(c);
        for (let i = 0; i < samples.length; i++) mono[i] += samples[i] / input.numberOfChannels;
      }
      const frame = Math.round(rate * 0.08),
        energy = [];
      for (let i = 0; i < mono.length; i += frame) {
        let value = 0;
        for (let j = i; j < Math.min(i + frame, mono.length); j++) value += mono[j] ** 2;
        energy.push(Math.sqrt(value / frame));
      }
      const peak = Math.max(...energy),
        call = energy.findIndex((value) => value > peak * 0.65);
      const offset = Math.max(0, (call - 1) * frame),
        end = Math.min(mono.length, offset + Math.round(rate * length));
      const clip = mono.slice(offset, end);
      let maximum = 0;
      for (const value of clip) maximum = Math.max(maximum, Math.abs(value));
      for (let i = 0; i < clip.length; i++)
        clip[i] =
          (clip[i] / Math.max(0.001, maximum)) *
          0.7 *
          Math.min(1, i / (rate * 0.015), (clip.length - i) / (rate * 0.08));
      await ctx.close();
      return { rate, samples: Array.from(clip), offset: offset / rate };
    }, source);
    const wav = Buffer.alloc(44 + data.samples.length * 2);
    wav.write('RIFF');
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(data.rate, 24);
    wav.writeUInt32LE(data.rate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(data.samples.length * 2, 40);
    data.samples.forEach((value, i) => wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2));
    await writeFile(`public/audio/pets/${source.id}.wav`, wav);
    Object.assign(
      manifest.find((item) => item.id === source.id),
      {
        file: `/audio/pets/${source.id}.wav`,
        offset: data.offset,
        duration: data.samples.length / data.rate,
      },
    );
  }
  await writeFile('public/audio/pets/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(
    'public/audio/pets/CREDITS.md',
    '# Vozes dos mascotes\n\nTrechos em mono com volume nivelado e fades. A altura das vozes foi preservada. Cada áudio mantém a licença indicada.\n\n' +
      manifest
        .map(
          (item) =>
            `- **${item.id}**: [gravação original](${item.source}), ${item.author}, [${item.license}](${item.license_url}).`,
        )
        .join('\n') +
      '\n\nCobra e coelho: efeitos suaves produzidos pelo projeto (sopro e farejar), sem amostras de terceiros.\n',
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const rate = 48000;
const sources = [
  {
    id: 'shop-wood',
    title: 'Wooden Thud (Mono)',
    author: 'Breviceps',
    page: 'https://freesound.org/people/Breviceps/sounds/449955/',
    url: 'https://cdn.freesound.org/previews/449/449955_9159316-hq.mp3',
    sha256: '8f2d2c815df5c771d1fb8a97b9bea7bc75595b56de543e4922d76923303268c1',
  },
  {
    id: 'shop-bottle',
    title: 'Bottle hitting a table',
    author: 'TheMikirog',
    page: 'https://freesound.org/people/TheMikirog/sounds/331646/',
    url: 'https://cdn.freesound.org/previews/331/331646_2503553-hq.mp3',
    sha256: 'f4d390ee18285a75c3463b3baa77556b75488f51a802d1049d2cee93849cffe7',
  },
  {
    id: 'shop-liquid',
    title: 'Water Slosh in Metal Bottle - various.mp3',
    author: 'twinpix',
    page: 'https://freesound.org/people/twinpix/sounds/536953/',
    url: 'https://cdn.freesound.org/previews/536/536953_842338-hq.mp3',
    sha256: 'c188574d178a0d896541b96cea167bd57e142ae1ef9023ee98d6cacf86f8d1cc',
  },
  {
    id: 'shop-metal',
    title: 'Iron Bar Drop onto Wood & Straw Floor',
    author: 'dkudos / Paul Villeneuve e Dominic Kaiser',
    page: 'https://freesound.org/people/dkudos/sounds/213124/',
    url: 'https://cdn.freesound.org/previews/213/213124_3022067-hq.mp3',
    sha256: 'a565526b0ad673a68a53d5967c4a6d00420875e303de6d5c377a10f343dbb846',
  },
  {
    id: 'shop-chain',
    title: 'Steel - Chain drop',
    author: 'ldezem',
    page: 'https://freesound.org/people/ldezem/sounds/386213/',
    url: 'https://cdn.freesound.org/previews/386/386213_1655965-hq.mp3',
    sha256: '2e850ae42e408190c8988c404a4684d8be5725e6fb42c6ba327fd8c303544de0',
  },
  {
    id: 'shop-spheres',
    title: 'Steel Balls Dropping Into Cardboard Box.wav',
    author: 'Ted_Erski',
    page: 'https://freesound.org/people/Ted_Erski/sounds/535286/',
    url: 'https://cdn.freesound.org/previews/535/535286_5809673-hq.mp3',
    sha256: '8fe22a229ca185d88c27a00915b2838f195524dd727578b86ff6d0b47b3b8765',
  },
  {
    id: 'shop-paper',
    title: 'Paper Rustle',
    author: 'BenjaminNelan',
    page: 'https://freesound.org/people/BenjaminNelan/sounds/353125/',
    url: 'https://cdn.freesound.org/previews/353/353125_1196020-hq.mp3',
    sha256: 'fbf05bd9ba67a9df8eff656e813881c7f1a754d7473388785b228b0ed62dc564',
  },
  {
    id: 'shop-leather',
    title: 'leather_belt',
    author: 'j1987',
    page: 'https://freesound.org/people/j1987/sounds/829198/',
    url: 'https://cdn.freesound.org/previews/829/829198_367313-hq.mp3',
    sha256: '14bbbe4fe8a07a4d65fdf8ab5db4b3638813d82a68efdb6330df519d9eaffe75',
  },
  {
    id: 'shop-cloth',
    title: 'clothes drop 7',
    author: 'ZoviPoland / Bartosz Mazur',
    page: 'https://freesound.org/people/ZoviPoland/sounds/517727/',
    url: 'https://cdn.freesound.org/previews/517/517727_5845877-hq.mp3',
    sha256: '2a23b01d91367711a73c965bba9f4bfd11133fe7a25d1a90ec5e5edc46676555',
  },
  {
    id: 'shop-glass',
    title: 'place glass object.wav',
    author: 'milpower',
    page: 'https://freesound.org/people/milpower/sounds/353105/',
    url: 'https://cdn.freesound.org/previews/353/353105_6220210-hq.mp3',
    sha256: '5eec14d965f65d2915f7bb94c667cd99f2c294b5b5ef54c649a8cb77f797f845',
  },
];
await mkdir('test-results/audio-sources', { recursive: true });
await mkdir('public/audio', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage();
const decoded = {};
try {
  for (const source of sources) {
    const file = `test-results/audio-sources/${source.id}.mp3`;
    let bytes;
    try {
      bytes = await readFile(file);
    } catch {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`${source.url}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(file, bytes);
    }
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
      throw new Error(`A fonte CC0 ${source.id} mudou; revise antes de regenerar.`);
    const data = await page.evaluate(
      async ({ base64, rate }) => {
        const context = new OfflineAudioContext(1, 1, rate);
        const buffer = await context.decodeAudioData(
          Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer,
        );
        const pcm = new Float32Array(buffer.length);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const input = buffer.getChannelData(channel);
          for (let i = 0; i < pcm.length; i++) pcm[i] += input[i] / buffer.numberOfChannels;
        }
        const bytes = new Uint8Array(pcm.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 16384)
          binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
        return btoa(binary);
      },
      { base64: bytes.toString('base64'), rate },
    );
    const pcm = Buffer.from(data, 'base64');
    decoded[source.id] = new Float32Array(
      pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength),
    );
  }
} finally {
  await browser.close();
}

// Locate the first real recorded gesture; remove silence without creating a tone.
function onset(pcm, thresholdRatio = 0.16) {
  const block = Math.round(rate * 0.012);
  const energy = [];
  for (let i = 0; i < pcm.length; i += block) {
    let sum = 0;
    for (let j = i; j < Math.min(i + block, pcm.length); j++) sum += pcm[j] ** 2;
    energy.push(Math.sqrt(sum / block));
  }
  const threshold = Math.max(...energy) * thresholdRatio;
  return Math.max(0, (energy.findIndex((value) => value > threshold) * block) / rate - 0.008);
}
function layer(
  output,
  id,
  {
    at = 0,
    length,
    gain = 1,
    cutoff = 7200,
    release = 0.09,
    attack = 0.003,
    start = onset(decoded[id]),
  },
) {
  const input = decoded[id];
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  let memory = 0;
  const count = Math.min(Math.round(length * rate), input.length - Math.round(start * rate));
  for (let i = 0; i < count; i++) {
    const dst = Math.round(at * rate) + i;
    if (dst >= output.length) break;
    memory += alpha * (input[Math.round(start * rate) + i] - memory);
    const fade = Math.min(1, i / (rate * attack), (count - i) / (rate * release));
    output[dst] += memory * gain * fade;
  }
  return { id, start: Number(start.toFixed(4)), length, at, gain, cutoff, release, attack };
}
function sourceGain(id, target) {
  let peak = 0;
  for (const value of decoded[id]) peak = Math.max(peak, Math.abs(value));
  return target / Math.max(0.001, peak);
}
function peakOf(pcm) {
  let peak = 0;
  for (const value of pcm) peak = Math.max(peak, Math.abs(value));
  return peak;
}
async function wave(
  name,
  pcm,
  { targetPeak = 0.68, scale = targetPeak / Math.max(0.001, peakOf(pcm)) } = {},
) {
  const normalization = Math.min(scale, 0.68 / Math.max(0.001, peakOf(pcm)));
  const bytes = Buffer.alloc(44 + pcm.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(pcm.length * 2, 40);
  let energy = 0;
  for (let i = 0; i < pcm.length; i++) {
    const value = pcm[i] * normalization;
    energy += value ** 2;
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2);
  }
  await writeFile(`public/audio/${name}.wav`, bytes);
  return {
    file: `${name}.wav`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    duration: pcm.length / rate,
    peak: Number((peakOf(pcm) * normalization).toFixed(6)),
    gain: normalization,
    rms: Number(Math.sqrt(energy / pcm.length).toFixed(5)),
    bytes: bytes.length,
  };
}
const wood = new Float32Array(Math.round(0.55 * rate));
const woodLayers = [layer(wood, 'shop-wood', { length: 0.49, gain: sourceGain('shop-wood', 0.6) })];
// Recreate only the previous mastering gain. The approved water gesture keeps
// its exact start, filter, envelope and output gain; reducing contact must not
// cause normalization to make the slosh louder or change its pitch.
const previousLiquid = new Float32Array(Math.round(1.08 * rate));
layer(previousLiquid, 'shop-wood', {
  length: 0.35,
  gain: sourceGain('shop-wood', 0.19),
  cutoff: 5200,
});
layer(previousLiquid, 'shop-bottle', {
  length: 0.62,
  gain: sourceGain('shop-bottle', 0.51),
  cutoff: 8200,
});
const waterOptions = {
  at: 0.055,
  length: 0.93,
  gain: sourceGain('shop-liquid', 0.36),
  cutoff: 5700,
  release: 0.17,
};
layer(previousLiquid, 'shop-liquid', waterOptions);
const waterScale = 0.68 / peakOf(previousLiquid);
const water = new Float32Array(Math.round(1.08 * rate));
const waterLayer = layer(water, 'shop-liquid', waterOptions);
const liquid = water.slice();
const liquidLayers = [
  waterLayer,
  layer(liquid, 'shop-bottle', {
    length: 0.46,
    gain: sourceGain('shop-bottle', 0.095),
    cutoff: 3700,
    attack: 0.012,
    release: 0.13,
  }),
];
const waterskin = new Float32Array(Math.round(1.1 * rate));
waterskin.set(water);
const waterskinLayers = [
  waterLayer,
  layer(waterskin, 'shop-leather', {
    length: 0.5,
    gain: sourceGain('shop-leather', 0.095),
    cutoff: 1850,
    attack: 0.009,
    release: 0.15,
    start: onset(decoded['shop-leather'], 0.38),
  }),
];
const descriptions = {
  wood: 'Objeto de madeira apoiado no balcão; gravação anterior preservada.',
  liquid: 'Frasco apoiado com contato leve de vidro; água anterior intacta, sem batida de madeira.',
  waterskin: 'Recipiente de couro apoiado com água; nenhum contato de vidro.',
  metal: 'Barra de ferro sobre madeira, com corpo e ressonância curta de metal.',
  chain: 'Corrente de aço caindo, com elos que assentam em sequência.',
  spheres: 'Pequenas esferas de aço caindo e rolando; gravação de ball bearings.',
  glass: 'Recipiente de vidro apoiado, seco, sem água.',
  paper: 'Farfalhar leve de papel pousado, sem impacto pesado.',
  leather: 'Couro pousado no balcão, contato abafado e flexão do material.',
  cloth: 'Tecido pousado, contato suave e movimento das fibras.',
};
const files = {
  wood: await wave('shop-counter-wood', wood),
  liquid: await wave('shop-counter-liquid', liquid, { scale: waterScale }),
  waterskin: await wave('shop-counter-waterskin', waterskin, { scale: waterScale }),
};
const layers = { wood: woodLayers, liquid: liquidLayers, waterskin: waterskinLayers };
for (const [kind, length, targetPeak, options] of [
  ['metal', 0.86, 0.62, { cutoff: 6400, attack: 0.004, release: 0.15 }],
  ['chain', 0.76, 0.53, { cutoff: 6800, attack: 0.004, release: 0.12 }],
  ['spheres', 1.04, 0.44, { cutoff: 6500, attack: 0.004, release: 0.18 }],
  ['glass', 0.62, 0.37, { cutoff: 5900, attack: 0.008, release: 0.13 }],
  ['paper', 0.66, 0.18, { cutoff: 4500, attack: 0.018, release: 0.15 }],
  [
    'leather',
    0.66,
    0.27,
    { cutoff: 2700, attack: 0.01, release: 0.17, start: onset(decoded['shop-leather'], 0.38) },
  ],
  ['cloth', 0.68, 0.17, { cutoff: 3900, attack: 0.014, release: 0.17 }],
]) {
  const pcm = new Float32Array(Math.round(length * rate));
  layers[kind] = [layer(pcm, `shop-${kind}`, { length: length - 0.02, ...options })];
  files[kind] = await wave(`shop-counter-${kind}`, pcm, { targetPeak });
}
const finalLayers = Object.fromEntries(
  Object.entries(layers).map(([kind, value]) => [
    kind,
    value.map((layer) => ({ ...layer, finalGain: layer.gain * files[kind].gain, playbackRate: 1 })),
  ]),
);
await writeFile(
  'public/audio/shop-counter-manifest.json',
  JSON.stringify(
    {
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      checked: '2026-10-04',
      generator: 'scripts/generate-shop-counter-audio.mjs',
      encoding:
        'PCM WAV mono, 48 kHz, 16 bit; picos por material, teto de 68%. Papel, tecido e recipientes deliberadamente mais suaves.',
      composition:
        'Gravações reais CC0 de objetos de madeira, ferro, corrente de aço, esferas metálicas, vidro, papel, couro, tecido e água. Recortes, filtragem e mixagem; nenhum bip, oscilador ou som sintetizado.',
      playback:
        'Impacto proporcional ao peso e tamanho, pitch entre 0,80 e 1,10 com variação pequena; mesmo volume/mute do site; vozes canceladas e contexto encerrado ao ocultar ou sair.',
      files,
      descriptions,
      waterPreservation: {
        previousMixNormalization: waterScale,
        finalGain: waterLayer.gain * waterScale,
        source: waterLayer,
        unchanged:
          'Mesmo segmento, ganho de saída, afinação, filtro e envelope da camada água anterior. Somente o contato do frasco foi amaciado e reduzido; a madeira foi removida.',
      },
      layers: finalLayers,
      sources: sources.map((source) => ({ ...source, license: 'CC0-1.0', publicPreview: true })),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({ files, waterScale, waterFinalGain: waterLayer.gain * waterScale }, null, 2),
);

// Explicit offline maintenance. Fetch only author pages and their published CC0 files.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const dir = '.local/vtt-audio-sources-20261026/';
await mkdir(new URL(dir, root), { recursive: true });
const definitions = [
  ['market-day','medieval-market-day','RandomMind','Loop_Market_Day.wav'],
  ['minstrel-dance','medieval-minstrel-dance','RandomMind',null],
  ['rejoicing','medieval-rejoicing','RandomMind','Loop_Rejoicing.wav'],
  ['harvest','medieval-harvest-season','RandomMind',null],
  ['final-battle','the-final-battle','skrjablin','the_final_battle.ogg'],
  ['hope','hopeorchestral-battle-music','MintoDog','hope_orchestral_battle_music_bpm165.flac'],
  ['orchestral-theme','fantasy-orchestral-theme','Joth','FantasyOrchestralTheme.mp3'],
  ['home','at-home-orchestral','Wolfgang_','cinematic-calm.wav'],
  ['dungeon','dungeon-ambience','yd','dungeon002.ogg'],
  ['evil-approach','evil-approach','nene',null],
  ['dark-shrine','dark-shrine-loop','qubodup',null],
  ['serpents','ancient-power-of-serpents','josepharaoh99',null],
  ['foley','100-cc0-sfx-2','rubberduck','sfx_100_v2.zip'],
  ['park-birds','park-ambiences','Thimras','park_ambience_birds.wav'],
  ['park-river','park-ambiences','Thimras','park_ambience_river.wav'],
  ['park-wind','park-ambiences','Thimras','park_ambience_wind.wav'],
];
const sha = b => createHash('sha256').update(b).digest('hex');
const existing = JSON.parse(await readFile(new URL('public/audio/vtt/manifest.json', root))).sources;
const sources = [];
for (const [key, slug, author, preferred] of definitions) {
  const page = 'https://opengameart.org/content/' + slug;
  const response = await fetch(page);
  if (!response.ok) throw Error('Source page: ' + slug + ' ' + response.status);
  const html = await response.text();
  if (!/creativecommons\.org[^"\s<>]*\/zero\//i.test(html)) throw Error('CC0 not verified: ' + slug);
  const urls = [...new Set([...html.matchAll(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"<>]+\.(?:wav|flac|ogg|mp3|zip))"/gi)].map(m=>m[1].replaceAll('&amp;', '&')))];
  const url = (preferred && urls.find(u => decodeURIComponent(u).endsWith('/' + preferred))) ||
    urls.find(u => /loop/i.test(u) && /\.(wav|flac|ogg)$/i.test(u)) ||
    urls.find(u => /\.(wav|flac|ogg)$/i.test(u)) || urls[0];
  if (!url) throw Error('No audio: ' + slug);
  if (existing.some(s=>s.url===url)) throw Error('Already in library: '+key);
  const file = dir + key + new URL(url).pathname.match(/\.[^.]+$/)[0];
  let bytes;
  try { bytes = await readFile(new URL(file, root)); }
  catch { const r = await fetch(url); if (!r.ok) throw Error('Download: '+key); bytes = Buffer.from(await r.arrayBuffer()); await writeFile(new URL(file, root),bytes); }
  const source = { slug:'audio-20261026-'+key, page, url, file, author, license:'CC0-1.0', licenseVerified:'2026-10-26', bytes:bytes.length, sha256:sha(bytes), pageSha256:sha(html) };
  sources.push(source);
  await writeFile(new URL(dir+'sources.json',root),JSON.stringify(sources,null,2)+'\n');
  console.log(key, Math.round(bytes.length/1024)+' KB', decodeURIComponent(new URL(url).pathname.split('/').pop()));
}
await writeFile(new URL('data/vtt/audio-expansion-20261026-sources.json',root),JSON.stringify({date:'2026-10-26',sources},null,2)+'\n');

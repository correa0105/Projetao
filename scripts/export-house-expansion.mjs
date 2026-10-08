import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const catalog = JSON.parse(await fs.readFile('data/house-expansion-20261008.json', 'utf8'));
const manifest = JSON.parse(
  await fs.readFile('public/house/items/house-expansion-20261008/art-manifest.json', 'utf8'),
);
if (
  !manifest.complete ||
  !manifest.calibrated ||
  catalog.length !== 40 ||
  manifest.assets.length !== 320
)
  throw Error('Complete and review all 320 images before exporting.');
const directions = [
  'Frente',
  'Frente-direita',
  'Direita',
  'Trás-direita',
  'Trás',
  'Trás-esquerda',
  'Esquerda',
  'Frente-esquerda',
];
const names = [
  'frente',
  'frente-direita',
  'direita',
  'tras-direita',
  'tras',
  'tras-esquerda',
  'esquerda',
  'frente-esquerda',
];
const pad = (n) => String(n).padStart(2, '0');
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exportRoot = path.resolve('.local/house-export-' + randomUUID());
const downloads = path.join(homedir(), 'Downloads');
await fs.mkdir(downloads, { recursive: true });
let destination = path.join(downloads, 'House-40-pecas-320-vistas-20261008.zip');
if (
  await fs.stat(destination).then(
    () => true,
    () => false,
  )
)
  destination = path.join(downloads, 'House-40-pecas-320-vistas-20261008-' + Date.now() + '.zip');
await fs.mkdir(exportRoot, { recursive: true });
const records = [],
  sections = [],
  toc = [];
for (const [index, item] of catalog.entries()) {
  const folder = pad(index + 1) + '-' + item.id;
  await fs.mkdir(path.join(exportRoot, folder), { recursive: true });
  const figures = [];
  for (let facing = 0; facing < 8; facing++) {
    const image = manifest.assets.find((a) => a.id === item.id && a.facing === facing);
    if (!image) throw Error('Missing export image: ' + item.id + '/' + facing);
    const bytes = await fs.readFile(image.original_source);
    if (sha(bytes) !== image.source_sha256)
      throw Error('Original artwork changed: ' + image.original_source);
    const relative = folder + '/' + pad(facing + 1) + '-' + names[facing] + '.png';
    await fs.writeFile(path.join(exportRoot, relative), bytes);
    records.push({
      item: item.id,
      name: item.name,
      facing,
      direction: directions[facing],
      path: relative,
      sha256: sha(bytes),
      generator: image.generator,
      prompt: image.prompt,
    });
    figures.push(
      '<figure><a href="' +
        relative +
        '" target="_blank"><img loading="lazy" decoding="async" src="' +
        relative +
        '" alt="' +
        escape(item.name + ' · ' + directions[facing]) +
        '"></a><figcaption>' +
        pad(facing + 1) +
        ' · ' +
        directions[facing] +
        '</figcaption></figure>',
    );
  }
  toc.push('<a href="#' + item.id + '">' + pad(index + 1) + ' · ' + escape(item.name) + '</a>');
  sections.push(
    '<section id="' +
      item.id +
      '" data-name="' +
      escape(item.name) +
      '"><h2>' +
      pad(index + 1) +
      ' · ' +
      escape(item.name) +
      '</h2><div class="views">' +
      figures.join('') +
      '</div></section>',
  );
}
await fs.writeFile(
  path.join(exportRoot, 'catalogo.html'),
  '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>House · 40 peças, 320 vistas</title><style>body{margin:0;background:#24211c;color:#efe6d5;font:16px Georgia,serif}header,main{max-width:1680px;margin:auto;padding:24px}h1{font-size:30px;color:#d7b477}p{color:#c7bda8}input{box-sizing:border-box;width:100%;max-width:440px;padding:12px;background:#15130f;color:#eee;border:1px solid #746144;border-radius:5px;font:inherit}nav{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}nav a{color:#dcc291;text-decoration:none;padding:6px 8px;border:1px solid #4f4433;border-radius:4px;font-size:13px}section{margin-bottom:36px;padding-top:12px;border-top:1px solid #514534}h2{font-weight:normal;color:#d7b477}.views{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:12px}figure{margin:0;text-align:center}img{width:100%;height:230px;object-fit:contain}figcaption{padding-top:10px;font-size:13px;color:#c9b993}section[hidden]{display:none}@media(max-width:1300px){.views{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:620px){header,main{padding:16px}.views{grid-template-columns:repeat(2,minmax(0,1fr))}img{height:210px}}</style><header><h1>House · 40 peças, 320 vistas</h1><p>As oito vistas de cada peça estão juntas, da frente até a frente esquerda, em sequência. Clique em uma imagem para abrir o PNG original com transparência.</p><label>Buscar peça<br><input id="search" type="search" placeholder="Mesa, estátua, pergaminhos…"></label><nav>' +
    toc.join('') +
    '</nav></header><main>' +
    sections.join('') +
    '</main><script>const fold=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();document.getElementById("search").addEventListener("input",e=>{const q=fold(e.target.value);document.querySelectorAll("section").forEach(s=>s.hidden=!fold(s.dataset.name).includes(q))});</script></html>',
);
await fs.writeFile(
  path.join(exportRoot, 'manifest.json'),
  JSON.stringify(
    { models: 40, images: 320, sequence: directions, images_by_piece: records },
    null,
    2,
  ),
);
await fs.writeFile(
  path.join(exportRoot, 'LEIA-ME.txt'),
  'House — 40 peças e 320 imagens PNG originais com transparência.\r\n\r\nExtraia este ZIP e abra catalogo.html para ver as oito vistas de cada peça juntas.\r\nAs pastas 01 a 40 agrupam cada peça. Dentro delas, as imagens 01 a 08 seguem a mesma ordem de direção.\r\nmanifest.json registra os nomes, direções, hashes e prompts das artes aprovadas.\r\n',
);
if (process.platform !== 'win32')
  throw Error(
    'This export uses Windows ZIP compression. The assembled collection is at ' + exportRoot,
  );
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const command =
  'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(' +
  quote(exportRoot) +
  ', ' +
  quote(destination) +
  ', [System.IO.Compression.CompressionLevel]::Fastest, $false)';
await new Promise((resolve, reject) => {
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    windowsHide: true,
    stdio: 'inherit',
  });
  child.on('error', reject);
  child.on('exit', (code) =>
    code === 0 ? resolve() : reject(Error('ZIP export failed: ' + code)),
  );
});
const result = {
  destination,
  bytes: (await fs.stat(destination)).size,
  models: 40,
  images: 320,
  gallery: path.join(exportRoot, 'catalogo.html'),
};
await fs.writeFile('.local/house-expansion-export.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));

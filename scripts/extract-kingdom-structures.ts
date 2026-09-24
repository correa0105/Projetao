import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { frames, type KingdomSpriteKind } from '../src/kingdom-scene.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(root, 'public', 'kingdom', 'structures');
const directions = ['sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'nordeste', 'leste', 'sudeste'];
const names: Partial<Record<KingdomSpriteKind, string>> = {
  fortress: 'fortaleza', tower: 'torre', inn: 'estalagem', harbor: 'capitania',
  totem: 'totem', cottage: 'casa-simples', shop: 'loja', chapel: 'capela',
  townhouse: 'sobrado', stable: 'estabulo', townhall: 'prefeitura',
  warehouse: 'armazem', sailboat: 'veleiro', forge: 'forja', granary: 'celeiro',
  tavern: 'taverna', ranger: 'casa-dos-patrulheiros', stoneCircle: 'circulo-de-pedras',
  barracks: 'quartel',
};
const atlasFiles: Record<string, string> = {
  structures: 'structures.png', landmarks: 'landmarks.png',
  settlements: 'settlements.png', town: 'town-buildings.png',
  seaport: 'harbor-buildings.png', craft: 'craft-buildings.png',
  frontier: 'frontier-buildings.png',
};

const catalog: Array<{ name: string; atlas: string; directions: Record<string, string> }> = [];
for (const [kind, name] of Object.entries(names) as Array<[KingdomSpriteKind, string]>) {
  const frame = frames[kind];
  const atlas = atlasFiles[frame.sheet];
  if (!atlas) throw new Error(`Atlas desconhecido para ${kind}: ${frame.sheet}`);
  const folder = join(destination, name);
  await mkdir(folder, { recursive: true });
  const source = sharp(join(destination, 'atlases', atlas));
  const paths: Record<string, string> = {};
  for (let index = 0; index < directions.length; index++) {
    const direction = directions[index];
    const filename = `${direction}.png`;
    await source.clone().extract({
      left: frame.columns[index], top: frame.y,
      width: frame.columns[index + 1] - frame.columns[index], height: frame.height,
    }).png().toFile(join(folder, filename));
    paths[direction] = `${name}/${filename}`;
  }
  catalog.push({ name, atlas: `atlases/${atlas}`, directions: paths });
}
await writeFile(join(destination, 'catalogo.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`${catalog.length} estruturas organizadas em oito direções (${catalog.length * 8} arquivos).`);

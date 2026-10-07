import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/** Compact client metadata from actual artwork provenance, never from .svg vs .webp. */
export async function writeThematicSkinIds({ catalog, old, skins }) {
  const expanded = JSON.parse(await fs.readFile('public/shop/expanded/art-manifest.json', 'utf8'));
  const illustrated = JSON.parse(
    await fs.readFile('public/shop/magic-skins/art-manifest.json', 'utf8'),
  ).assets;
  const native = new Map(
    [...expanded, ...illustrated].map((asset) => [asset.path.replace(/^public/, ''), asset]),
  );
  const sourceItems = new Map(catalog.map((item) => [item.id, item]));
  const bases = new Map([...old, ...catalog].map((item) => [item.id, item]));
  const skinById = new Map(skins.map((skin) => [skin.id, skin]));
  const verified = new Set();
  const ids = [];
  for (const item of catalog) {
    const raw = item.raw_data || {};
    if (!raw.magic_family || !raw.base_item || bases.get(raw.base_item)?.category !== 'Armas')
      continue;
    const skin = skinById.get(item.id);
    // A thematic raster was generated as a whole weapon. Coating0.32 keeps that
    // original design; coating1 is only a finish over the ordinary base weapon.
    const reference = skin ? (skin.coating === 0.32 ? skin.reference : null) : item.image_path;
    const artwork = reference && native.get(reference);
    const original = artwork && sourceItems.get(artwork.id);
    if (
      !artwork ||
      !original ||
      !artwork.prompt ||
      !/image.?gen/i.test(artwork.generator || artwork.mode || '')
    )
      continue;
    if (
      original.raw_data?.magic_family !== raw.magic_family ||
      original.raw_data?.base_item !== raw.base_item
    )
      continue;
    if (!/^\/shop\/[a-zA-Z0-9/_-]+\.(png|webp)$/.test(reference))
      throw Error('Unsafe thematic reference: ' + reference);
    if (!verified.has(reference)) {
      const bytes = await fs.readFile('public' + reference);
      if (createHash('sha256').update(bytes).digest('hex') !== artwork.sha256)
        throw Error('Thematic artwork hash changed: ' + reference);
      verified.add(reference);
    }
    ids.push(item.id);
  }
  ids.sort();
  await fs.writeFile('shared/shop-thematic-skin-ids.json', JSON.stringify(ids, null, 2) + '\n');
  return { thematic_variants: ids.length, verified_original_artworks: verified.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalog = JSON.parse(await fs.readFile('data/emporium-expansion.json', 'utf8')).items;
  const old = JSON.parse(await fs.readFile('data/shop-export/loja.json', 'utf8')).items;
  const skins = JSON.parse(
    await fs.readFile('public/shop/magic-skins/skin-manifest.json', 'utf8'),
  ).assets;
  console.log(JSON.stringify(await writeThematicSkinIds({ catalog, old, skins })));
}

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const jobs = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const manifests = new Map();
for (const job of jobs) {
  if (!job.path) throw new Error(`Missing generated asset: ${job.id}`);
  await fs.mkdir(path.dirname(job.output), { recursive: true });
  const source = await fs.readFile(job.path);
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha && !job.material) throw new Error(`Missing alpha: ${job.id}`);
  await sharp(source)
    .resize({
      width: job.material ? 512 : 768,
      height: job.material ? 512 : 768,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toFile(job.output);
  const bytes = await fs.readFile(job.output);
  const directory = path.dirname(job.output);
  const manifest = manifests.get(directory) || [];
  manifest.push({
    id: job.id,
    path: '/' + job.output.replace(/^public\//, ''),
    mode: 'built-in image_gen',
    prompt: job.prompt,
    original_file: path.basename(job.path),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    alpha: metadata.hasAlpha,
  });
  manifests.set(directory, manifest);
}
for (const [directory, assets] of manifests) {
  const output = path.join(directory, 'art-manifest.json');
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(output, 'utf8')).assets || [];
  } catch {}
  const added = new Set(assets.map((x) => x.id));
  await fs.writeFile(
    output,
    JSON.stringify(
      {
        mode: 'built-in image_gen',
        assets: [...existing.filter((x) => !added.has(x.id)), ...assets],
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(`Saved ${jobs.length} generated equipment assets.`);

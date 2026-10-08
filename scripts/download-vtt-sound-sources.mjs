import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
// Explicit maintenance command; never run as part of deploy/seed/startup.
const { sources } = JSON.parse(await readFile('public/audio/vtt/manifest.json', 'utf8'));
await mkdir('.local/vtt-sound-sources', { recursive: true });
for (const source of sources) {
  const url = new URL(source.url);
  if (
    url.protocol !== 'https:' ||
    !['opengameart.org', 'kenney.nl'].includes(url.hostname) ||
    !/^[a-z0-9-]+$/.test(source.slug)
  )
    throw Error('Invalid source.');
  const extension = url.pathname.match(/\.(mp3|wav|ogg|zip|7z)$/)?.[0];
  if (!extension) throw Error('Invalid audio format.');
  const response = await fetch(url);
  if (!response.ok) throw Error('Download failed: ' + source.slug);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
    throw Error('Source changed: ' + source.slug);
  const target = source.file || '.local/vtt-sound-sources/' + source.slug + extension;
  const resolved = path.resolve(target),
    local = path.resolve('.local') + path.sep;
  if (!resolved.startsWith(local)) throw Error('Invalid source destination.');
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, bytes);
  console.log(source.slug, bytes.length);
}
await writeFile('.local/vtt-sound-sources/sources.json', JSON.stringify(sources, null, 2));
await mkdir('.local/vtt-sound-expansion', { recursive: true });
await writeFile(
  '.local/vtt-sound-expansion/sources.json',
  JSON.stringify(
    sources.filter((s) => s.file?.startsWith('.local/vtt-sound-expansion/')),
    null,
    2,
  ),
);

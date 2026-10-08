import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
  const extension = url.pathname.match(/\.(mp3|wav|ogg|zip)$/)?.[0];
  if (!extension) throw Error('Invalid audio format.');
  const response = await fetch(url);
  if (!response.ok) throw Error('Download failed: ' + source.slug);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
    throw Error('Source changed: ' + source.slug);
  await writeFile('.local/vtt-sound-sources/' + source.slug + extension, bytes);
  console.log(source.slug, bytes.length);
}
await writeFile('.local/vtt-sound-sources/sources.json', JSON.stringify(sources, null, 2));

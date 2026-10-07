import { readFile, mkdir, writeFile } from 'node:fs/promises';

// Keep inventory piece symbols in the same native icon style as their equipment slots.
for (const [source, directory] of [
  ['src/EquipmentIcon.tsx', 'public/shop/equipment'],
  ['src/CompanionEquipmentIcon.tsx', 'public/shop/animal-equipment'],
]) {
  const text = await readFile(source, 'utf8');
  await mkdir(directory, { recursive: true });
  for (const slot of ['head', 'armor', 'shoulders', 'bracers', 'legs', 'feet']) {
    const match = text.match(new RegExp(`  ${slot}:\\s*'([^']+)'`));
    if (!match) throw new Error(`Missing ${slot} in ${source}`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#c7aa6f" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="${match[1]}"/></svg>\n`;
    await writeFile(`${directory}/armor-piece-${slot}.svg`, svg);
    if (source.includes('Companion')) {
      for (const target of ['mount', 'pet']) {
        let path = match[1];
        if (target === 'mount' && (slot === 'feet' || slot === 'head')) {
          const name = slot === 'feet' ? 'horseshoe' : 'chamfron';
          path = text.match(new RegExp(`const ${name} =\\s*'([^']+)'`))[1];
        }
        await writeFile(
          `${directory}/armor-piece-${target}-${slot}.svg`,
          svg.replace(match[1], path),
        );
      }
    }
  }
}

import sharp from 'sharp';

// The original hand-painted source is top-down. The Canvas projection in
// kingdom-scene.ts gives both the ground and trails the same perspective.
const source = 'docs/references/kingdom-ground-paths-source.png';
const output = 'public/kingdom/ground-trails.png';
await sharp(source)
  .resize(3072, 3072, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toFile(output);
console.log(`Solo e trilhas preparados: ${output}`);

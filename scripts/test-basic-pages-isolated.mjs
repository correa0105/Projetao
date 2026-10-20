import fs from 'node:fs/promises';
let s=await fs.readFile('scripts/test-vtt-residents-isolated.mjs','utf8');
s=s.replace('scripts/smoke-vtt-residents-25.ts','scripts/smoke-basic-pages.ts');
await fs.mkdir('.local',{recursive:true});
await fs.writeFile('.local/run-basic-pages-isolated.mjs',s);
await import('../.local/run-basic-pages-isolated.mjs');

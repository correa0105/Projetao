import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {gzipSync} from 'node:zlib';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import retirement from './data/public-image-retirements-20261029.json';
import {pruneRetiredPublicImages} from './scripts/public-image-retirement';

export default defineConfig({
  plugins: [react(),{
    name:'retired-public-images',
    async writeBundle(options){await pruneRetiredPublicImages(resolve(options.dir||'dist/client'),retirement);},
  },{
    name:'compressed-build-assets',
    async writeBundle(options,bundle){
      await Promise.all(Object.values(bundle).filter(output=>/\.(js|css)$/.test(output.fileName)).map(async output=>{
        const file=resolve(options.dir||'dist/client',output.fileName);
        await writeFile(file+'.gz',gzipSync(await readFile(file),{level:6}));
      }));
    },
  }],
  build: { outDir: 'dist/client' },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:3000' } },
});

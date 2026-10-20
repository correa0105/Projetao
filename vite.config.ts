import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {gzip, brotliCompress, constants} from 'node:zlib';
import {promisify} from 'node:util';
const zip=promisify(gzip), brotli=promisify(brotliCompress);
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export default defineConfig({
  plugins: [react(),{
    name:'compressed-build-assets',
    async writeBundle(options,bundle){
      await Promise.all(Object.values(bundle).filter(output=>/\.(js|css)$/.test(output.fileName)).map(async output=>{
        const file=resolve(options.dir||'dist/client',output.fileName);
        const body=await readFile(file);
        await Promise.all([
          zip(body,{level:9}).then(bytes=>writeFile(file+'.gz',bytes)),
          brotli(body,{params:{[constants.BROTLI_PARAM_QUALITY]:6}}).then(bytes=>writeFile(file+'.br',bytes)),
        ]);
      }));
    },
  }],
  build: { outDir: 'dist/client' },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:3000' } },
});

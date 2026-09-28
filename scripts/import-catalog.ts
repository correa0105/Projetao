// Catalog values are an audited SRD 5.2.1 snapshot. Never reimport 2014 data over it.
import { readFile } from 'node:fs/promises';
const catalog=JSON.parse(await readFile('data/catalog.json','utf8'));
if(catalog.edition!=='SRD 5.2.1 / 2024'||catalog.items.length!==8)throw new Error('Snapshot SRD inesperado.');
for(const item of catalog.items)if(!Number.isSafeInteger(item.price_cp)||item.price_cp<=0)throw new Error('Preço inválido.');
console.log('Snapshot oficial SRD 5.2.1 validado. Use npm run db:seed para sincronizar. Fonte: '+catalog.source);

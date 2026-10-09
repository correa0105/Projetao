import {readFile,writeFile} from 'node:fs/promises';
import {weaponData} from '../shared/character-sheet.js';
const aliases:Record<string,string>={};
for(const path of ['data/shop-export/loja.json','data/emporium-expansion.json']){
 const data=JSON.parse(await readFile(path,'utf8'));
 for(const item of data.items||data)if(weaponData[item.name]&&!item.raw_data?.base_item)aliases[item.id]=item.name;
}
if(aliases.flail!=='Mangual'||aliases.greatsword!=='Espada grande'||aliases.javelin!=='Azagaia')throw Error('Missing basic weapon aliases');
await writeFile('shared/catalog-weapon-names.json',JSON.stringify(aliases,null,2));console.log('Mapped',Object.keys(aliases).length,'catalog weapon IDs.');

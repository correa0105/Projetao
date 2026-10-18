import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const rows=[
['cosmetic-shirt-linen','Camiseta de linho',120,0.5,'armor','cloth','Camiseta de linho cru, mangas curtas e gola com cordão. Costuras simples para o dia a dia.','Linho leve para a estrada. A gola abre sem precisar lutar com os botões.'],
['cosmetic-shirt-cotton','Camiseta de algodão',180,0.5,'armor','cloth','Camiseta verde de algodão, mangas curtas e acabamento ocre na bainha.','Algodão macio e verde discreto. Combina com descanso depois de uma boa caminhada.'],
['cosmetic-trousers-travel','Calça de viagem',250,1.5,'legs','cloth','Calça medieval de linho castanho, pernas soltas e cintura fechada por cordão.','Linho castanho e cordão na cintura. Uma peça simples para seguir pela estrada.'],
['cosmetic-trousers-wool','Calça de lã',300,2,'legs','cloth','Calça de lã cinza escura, corte reto e costuras firmes.','Lã cinza para uma manhã fresca. O barro costuma preferir a barra.'],
['cosmetic-shoes-leather','Sapatos de couro',350,1.5,'feet','leather','Par de sapatos baixos de couro castanho, pequenas fivelas de latão e sola costurada.','Couro castanho, fivela pequena e sola firme. Uma escova devolve a apresentação depois da viagem.'],
['cosmetic-sandals-road','Sandálias de estrada',100,1,'feet','leather','Par de sandálias de couro com tiras cruzadas e sola de camadas costuradas.','Sandálias leves para a estrada seca. Tire as pedrinhas antes do próximo trecho.'],
['cosmetic-outfit-traveler','Traje de viajante',1200,5,'armor','cloth','Conjunto visual com túnica verde-oliva, cinto, calça castanha e botas. Equipado como uma peça de traje no espaço do peitoral; não entrega peças avulsas.','O traje reúne túnica, cinto, calça e botas numa só peça de aparência. A mochila fica por sua conta.'],
['cosmetic-tunic-road','Túnica de estrada',450,1.5,'armor','cloth','Túnica azul-ardósia de mangas compridas, cinto castanho e bordado claro na gola.','Túnica azul com um bordado discreto. O cinto ajuda a manter o tecido fora do caminho.']
];
const file='data/emporium-expansion.json',catalog=JSON.parse(await fs.readFile(file,'utf8')),before=structuredClone(catalog.items);
const equipment=JSON.parse(await fs.readFile('shared/emporium-equipment.json','utf8')),materials=JSON.parse(await fs.readFile('shared/emporium-materials.json','utf8'));
const additions=rows.map(([id,name,price_cp,weight_lb,slot,material,description,merchant_comment])=>({
id,name,original_name:name,category:'Cosméticos',price_cp,weight_lb,weight_estimated:true,
description:description+' Roupa cosmética sem bônus de CA, resistência ou efeito mágico. Preço e peso definidos pelo Empório.',
merchant_comment,source:'Conteúdo original da Alvorada Cinzenta',source_url:'',
image_path:'/shop/clothing-20261018/'+id+'.webp',audio_path:'/audio/emporium/'+id+'.wav',
raw_data:{cosmetic:true,cosmetic_type:slot,equipment_slots:[slot],sound_material:material,clothing_collection:'20261018',price_basis:'Preço próprio do Empório; não é valor de regra oficial.'}
}));
for(const x of additions){const old=catalog.items.find(y=>y.id===x.id);if(old)assert.deepEqual(old,x);else catalog.items.push(x);equipment[x.id]={slots:x.raw_data.equipment_slots,two_handed:false};materials[x.id]=x.raw_data.sound_material;}
assert.deepEqual(catalog.items.slice(0,before.length),before);
await fs.writeFile(file,JSON.stringify(catalog,null,2)+'\n');
await fs.writeFile('shared/emporium-equipment.json',JSON.stringify(equipment,null,2)+'\n');
await fs.writeFile('shared/emporium-materials.json',JSON.stringify(materials,null,2)+'\n');
const prior=JSON.parse(await fs.readFile('data/shop-clothing-20261018.json','utf8').catch(()=>'{"ready":false}'));
await fs.writeFile('data/shop-clothing-20261018.json',JSON.stringify({ready:prior.ready===true,items:additions},null,2)+'\n');
console.log(JSON.stringify({added:additions.length,previousItemsPreserved:before.length}));

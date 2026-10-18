import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const definitions=[
['cosmetic-shirt-linen','ivory','Cru'],['cosmetic-shirt-cotton','forest','Verde-musgo'],['cosmetic-trousers-travel','brown','Castanho'],['cosmetic-trousers-wool','charcoal','Carvão'],['cosmetic-shoes-leather','brown','Castanho'],['cosmetic-sandals-road','tan','Caramelo'],['cosmetic-outfit-traveler','forest','Verde-musgo'],['cosmetic-tunic-road','blue','Azul-anil']];
const palette=[['ivory','Cru'],['forest','Verde-musgo'],['blue','Azul-anil'],['wine','Vinho'],['charcoal','Carvão']];
const descriptions = {
 'cosmetic-shirt-linen':'Camiseta medieval de linho, mangas curtas e gola fechada por cordão.',
 'cosmetic-shirt-cotton':'Camiseta medieval de algodão, mangas curtas, gola com cordões e bordados na bainha.',
 'cosmetic-trousers-travel':'Calça medieval de linho, pernas soltas e cintura fechada por cordão.',
 'cosmetic-trousers-wool':'Calça medieval de lã, corte reto e costuras firmes.',
 'cosmetic-shoes-leather':'Par de sapatos baixos de couro, pequenas fivelas de latão e sola costurada.',
 'cosmetic-sandals-road':'Par de sandálias de couro com tiras cruzadas e sola de camadas costuradas.',
 'cosmetic-outfit-traveler':'Conjunto visual com túnica, cinto, calça e botas. A cor escolhida se aplica à túnica; cinto, calça e botas permanecem castanhos. Equipado como uma peça no espaço do peitoral; não entrega peças avulsas.',
 'cosmetic-tunic-road':'Túnica medieval de mangas compridas, cinto castanho e bordado claro na gola.'
};
const source=JSON.parse(await fs.readFile('data/shop-clothing-20261018.json','utf8')),catalog=JSON.parse(await fs.readFile('data/emporium-expansion.json','utf8')),lookup={},items=[];
for(const[model,original,label]of definitions){
 const base=source.items.find(x=>x.id===model);assert(base);const colors=['brown','tan'].includes(original)?[[original,label],...palette.filter(c=>c[0]!=='ivory')]:palette;
 for(const[color,colorName]of colors){
  const id=color===original?model:model+'-'+color;
  lookup[id]={model,name:base.name,color,label:colorName};
  const item={...structuredClone(base),id,name:base.name+' ('+colorName+')',original_name:base.name+' ('+colorName+')',
   description:descriptions[model]+' Cor: '+colorName+'. Roupa cosmética sem bônus de CA, resistência ou efeito mágico. Preço e peso definidos pelo Empório.',
   merchant_comment:base.name+' na cor '+colorName.toLocaleLowerCase('pt-BR')+'. '+descriptions[model],
   image_path:color===original?base.image_path:'/shop/clothing-colors-20261018/'+id+'.webp',
   audio_path:color===original?base.audio_path:'/audio/emporium/'+id+'.wav',
   raw_data:{...base.raw_data,base_item:model,clothing_model:model,clothing_color:color,clothing_color_label:colorName}};
  items.push(item);const index=catalog.items.findIndex(x=>x.id===id);if(index>=0)catalog.items[index]=item;else catalog.items.push(item);
 }
}
assert.equal(items.length,40);
await fs.writeFile('shared/clothing-colors.json',JSON.stringify(lookup,null,2)+'\n');
await fs.writeFile('data/shop-clothing-colors-20261018.json',JSON.stringify({ready:false,items},null,2)+'\n');
await fs.writeFile('data/emporium-expansion.json',JSON.stringify(catalog,null,2)+'\n');
console.log('Prepared 8 clothing models, 5 real colors each; original inventory IDs preserved.');

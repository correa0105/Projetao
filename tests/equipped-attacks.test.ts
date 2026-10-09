import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equippedAttacks,type CombatItem} from '../shared/equipped-attacks';
import {defaultChoices} from '../shared/character-sheet';
const character={race:'Elfo',class:'Guerreiro',stats:[14,12,14,10,10,10]},choices=defaultChoices(character.race,character.class);
const item=(id:string,name:string,extra:Partial<CombatItem>={}):CombatItem=>({id,name,quantity:1,equipped:['main_hand'],image_path:'/shop/items/'+id+'.png',...extra});
test('weapon attacks follow owned equipment rather than creation choices',()=>{
 assert.deepEqual(equippedAttacks(character,choices,[]),[]);
 assert.deepEqual(equippedAttacks(character,choices,[item('flail','Mangual',{equipped:[]})]),[]);
 assert.deepEqual(equippedAttacks(character,choices,[item('flail','Mangual',{quantity:0})]),[]);
 const actual=equippedAttacks(character,choices,[item('dagger','Adaga',{equipped:['off_hand']})]);
 assert.equal(actual.length,1);assert.equal(actual[0].itemId,'dagger');assert.equal(actual[0].image_path,'/shop/items/dagger.png');
 assert.equal(actual[0].attack,4);
});
test('catalog variants use base weapon mechanics and retain their own art',()=>{
 const actual=equippedAttacks(character,choices,[item('magic-greatsword-test','Espada encantada',{raw_data:{base_item:'greatsword'}})]);
 assert.equal(actual.length,1);assert.equal(actual[0].name,'Espada encantada');assert.equal(actual[0].baseName,'Espada grande');assert.equal(actual[0].dice,'2d6');assert.equal(actual[0].twoHanded,true);
 assert.deepEqual(equippedAttacks(character,choices,[item('leather-armor','Armadura de couro'),item('dog-flail','Mangual',{raw_data:{equipment_target:'dog'}})]),[]);
 assert.equal(equippedAttacks(character,choices,[item('flail','Mangual'),item('flail','Mangual',{equipped:['off_hand']})]).length,1);
});

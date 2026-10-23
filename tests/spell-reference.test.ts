import {test} from 'node:test';
import assert from 'node:assert/strict';
import references from '../data/spell-reference-2024.json' with {type:'json'};
import {spells} from '../shared/character-sheet.js';
import {spellReference} from '../server/spell-reference.js';
import mechanics from '../data/spell-mechanics-audit-20261023.json' with {type:'json'};

test('todas as magias de evolução têm consulta na mesma edição, círculo e fonte',async()=>{
 assert.equal(references.length,spells.length);
 assert.equal(new Set(references.map(s=>s.id)).size,spells.length);
 for(const s of spells){const r=references.find(r=>r.id===s.id)!;assert(r,s.id);assert.equal(r.level,s.level);assert.equal(r.source,s.source);assert.equal(r.label,s.label);for(const k of ['time','range','duration','school','components','description']as const)assert(r[k],s.id+' '+k);}
 const acid=await spellReference('acid-arrow')as typeof references[number];
 assert.match(acid.description,/4d4.*ácido/);assert.match(acid.description,/1d4/);assert(acid.translated);
 const curse=await spellReference('bestow-curse')as typeof references[number];assert.match(curse.description,/Sabedoria/);assert.match(curse.description,/9º/);
 const shield=await spellReference('cacophonic-shield')as typeof references[number];assert.equal(shield.summary,false);assert.match(shield.description,/3d6.*trovejante/);assert.match(shield.description,/Constituição/);
 assert.throws(()=>spellReference('../../secret'),/Magia não encontrada/);
});

test('as 72 antigas descrições resumidas preservam todos os dados e valores mecânicos da fonte',()=>{
 assert.equal(mechanics.length,72);
 assert.equal(references.filter(s=>s.summary).length,0);
 const numericTokens=(s:string)=>(s.match(/\b\d*d\d+(?:[+-]\d+)?\b|[+-]?\d+(?:[.,]\d+)*/gi)||[]).map(t=>t.toLowerCase().replace(/[.,](?=\d{3}(?:\D|$))/g,'').replace(/^\+/,'' )).sort();
 for(const source of mechanics){
  const spell=references.find(s=>s.id===source.id)!;assert(spell,source.id);
  assert.equal(spell.translated,true,source.id);assert.equal(spell.source,source.source);assert.equal(spell.page,source.page);
  assert.deepEqual(numericTokens(spell.description),source.numericTokens,source.id);
  assert.doesNotMatch(spell.description,/ZZNUMBER|\d+-foot|negociar.*dano|rolos de ataque/,source.id);
 }
 const witch=references.find(s=>s.id==='witch-bolt')!;
 assert.match(witch.description,/2d12/);assert.match(witch.description,/1d12/);assert.match(witch.description,/mesmo que o ataque inicial tenha errado/);
 const toll=references.find(s=>s.id==='toll-the-dead')!;
 assert.match(toll.description,/1d8/);assert.match(toll.description,/1d12/);assert.match(toll.description,/4d8 ou 4d12/);
 const shield=references.find(s=>s.id==='cacophonic-shield')!;
 assert.match(shield.description,/apenas uma vez por turno/);assert.match(shield.description,/desvantagem/);
});

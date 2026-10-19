import {test} from 'node:test';
import assert from 'node:assert/strict';
import references from '../data/spell-reference-2024.json' with {type:'json'};
import {spells} from '../shared/character-sheet.js';
import {spellReference} from '../server/spell-reference.js';

test('todas as magias de evolução têm consulta na mesma edição, círculo e fonte',async()=>{
 assert.equal(references.length,spells.length);
 assert.equal(new Set(references.map(s=>s.id)).size,spells.length);
 for(const s of spells){const r=references.find(r=>r.id===s.id)!;assert(r,s.id);assert.equal(r.level,s.level);assert.equal(r.source,s.source);assert.equal(r.label,s.label);for(const k of ['time','range','duration','school','components','description']as const)assert(r[k],s.id+' '+k);}
 const acid=await spellReference('acid-arrow')as typeof references[number];
 assert.match(acid.description,/4d4.*ácido/);assert.match(acid.description,/1d4/);assert(acid.translated);
 const curse=await spellReference('bestow-curse')as typeof references[number];assert.match(curse.description,/Sabedoria/);assert.match(curse.description,/9º/);
 const shield=await spellReference('cacophonic-shield')as typeof references[number];assert(shield.summary);assert.match(shield.description,/trovejante/);
 assert.throws(()=>spellReference('../../secret'),/Magia não encontrada/);
});

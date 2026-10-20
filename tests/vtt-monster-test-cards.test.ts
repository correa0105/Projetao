import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {appendMonsterTestCards,monsterTestCards,monsterTestArt} from '../shared/vtt-monster-test-cards';
test('Four additive visual test sheets preserve every original monster and all rule fields', async()=>{
  const catalog=JSON.parse(await readFile('data/vtt/srd-2024.json','utf8'));
  const snapshot=JSON.stringify(catalog);
  const next=appendMonsterTestCards(catalog.monsters);
  assert.equal(next.length,catalog.monsters.length+4);
  assert.equal(JSON.stringify(catalog),snapshot);
  assert.deepEqual(next.slice(0,catalog.monsters.length),catalog.monsters);
  for(const c of monsterTestCards){
    const base=catalog.monsters.find((m:{id:string})=>m.id===c.sourceId);
    const bonus=next.find((m:{id:string})=>m.id==='bonus-test-'+c.sourceId);
    assert(base&&bonus);
    const rules=(m:Record<string,unknown>)=>Object.fromEntries(Object.entries(m).filter(([key])=>!['id','name','image'].includes(key)));
    assert.deepEqual(rules(bonus),rules(base));
    assert.equal(monsterTestArt(bonus.image)?.id,c.id);
    assert.match(bonus.name,/Bônus de teste/);
  }
  assert.deepEqual(appendMonsterTestCards(next),next);
  assert.equal(monsterTestArt('/vtt/monsters/monster-giant-spider.webp'),null);
});

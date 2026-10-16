import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  attackVisualSchema,
  isNaturalStyle,
  naturalStyles,
  weaponStyle,
  weaponVisual,
} from '../shared/vtt-attack-visual';
import { monsterActions } from '../shared/vtt-monster-actions';
test('ataques naturais PT/EN escolhem anatomia, sem usar o nome do monstro como arma', () => {
  const cases: Record<string, string> = {
    Bite: 'bite',
    Mordida: 'bite',
    'Adult Black Dragon · Rend': 'claw',
    Garras: 'claw',
    Rake: 'claw',
    Talons: 'claw',
    Tail: 'tail',
    'Ferrão da cauda': 'tail',
    Cauda: 'tail',
    Gore: 'horn',
    Chifrada: 'horn',
    'Infernal Sting': 'sting',
    Tentacles: 'tentacle',
    'Dissolving Pseudopod': 'tentacle',
    Beak: 'beak',
    Hooves: 'hoof',
    'Wing Attack': 'wing',
    'Cursed Touch': 'touch',
    Pincer: 'pincer',
    'Thunderous Slam': 'slam',
    'Arcane Burst': 'burst',
    'Bite · Espada longa': 'sword',
    'Tail · Longbow': 'bow',
  };
  for (const [name, style] of Object.entries(cases)) assert.equal(weaponStyle(name), style, name);
  assert.equal(weaponVisual('Garras'), 'natural');
  assert.equal(weaponVisual('Besta'), 'arrow');
});
test('contrato distingue armas, projéteis e naturais e preserva eventos antigos', () => {
  const base = { actor_id: randomUUID(), target_id: randomUUID() };
  for (const weapon of naturalStyles) {
    assert(attackVisualSchema.safeParse({ ...base, kind: 'natural', weapon }).success);
    assert(!attackVisualSchema.safeParse({ ...base, kind: 'sword', weapon }).success);
  }
  assert(!attackVisualSchema.safeParse({ ...base, kind: 'natural' }).success);
  assert(attackVisualSchema.safeParse({ ...base, kind: 'sword' }).success);
  assert(!attackVisualSchema.safeParse({ ...base, kind: 'natural', weapon: 'sword' }).success);
});
test('todos os ataques naturais nomeados do acervo usam a categoria correspondente', () => {
  const { monsters } = JSON.parse(readFileSync('data/vtt/srd-2024.json', 'utf8'));
  let tested = 0;
  for (const m of monsters)
    for (const a of monsterActions(m.details)) {
      if (
        !a.attack ||
        !/(?:\bBites?\b|\bClaws?\b|\bTail\b|\bRend\b|\bSting\b|\bTentacles?\b|\bGore\b|\bBeaks?\b|\bHooves\b|\bSlam\b|\bTouch\b|\bPincer\b)/i.test(
          a.name,
        )
      )
        continue;
      assert(isNaturalStyle(weaponStyle(`${m.name} · ${a.name}`)), `${m.name}: ${a.name}`);
      tested++;
    }
  assert(tested > 200);
  console.log(`Natural attacks covered in compendium: ${tested}`);
});

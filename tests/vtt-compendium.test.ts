import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compendiumText, monsterDetails, monsterSections } from '../shared/vtt-compendium.js';
import { monsterActions } from '../shared/vtt-monster-actions.js';
test('Compendium tags show rules and display labels instead of source-book identifiers', () => {
  assert.equal(
    compendiumText('the {@condition Grappled|XPHB} condition and {@variantrule Hit Points|XPHB}.'),
    'the Grappled condition and Hit Points.',
  );
  assert.equal(compendiumText('{@spell fireball|XPHB|Bola de fogo}'), 'Bola de fogo');
  assert.equal(
    compendiumText('{@atkr r} {@hit 5}, {@h}12 damage.'),
    'Ataque a distância +5, Acerto: 12 damage.',
  );
  assert.equal(
    monsterActions('Bow\n' + compendiumText('{@atkr r} {@hit 5}, {@h}12 (2d8 + 3) damage.'))[0]
      .attack,
    '1d20+5',
  );
  assert.equal(
    compendiumText([{ immune: ['cold', 'poison'], note: 'from spells' }]),
    'cold\npoison\nfrom spells',
  );
});
test('Sections preserve action continuations and parser IDs used by stored shortcuts', () => {
  const raw = {
    trait: [{ name: 'Amphibious', entries: ['It breathes air and water.'] }],
    action: [
      {
        name: 'Tentacle',
        entries: [
          '{@atkr m} {@hit 9}. {@h} 12 (2d6 + 5) damage.',
          'The target repeats the save after taking damage.',
        ],
      },
    ],
  };
  const details = monsterDetails(raw),
    sections = monsterSections(details);
  assert.deepEqual(
    sections.map((s) => s.title),
    ['Características', 'Ações'],
  );
  assert.equal(sections[1].blocks[0].name, 'Tentacle');
  assert.equal(sections[1].blocks[0].paragraphs.length, 2);
  assert.equal(monsterActions(details)[0].attack, '1d20+9');
  assert.deepEqual(monsterActions(details)[0].damage, ['2d6+5']);
  const legacy =
    'Tentacle\nAtaque m 9. Acerto: 12 (2d6 + 5) damage.\nThe target repeats the save after taking damage.';
  assert.equal(monsterActions(legacy)[0].id, 'action-0');
  assert.equal(monsterSections(legacy)[0].blocks[0].paragraphs.length, 2);
});
test('All SRD monster sections retain the full text and existing legacy action references', () => {
  const { monsters } = JSON.parse(readFileSync('data/vtt/srd-2024.json', 'utf8'));
  assert.equal(monsters.length, 330);
  for (const m of monsters) {
    const parsed = monsterSections(m.details)
      .flatMap((s) => s.blocks.flatMap((b) => [b.name, ...b.paragraphs]))
      .filter(Boolean);
    const lines = m.details
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s && !s.startsWith('### '));
    assert.deepEqual(parsed, lines, m.name);
    assert.ok(!/\bXPHB\b/.test(m.details), m.name);
    if (m.legacyDetails) assert.ok(monsterSections(m.legacyDetails).length > 0, m.name);
  }
});

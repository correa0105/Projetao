import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_THRESHOLDS,
  progressMission,
  rankName,
  testEligible,
} from '../shared/progression.js';

test('tabela completa: 114 missões válidas, quatro testes e teto de nível 20', () => {
  let level = 1,
    missions = 0;
  assert.deepEqual(
    MISSION_THRESHOLDS,
    [0, 2, 6, 14, 22, 30, 38, 46, 53, 60, 67, 74, 80, 86, 92, 98, 102, 106, 110, 114],
  );
  for (let total = 1; total <= 114; total++) {
    const result = progressMission(level, missions);
    level = result.level;
    missions = result.missions;
    assert.equal(missions, total);
    if ([22, 53, 80, 102].includes(total)) {
      assert.ok(testEligible(level, missions));
      assert.equal(level % 4, 0);
      for (let extra = 0; extra < 5; extra++)
        assert.deepEqual(progressMission(level, missions), {
          level,
          missions,
          credited: 0,
          promoted: false,
        });
      const promotion = progressMission(level, missions, level);
      assert.equal(promotion.missions, total);
      assert.equal(promotion.level, level + 1);
      level = promotion.level;
      assert.equal(testEligible(level, missions), false);
    }
    const expected: number = MISSION_THRESHOLDS.findLastIndex((threshold) => threshold <= total) + 1;
    assert.equal(level, expected);
  }
  assert.equal(rankName(level), 'Obsidiana');
  assert.deepEqual(progressMission(20, 114), {
    level: 20,
    missions: 114,
    credited: 0,
    promoted: false,
  });
});
test('último nível da patente continua contando até o requisito do teste', () => {
  for (const [level, minimum, limit] of [
    [4, 14, 22],
    [8, 46, 53],
    [12, 74, 80],
    [16, 98, 102],
  ]) {
    for (let count = minimum; count < limit; count++) {
      assert.equal(testEligible(level, count), false);
      assert.throws(() => progressMission(level, count, level));
      assert.deepEqual(progressMission(level, count), {
        level,
        missions: count + 1,
        credited: 1,
        promoted: false,
      });
    }
    assert.throws(() => progressMission(level, limit, level + 4));
  }
});

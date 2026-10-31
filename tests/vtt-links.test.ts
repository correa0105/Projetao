import test from 'node:test';
import assert from 'node:assert/strict';
import { vttEntryTarget, vttInviteCode, vttInviteHref, vttPersonalHref, vttRoomHref } from '../shared/vtt-links';
const id = '778cba63-b506-4bbf-9b58-cd710c763c11';
const code = 'a9'.repeat(24);
test('a entrada reconhece endereços fixos, salas autorizadas e convites antigos', () => {
  for (const prefix of ['', 'https://alvoradacinzenta.com/', 'http://192.168.1.9:3000/']) {
    assert.deepEqual(vttEntryTarget(prefix + vttPersonalHref(id)), { kind: 'table', id });
    assert.deepEqual(vttEntryTarget(prefix + vttRoomHref(id)), { kind: 'room', id });
    assert.deepEqual(vttEntryTarget(prefix + vttInviteHref(code)), { kind: 'invite', id: code });
  }
  assert.deepEqual(vttEntryTarget('  ' + code + '\n'), { kind: 'invite', id: code });
  assert.deepEqual(vttEntryTarget(vttPersonalHref(id) + '&role=spectator'), { kind: 'table', id });
  assert.equal(vttInviteCode(vttInviteHref(code)), code);
});
test('endereços inválidos ou ambíguos não selecionam outra mesa', () => {
  for (const value of ['', 'texto qualquer', '#vtt', '#vtt?table=', '#vtt?table=not-an-id',
    '#cards?room=' + id, '#vtt?invite=abc', 'javascript:alert(1)#vtt?room=' + id,
    '#vtt?room=' + id + '&table=' + id, '#vtt?table=' + id + '&table=' + id,
    'https://example.test/?room=' + id]) assert.equal(vttEntryTarget(value), null, value);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatImageParts, chatImageUrl } from '../shared/vtt-chat-images';

test('imagem em ambas as sintaxes conserva texto, legenda e múltiplas imagens', () => {
  assert.deepEqual(
    chatImageParts('Veja (Dragão)[https://exemplo.com/dragao.webp?v=2] e [Mapa](/mapa.png).'),
    [
      { kind: 'text', text: 'Veja ' },
      { kind: 'image', label: 'Dragão', url: 'https://exemplo.com/dragao.webp?v=2' },
      { kind: 'text', text: ' e ' },
      { kind: 'image', label: 'Mapa', url: '/mapa.png' },
      { kind: 'text', text: '.' },
    ],
  );
  assert.deepEqual(chatImageParts('()[https://exemplo.com/imagem]'), [
    { kind: 'image', label: 'Imagem', url: 'https://exemplo.com/imagem' },
  ]);
});

test('texto comum e URLs inválidas ficam literais, sem HTML ou protocolos executáveis', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:image/svg+xml;base64,aaa',
    'file:///c:/secret.png',
    '//outro.test/a.png',
    '/\\outro.test/a.png',
    'https://user:pass@outro.test/a.png',
    'http://outro.test/a.png',
  ]) {
    assert.equal(chatImageUrl(url), null);
    const literal = '(Imagem)[' + url + ']';
    assert.deepEqual(chatImageParts(literal), [{ kind: 'text', text: literal }]);
  }
  const html = '<script>alert(1)</script> texto';
  assert.deepEqual(chatImageParts(html), [{ kind: 'text', text: html }]);
});

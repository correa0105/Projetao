import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatCard, chatCardTemplate } from '../shared/vtt-chat-cards';

test('arma e magia conservam nome, descrição multiline e imagem', () => {
  assert.deepEqual(chatCard('/arma Espada élfica | Dano: 1d8 cortante\nAlcance: 1,5 m\n(Arte)[/espada.webp]'), {
    kind: 'arma', name: 'Espada élfica', description: 'Dano: 1d8 cortante\nAlcance: 1,5 m\n(Arte)[/espada.webp]',
  });
  assert.deepEqual(chatCard(' /MAGIA Raio | Fogo | luz\n<script>texto</script> '), {
    kind: 'magia', name: 'Raio', description: 'Fogo | luz\n<script>texto</script>',
  });
});
test('mensagens comuns e comandos incompletos permanecem literais', () => {
  for (const text of ['normal', '/arma | descrição', '/arma Nome | ', '/magia Nome\n| descrição',
    '/outra Nome | descrição', '/arma '+ 'a'.repeat(121)+' | texto', '/magia Nome | '+'a'.repeat(2000)])
    assert.equal(chatCard(text), null);
});
test('inserir modelo não descarta rascunho nem conteúdo ao mudar tipo', () => {
  assert.equal(chatCard(chatCardTemplate('arma', 'Dano: 1d6\nPropriedade: leve'))?.description,
    'Dano: 1d6\nPropriedade: leve');
  assert.deepEqual(chatCard(chatCardTemplate('magia', '/arma Lâmina | Dano: 1d8')), {
    kind: 'magia', name: 'Lâmina', description: 'Dano: 1d8',
  });
});

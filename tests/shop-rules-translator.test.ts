import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { translateMonsterLines } from '../server/vtt-translate.js';

test('tradutor mantém o contrato anterior e protege o glossário adicional com maiúsculas e parênteses', async () => {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(body.source, 'en');
    assert.equal(body.target, 'pt');
    // Echo the placeholders, independently of any translation provider.
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ translatedText: body.q }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const previous = process.env.VTT_TRANSLATOR_URL;
  process.env.VTT_TRANSLATOR_URL = `http://127.0.0.1:${address.port}`;
  try {
    const [defaultLine] = await translateMonsterLines([
      'Strength saving throw.\n\nFire damage: 2d6 + 3.',
    ]);
    assert.match(defaultLine, /Força salvaguarda/);
    assert.match(defaultLine, /dano fogo: 2d6 \+ 3/);
    assert.ok(defaultLine.includes('\n\n'));
    const [itemLine] = await translateMonsterLines(
      ['Magic action. Resistance. DC 15 Dexterity (Sleight of Hand) check. Light property.'],
      {
        'Magic action': 'ação Magia',
        Resistance: 'resistência',
        DC: 'CD',
        'Dexterity (Sleight of Hand) check': 'teste de Destreza (Prestidigitação)',
        'Light property': 'propriedade Leve',
      },
    );
    assert.equal(
      itemLine,
      'ação Magia. resistência. CD 15 teste de Destreza (Prestidigitação). propriedade Leve.',
    );
    assert.doesNotMatch(itemLine, /ZZNUMBER/);
  } finally {
    if (previous === undefined) delete process.env.VTT_TRANSLATOR_URL;
    else process.env.VTT_TRANSLATOR_URL = previous;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

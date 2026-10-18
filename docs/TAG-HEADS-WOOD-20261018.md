# Cabeças e madeira nas Tags da jornada

Os dez cartões de monstros mostram retratos no lugar do ícone genérico de etiqueta. Nove artes existentes do acervo `public/vtt/monsters` são enquadradas por CSS no rosto de cada criatura; o cubo gelatinoso conserva a própria forma. O Orc usa a nova arte `public/tags/orc-head-20261018.png`. Tags personalizadas sem retrato mantêm o símbolo genérico. Os nomes continuam em texto; as imagens são decorativas para leitores de tela.

O contêiner usa exatamente a cor, textura, sobreposição e escala de madeira do Catálogo de conquistas: `#211b14`, `linear-gradient(#17130ece, #17130ece)` e `achievement-wood-v1.png` em 620 px. Os cartões têm fundo translúcido para deixar os veios visíveis. Contadores, metas e administração permanecem funcionais.

QA visual em 1440, 1280, 768 e 390 px: dez imagens distintas decodificadas, fundo igual ao catálogo e ausência de transbordamento horizontal ou erros de JavaScript. TypeScript e build do cliente aprovados. Publicação somente de cliente e mídia; o hash do servidor deve permanecer idêntico. Sem migration.

## Arte nova

Gerada com a ferramenta integrada ImageGen, com transparência, e copiada integralmente para `public/tags/orc-head-20261018.png`. As nove outras artes existentes não foram modificadas.

Prompt final:

> Create one small fantasy RPG interface portrait icon: head and upper neck ONLY of an adult male orc, three-quarter view facing slightly left, broad heavy brow, olive gray skin, blunt nose, two clear lower tusks, pointed ears, short dark coarse hair. Detailed painted realistic medieval bestiary illustration, warm bronze highlights, readable silhouette at 48 pixels, dignified fierce expression. Centered circular portrait composition filling 85% of a square, subdued dark brown vignette behind head INSIDE circle, outside circle truly transparent. No text, no watermark, no border ring, no weapons, no torso. This is a project asset for a dark wood and aged copper achievement interface.

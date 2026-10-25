# Personagens apoiados no chão do acampamento

Pedido: baixar um pouco os personagens que pareciam flutuar. A arte agora desce
24 px em telas altas, com deslocamento responsivo de 2,4dvh limitado a 10–24 px,
tanto no acampamento próprio quanto na visita ao perfil público.

Arte, sombra e painel de informações acompanham o deslocamento. O painel
compensa o zoom existente de 0,85 para manter os pés inteiros acima dos nomes e
botões. A escala racial e o tamanho do retrato permanecem iguais. As medições dos
slots usadas pelo cenário, fogueira, cavalo e pet continuam na posição original;
o deslocamento visual da pessoa não move a referência de chão dos animais.
Preservada a transformação própria da silhueta de criar personagem.

Mudança restrita a `src/character-camp.css` e `src/profile-visit.css`. Nenhuma
imagem, ficha, propriedade, saldo, cota ou dado persistido é alterado. Não exige
regenerar arte nem recarregar o ilustrador.

TypeScript e build do cliente aprovados. Edge real em PostgreSQL local UUID
descartável: oito vistas (próprio e público em 1440×1000, 1024×600, 390×844 e
320×740), usando retratos transparentes já existentes e cavalo. Antes/depois
comprova deslocamento vertical sem alterar dimensões; cavalo e posição do fundo
iguais, sem overflow horizontal, pés acima dos painéis e botões dentro da tela.
Inspeção visual dos screenshots aprovou pés inteiros, nomes legíveis e apoio no
chão. QA privado em `.local/smoke-camp-drop-20261025.ts`; resultados em
`test-results/camp-portrait-drop-20261025`. Não usa geração de imagens ou contas
de teste em produção.

Publicado: imagem `alvorada-cinzenta:camp-portrait-ground-20261025`, código
`b6686771940026207b037d5aeb33aab6a62e939d`, baseada em
`house-ownership-cleanup-20261025`. Release somente do cliente, com 43 arquivos
e 22 respostas HTTPS conferidos por hash. Outros 647 arquivos conhecidos do
runtime, servidor, dados e mídias permaneceram idênticos. Snapshot somente por
leitura confirmou terrenos, mobília, saldos/compras da House, casas antigas,
salas e hotbars do VTT iguais. Trigger de remoção de casas continua habilitado;
ilustrador online, sem recarga. Saúde HTTPS 200.

Backup: `/opt/alvorada/backups/camp-portrait-before-20261025.dump`.
Baseline: `/opt/alvorada/backups/camp-portrait-state-before-20261025.json`.
Pacote SHA-256 `adc62323d4ec211adeb38da04298f2b38ea1a2d91a83812856633b5f4ee17cd2`.

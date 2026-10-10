# Efeitos e condições da mesa — 10/10/2026

A biblioteca passa de 106 para 126 modelos (125 efeitos e a animação de morte). Os 20 novos modelos usam campos de densidade próprios, com 32 quadros interpolados em ciclos de quatro segundos, transparência e duas passagens de profundidade. Pinterest e a biblioteca oficial JB2A serviram como referências visuais; nenhum arquivo dessas bibliotecas foi copiado.

Referências: https://br.pinterest.com/pin/786089310021947590/ e https://library.jb2a.com/#Shield. O pin público mostrou o título e parte da esfera; a prévia oficial do Shield azul do JB2A foi inspecionada. Fonte matemática e hashes das 40 páginas WebP: `scripts/arcana-density-fields.mjs`, `scripts/bake-arcana-effects.ts`, `data/vtt/arcana-effects-20261010.json`.

Modelos: Escudo líquido, Véu de aurora, Arcos da catedral, Hélice de espelhos, Flor de plasma, Manto de nebulosa, Eclipse vivo, Lente de marés, Lanças da tempestade, Prismas flutuantes, Harmonia arcana, Núcleo de rubi, Sopro de constelações, Gotas do éter, Rosácea celeste, Dobra gravitacional, Matriz de descargas, Asas do limiar, Véu abissal e Íris de safira. IDs e ordem dos 106 modelos antigos conservados.

Doze cores padrão antes apagadas foram atualizadas em `shared/vtt-effect-palette.ts`: gelo, veneno, cura, arcano, escudo, radiante, sombra, ácido, folhas, pétalas, estrelas e esporos. Cores personalizadas permanecem escolhidas pelo usuário. Lava, Corrente elétrica e as superfícies/arte anteriores continuam preservadas. Novos modelos também aceitam cores neutras como branco.

No clique direito de um token, **Condições** abre 30 pictogramas vetoriais originais. Eles usam o campo `conditions` existente, sem migration. O primeiro fica em `(x − largura/2, y − altura/2)` do quadrado do token; os demais seguem para a direita na ordem salva. Tamanho de tela de 22 px, intervalo de 2 px, sem girar ou espelhar com o corpo. Ícones continuam visíveis com efeitos cosméticos desligados; visão, ocultação e camadas seguem as permissões atuais da mesa.

Condições: Cego, Enfeitiçado, Surdo, Exausto, Amedrontado, Agarrado, Incapacitado, Invisível, Paralisado, Petrificado, Envenenado, Caído, Impedido, Atordoado, Inconsciente, Concentração, Mancando, Asas, Eletrizado, Queimando, Congelado, Sangrando, Silenciado, Dormindo, Marcado, Protegido, Regenerando, Lentidão, Acelerado e Inspirado. Rótulos personalizados antigos ganham um ícone neutro e conservam seu texto no menu. Limite existente de 30 condições por token. Estes marcadores representam estados; não acrescentam automação de regras de combate.

O mestre adiciona/remove e salva imediatamente. O jogador só adiciona em token que controla; condições já aplicadas ficam selecionadas e bloqueadas para remoção, conforme a regra existente no servidor. Espectadores não editam. O menu passa a calcular a altura pelo espaço abaixo de sua posição, corrigindo opções que antes podiam ficar fora da tela.

Protocolo VTT **9**: abas antigas recebem a mensagem para recarregar antes de ler ou salvar os novos IDs. Dados anteriores e limite de dez efeitos simultâneos por token conservados; os 20 modelos são uma expansão da biblioteca.

Validação: TypeScript/build limpos; renderer real, 190 comparações de silhuetas, movimento, fechamento do ciclo, reduzido, cor branca e bordas; 93 efeitos vizinhos com pixels idênticos e 12 com mudança de paleta. Oitenta renderizações reais de tokens mantêm âncora, sequência e tamanho dos marcadores em cinco zooms/quatro rotações/espelho. API em PostgreSQL UUID descartável testa os 20 presets em duas séries de dez efeitos, prévia privada/aplicação, 30 condições, rótulo antigo, gravação/recarga, permissões e protocolo antigo. Menu testado em 1440, 768, 390 e 320 px.

Comandos: `node scripts/review-vtt-arcana-effects.mjs` e `node scripts/test-vtt-arcana-conditions-isolated.mjs`. O primeiro prepara automaticamente uma cópia privada da referência anterior à alteração, commit `382d6d7`, e usa uma arte original do projeto quando a prévia local não está disponível. O segundo requer o build do cliente antes de testar a interface. Não rodar testes de escrita no banco ativo.

Publicação incremental: bundles, servidor, 40 atlases novos e metadata sobre a imagem anterior. Não substituir toda a pasta de artes. Preservar ilustrador ativo, os 17 trabalhos independentes e o protótipo 330 × 4 pausado. A conclusão de TODOS os itens mágicos do Empório continua em andamento: 1.021 publicados e 2.055 candidatos pendentes, além de opções específicas de magia/alvo.

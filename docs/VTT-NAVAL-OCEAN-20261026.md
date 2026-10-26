# Barcos e oceano — 26/10/2026

Pedido: corrigir mastros/velas superiores, oferecer pano inflado e animações independentes de velas e remos; mapa só de água, ondas opcionais, margens reconhecendo terra pintada, mar/vento com volume e boa eficiência. Correção posterior: os cantos da vela devem ficar baixos e presos, sem pontas levantadas no ar.

## Uso

- No barco, botão direito → **Configurações do token → Velas e remos**. As mesmas opções ficam na ficha do token selecionado. **Inflar velas** alterna pano recolhido/inflado; **Animar velas ao vento** e **Remar** são independentes. Orientação gira a verga em torno do mastro vertical; ritmo altera a animação. Galé, Drácar e barco a remo oferecem remada. Os cinco barcos à vela usam as coberturas novas automaticamente, inclusive tokens já colocados.
- **Biblioteca de mapas → Novo oceano**, ou **Configurações do mapa → Mapa de oceano** no mapa existente. O fundo anterior permanece salvo. **Animar água** pausa as ondas; pintar terra, areia ou outro terreno cria uma ilha com transição de água rasa e espuma. Apagar/ocultar a pintura revela a água novamente. O resultado respeita camadas, opacidade e borracha; a margem é visual, sem criar barreiras de movimento.
- **Som do mar** e **Som do vento** ajustam dois ambientes independentes; 0% silencia. Permanecem independentes da animação e obedecem ao volume/mute pessoal dos efeitos. Trocar de mapa encerra os ambientes anteriores. Configurações do mapa/aba do token usam o salvamento normal da mesa; os controles rápidos do menu do barco salvam ao concluir a mudança.

## Gráficos e desempenho

Dois atlas PNG originais, marfim e listrado, separam verga/mastro, pano inflado e pano recolhido. Mastros aparecem como topos circulares. Os cantos do pano ficam junto à bainha inferior; escotas vão até pontos fixos no convés. A animação deforma somente o tecido, conservando as pontas tensionadas. A cobertura continua a 12% sobre personagens visíveis, com máscara própria para estado/orientação; casco e passageiros não oscilam.

Um terceiro PNG separa o casco do barco pequeno e um remo. A remada gira os pares em espelho no apoio e encurta a pá na recuperação. Nos outros dois barcos com remos, o recorte do casco oculta as pás antigas somente durante a remada. As doze artes anteriores e as cinco coberturas anteriores permanecem intactas.

O oceano usa quads da textura nativa, limitados à viewport e com nível de detalhe no afastamento; não gera imagem de 16000² nem lê pixels por quadro. CanvasPattern com transformação animada causava troca de backend ao compor terreno: substituído por drawImage, mantendo a textura original. Margens e pintura usam cache por tiles; quadros de animação não refazem traços nem distâncias da costa. O composto de terreno desenha somente o retângulo ocupado. A animação naval funciona a até 30 quadros/s, respeita Efeitos do mapa, movimento reduzido e pausa em aba oculta. Com todas as animações paradas, não mantém loop de desenho. O áudio reutiliza a engine existente, até dois loops por cena, sem polling adicional nem download enquanto silenciado.

## Arte, áudio e compatibilidade

Ferramenta: **image_gen embutido**. Os três PNGs selecionados foram copiados sem conversão, recorte de arquivo ou recompressão para `public/vtt/naval-20261026/`. Fontes, prompts finais, dimensões e SHA-256 em `data/vtt/naval-art-20261026.json`. O Canvas recorta os atlas apenas ao desenhar. As versões preliminares de pano com pontas elevadas não são usadas.

Mar: [Beach Ocean Waves, jasinski, CC0](https://opengameart.org/content/beach-ocean-waves). Quatro ondas reais, transições de 0,7 s e união circular de 0,5 s; estéreo 48 kHz, Vorbis q6, medido em −21,42 LUFS e pico −5,85 dBTP. O loop tem 9,46 s. Vento usa a gravação CC0 existente de Thimras, sem alteração. Novo mar também aparece na biblioteca de sons; os 241 arquivos anteriores foram conservados. Proveniência/hashes em `data/vtt/naval-audio-20261026.json`, manifesto e créditos públicos.

Campos opcionais `scene.ocean` e `token.vehicleMotion`, validados estritamente, sem migration nem reescrita de salas. Saves que omitem campos existentes conservam suas opções. Somente o mestre salva configuração de cena/barco; a rota de movimento de jogadores não aceita esses campos. Protocolo 28 impede saves de clientes antigos. Inventários, compras, vínculos, slots de atributos e ilustrador permanecem fora desta alteração.

## Verificação

`tests/vtt-naval.test.ts`: compatibilidade legada, limites de campos, remos simétricos e integridade/alfa dos PNGs; validação dos cantos do pano abaixo do centro nos dois atlas. Suítes anteriores de rigging, terreno e áudio conservadas.

`scripts/test-vehicles-slots-isolated.mjs --naval`: PostgreSQL descartável, controle rápido salvando sem mover o barco, menus em 1440/1024/768/390 px, novo oceano/configurações/volumes, reprodução real de dois loops e encerramento ao trocar a cena. Renderer completo com seis barcos e ilha: máscaras, pintura/borracha/camada oculta, estado estático e contadores de cache. Evidências em `test-results/naval/` (não versionadas). TypeScript e builds de cliente/servidor obrigatórios antes da publicação.

Resultado local: 20 testes aprovados; navegador sem erros em quatro larguras, dois áudios reproduzidos/encerrados, máscaras e cache estáveis. Seis barcos/ilha em 1440×1000: mediana 1 ms, p95 2,9 ms no navegador de teste; resultado não constitui garantia de desempenho em qualquer dispositivo.

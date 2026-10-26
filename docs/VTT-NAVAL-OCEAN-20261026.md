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

## Publicação

26/10/2026 — PUBLICADO vtt-naval-ocean-20261026 (4b6abfb3): pontas das velas baixas e presas por escotas, mastros superiores circulares, inflar/recolher e animações de pano/remos independentes; novo oceano animado opcional, costa reconhecendo pintura e mar/vento com volumes. Protocolo 28. 20 testes + navegador em quatro larguras/áudio real aprovados; seis barcos/ilha: mediana 1 ms, p95 2,9 ms. Conferidos 51 arquivos novos, 1.107 anteriores e 47 respostas HTTPS; três PNGs novos e 12+5 antigos/241 áudios preservados, um mar novo. Cinco mesas, hotbars, 35 assets privados, fichas/artes/inventários/compras e 26 slots idênticos por hash; ilustrador online. Atualizar a página. Guia VTT-NAVAL-OCEAN-20261026.

Imagem `alvorada-cinzenta:vtt-naval-ocean-20261026`; fonte `4b6abfb386e079924cb1d84b81d96e0ce9bec8fd`. Backup completo antes da troca, nenhum migration/reparo de dados ou reinício do ilustrador. Hashes integrais dos grupos privados idênticos antes/depois. Recibo/manifesto e verificadores em `.local/`, sem credenciais versionadas.

## Correção de ativação e ondas

26/10/2026 — Corrigidos ativadores dos mapas: seletor CSS mais específico, trilho 40×24 e bolinha 18 px contida em ambos os estados/foco. Ondas com duas ondulações opostas e deslocamento mínimo perceptível no afastamento. Controle Ativar ondas/Pausar no alto direito do tabuleiro, sem sobrepor hotbar; preferência local system/on/off, opt-in explícito para movimento reduzido, pausa do mestre/efeitos do mapa preservadas. Só cliente, protocolo 28/sem migration. Sete testes de naval/terreno e navegador em quatro larguras; mudança de pixels no tabuleiro real, pausa estática, opt-in e geometria do switch conferidos. Guia VTT-NAVAL-OCEAN-20261026.

O CSS genérico de checkbox podia reduzir o trilho do switch para 15 px, deixando a bolinha fora: o seletor do diálogo agora prevalece e fixa tamanho/posição. A superfície antiga tinha uma base imóvel com só 25% de textura em deriva lenta; agora ambas as camadas ondulam em sentidos distintos e o movimento mantém pelo menos 8 px de amplitude na tela em visão afastada. O botão de reprodução informa a situação efetiva. A preferência local `oceanMotion` não é enviada à mesa: `system` respeita movimento reduzido, `on` é a escolha explícita do dispositivo, `off` pausa as ondas. A pausa compartilhada do mestre e o desligamento dos efeitos continuam prevalecendo. Sem alteração de PNGs, áudios, JSON das mesas, servidor ou protocolo.

QA: frames de uma área só de água, com movimento reduzido ativado e opt-in, diferem visivelmente após 1 s; pausa produz pixels idênticos após 600 ms. Sete testes de política/terreno aprovados. Navegador verifica thumb contido nos estados ligado/desligado, Space/foco e quatro larguras, além dos checks anteriores de barcos/ilha/cache/áudio.

26/10/2026 — PUBLICADO vtt-ocean-motion-switch-20261026 (047b3bb1): switch do mapa com trilho/bolinha corretos, ondas mais visíveis e controle Ativar ondas/Pausar no alto direito. Preferência local e opt-in de movimento reduzido, pausa do mestre preservada. Sete testes + navegador em quatro larguras aprovados, frames reais em movimento e pausa idêntica. 41 arquivos novos/HTTPS e 1163 anteriores conferidos; PNGs/242 áudios intactos. Cinco mesas, hotbars, 35 assets privados, fichas/artes/inventários/compras e 26 slots idênticos por hash; ilustrador online. Só cliente, protocolo 28/sem migration. Ctrl+F5. Guia VTT-NAVAL-OCEAN-20261026.

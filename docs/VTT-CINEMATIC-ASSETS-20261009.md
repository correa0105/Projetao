# VTT: efeitos, assets animados e ações compactas — 09/10/2026

## Uso

- Biblioteca → **Assets animados**: 17 elementos originais vistos de cima. O mestre arrasta para o mapa ou usa Adicionar. São objetos na camada Mapa; tamanho, rotação, ordem, ocultação e exclusão continuam disponíveis. Token selecionado → Animação do ambiente permite pausar, mudar velocidade e intensidade.
- Efeitos: 40 modelos acrescentados, total **106**, sem renomear IDs anteriores. A prévia continua imediata sobre o token selecionado, com editor abaixo. Petrificação ganhou intensidade de 0–100%.
- Janela de ações: Abrir ficha e PV ficam acessíveis. Mais opções reúne Combate, Camada, Movimento vinculado, Orientação e Visibilidade. PV usa valor numérico, barra compacta e ações Dano/Cura. Barras no mapa são centradas e limitadas a 60% da largura e 84 pixels visuais.
- Quem está sobre outro token acompanha a rotação do apoio, conservando sua orientação relativa. O último trecho do movimento determina a direção ao soltar. Offsets e vínculos aninhados são sincronizados uma vez, inclusive no servidor.

## Arte e animação

Artes originais com transparência nativa, criadas por image_gen.imagegen e convertidas tecnicamente para WebP sem redesenho. A versão final usa 16 props e 16 objetos físicos + vento por fluxo de materiais. Fontes e prompts completos em data/vtt/cinematic-*-20261009.json. Tentativas de atlas com halo foram descartadas; oito ambientes finais foram recortados individualmente pelo gerador.

Referências visuais consultadas: Pinterest fornecido pelo usuário e https://library.jb2a.com/. Nenhuma mídia desses sites foi copiada. Mantidos os materiais originais já existentes. Removedor de fundos não é implementado em código: os recortes vêm do gerador com alpha nativo.

- Gelo conserva os prismas atrás do corpo; pequenos cristais frontais agora usam a borda real da imagem e apontam para fora.
- Terra usa rochas e cascalho com textura, poeira e fissuras finas. Maldição usa fluxo de energia e vapor. Teia tem fios claros com contraste. Pétalas usam pétalas reais, sem formas de borboleta.
- Os 30 modelos adicionais anteriores foram refeitos com materiais e objetos físicos, sem desenhos de glifos grosseiros.
- Retrato de seleção conserva rosto e peito em uma composição WebGL única, com wisps originais e fallback estável. Guia VTT-PORTRAIT-WISPS-20261009.md.

## Magias e som

339 perfis têm coreografia vinculada à descrição SRD, identificada por hash e trecho em shared/vtt-spell-choreography.json, com 38 comportamentos e fases de conjuração, trajetória e impacto. Bola de Fogo usa projétil material e explosão. Imagem Espelhada usa três cópias reais do token com transparência e desfoque. Ilusões de imagem usam o token como representação visual; não existe geração livre de uma ilusão escolhida pelo jogador.

Passo Nebuloso, Porta Dimensional e Teleport movem os viajantes selecionados de forma atômica, validando chegada livre e limites, sem bloquear a passagem por paredes intermediárias. Porta Dimensional permite visualizar o destino mentalmente. Teleport exige confirmação do mestre para familiaridade/destino; resultados aleatórios, outro plano, destino em outro mapa e entradas em círculos de teleporte continuam resolução do mestre. Nenhum espaço é gasto em chegada inválida; repetir o comando não move nem cobra novamente. Vínculos de viajantes são soltos; montarias não são transportadas implicitamente.

445 cues estéreo originais: 339 magias + 106 efeitos. Composições em camadas com gravações CC0 já creditadas no catálogo, transientes e reflexos DSP. Receitas usam material/comportamento e momento de impacto. Manifesto public/audio/cinematic-20261009-manifest.json inclui fontes, hashes, duração, RMS e pico. Som respeita mute, volume, efeitos desligados, aba oculta e pool de 8 vozes; não cria loops para efeitos permanentes. Baforadas mantêm fallback sem URL inexistente. Consulta dos créditos das fontes continua no painel de sons.

## Compatibilidade e validação

Protocolo VTT 8: atualizar abas antigas. Campos animatedAsset, intensity e attachment.baseRotation são opcionais. Nenhuma migration nova ou alteração das fichas, estoque, compras, saldos, cotas e artes pessoais.

- TypeScript, build de cliente/servidor e Docker limpo.
- 339 magias: visibilidade, animação, alpha e estabilidade com movimento reduzido; 9 pranchas e 12 exemplos revisados.
- 105 efeitos animados + morte existente, 17 assets: movimento, transparência, estados reduzidos/desligados e progressão de petrificação; 4 pranchas sobre mapa bege.
- 8 testes de vínculos: ordem, ciclos, rotação aninhada, offsets, direção do último trecho e arco contra paredes.
- Banco descartável: permissões, PV, régua 5/10 ft, fichas independentes, mochilas, conservação de estoque; conjuração, consumo, repetição, chegada ocupada, teleporte por parede e asset persistido; navegador 1440/768/390/320.
- Retrato: seis tamanhos × DPR, rosto visível, fallback sem WebGL, desligado e movimento reduzido.
- 32 sprites: alpha nativo e ausência de bordas opacas cortadas; 445 cues decodificados e conferidos quanto a duração/volume/picos.

Aplicado ao Docker local com backup completo validado antes da atualização. Os 43 bundles instalados correspondem ao build conferido; 61 tabelas protegidas conservaram integralmente seus registros. O ilustrador foi reiniciado a partir do mesmo release e está disponível.

O protótipo 330 × 4 de monstros permanece pausado, preservado fora do release. As regras SRD existentes não equivalem à automação integral de todas as 339 magias.

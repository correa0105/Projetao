# Sons de masmorra — 24/10/2026

Pedido: acrescentar 40 sons de masmorra à biblioteca do VTT. Catálogo ampliado de 155 para 195: 13 músicas, 26 ambientes e 156 efeitos. Os 155 registros, fontes e bytes anteriores foram preservados.

## Conteúdo

- 7 desabamentos: teto, pedregulhos, coluna rachando, coluna tombando, parede, ponte de madeira e avalanche de entulho.
- 6 passagens: porta secreta abrindo/fechando, alavanca, laje, grade subindo e grade despencando.
- 9 armadilhas: placa de pressão, dardos, lâminas de parede, alçapão, fosso, mandíbulas, pêndulo, pedra rolando e gás.
- 4 tremores: distante, terremoto, passos de gigante e fissura no chão.
- 10 criaturas: fera, guardião, morto-vivo, espectro, inseto, gosma, serpente, morcegos, garras e respiração.
- 4 ambientes com ciclo contínuo: goteiras, túnel instável, covil e engrenagens.

Som → Efeitos permite filtrar Desabamentos, Passagens secretas, Armadilhas, Tremores e Monstros. Som → Ambientes → Masmorras reúne os quatro ciclos. Busca inclui nomes, descrições e categorias; todos os novos arquivos incluem masmorra na descrição. Prévia privada, favoritos, removidos, volume, repetição e hotbar seguem o fluxo existente. Qualquer dono da mesa controla o som compartilhado, sem exigir administrador. Nenhuma mudança de schema/migration ou regra de jogo.

## Fontes e manutenção

Bases CC0 verificadas nas páginas oficiais de Kenney e OpenGameArt em 24/10/2026. Créditos completos em public/audio/vtt/CREDITS.md. Quatro novas fontes com URL, autor, tamanho e SHA-256 em data/vtt/dungeon-sounds-20261024.json e public/audio/vtt/manifest.json; reutilização das fontes RPG e criaturas já identificadas. Não usar Tabletop Audio/SoundPad como fonte de arquivos, devido às restrições comerciais.

Gerador offline scripts/expand-vtt-dungeon-sounds-20261024.py (numpy/scipy/soundfile; diretório de dependências opcional no primeiro argumento). Baixar fontes fixadas pelo downloader existente; ZIPs novos extraídos em destinos validados. Pacotes RPG/criaturas são os já preparados pelos geradores anteriores. Montagens determinísticas distintas, gravadas com fontes individuais e descrição, DSP próprio de vento/pressão/tremores, filtragem, panorâmica e reverberação difusa. Não são 40 alterações de tom de um único efeito.

O gerador é aditivo: não regenera IDs presentes, verifica todos os hashes existentes, conserva os 155 objetos anteriores e exige 40 novos sons/4 loops/195 totais. OGG Vorbis estéreo 44,1 kHz; picos, RMS, amostras finitas e emendas dos loops conferidos após decodificação. Novos arquivos somam 4.481.516 bytes. Nada é gerado durante seed, startup ou deploy. Cliente e servidor devem receber o catálogo no mesmo release, pois os IDs permitidos são compilados em ambos.

## Validação

TypeScript e builds cliente/servidor. Dez testes de engine/schema/integridade e nove de API em banco UUID descartável aprovados, incluindo os 40 IDs no servidor e leitura por outro membro. Comparação com o HEAD anterior confirmou catálogo e manifest antigos idênticos e SHA-256 dos 155 arquivos conservado.

Runner de API/navegador recusa o túnel de produção 5437. Smoke atualizado para entrada atual do VTT e dono comum: decodifica os 40 arquivos no navegador, testa categorias e busca, prévia privada, compartilhamento de desabamento/porta/armadilha/tremor/monstro e ambiente em loop, favoritos/atalhos persistentes, regressões do mixer e responsividade 320/390/768/1440 px. Evidências em test-results/vtt-sounds-browser.json e vtt-sound-library-*.png.

Navegador aprovado: os 40 arquivos decodificados; prévia privada e seis reproduções compartilhadas novas confirmadas; categorias, favoritos, hotbar, volumes/intervalos antigos e quatro larguras aprovados, sem erros de página. Publicado em https://alvoradacinzenta.com, release vtt-dungeon-sounds-20261024, código 339ada1c07f38080cbe4b8559bf9e8d2a6c98fe5. Verificados 84 arquivos do release e 62 respostas HTTPS (incluindo os 40 áudios e o manifest). Catálogo cliente/servidor compatível; os 155 arquivos antigos, documentos das duas salas e seus dois hotbars conservaram os hashes. Ilustrador online e saúde HTTP aprovada. Backup anterior em /opt/alvorada/backups/vtt-dungeon-sounds-before-20261025T010851Z.dump.

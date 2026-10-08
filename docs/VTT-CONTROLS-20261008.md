# Controles do VTT — 08/10/2026

O compêndio usa quatro botões compactos na mesma linha: Monstros, Presets, Galeria e Magias. Os textos sobre a contagem SRD e o arraste foram removidos. Os nomes completos dos menus permanecem acessíveis.

Os botões Arma e Ataque de magia saíram do compositor. Cartões digitados com `/arma` e `/magia` continuam disponíveis.

Ctrl + roda do mouse gira os tokens selecionados em passos de 15°, nos dois sentidos, sem mudar o zoom ou a aba aberta. Jogadores só giram tokens que controlam; espectadores não editam. A roda sem Ctrl mantém o zoom.

Texto e desenhos podem ser arrastados pela ferramenta Selecionar, na camada correspondente. O movimento acompanha a grade; Alt permite mover livremente. Uma inserção de texto já volta à seleção. O arraste preserva a aba direita, gera uma única entrada em Desfazer e salva a posição.

Validação: TypeScript, build Vite e smoke em PostgreSQL descartável. O navegador testou os quatro menus em 1440, 390 e 320 px, ausência dos avisos e botões, giro rápido/inverso com câmera estável, permissão do jogador, arraste de texto com grade/Alt, desfazer, salvamento e recarga. Ataques, cartões, áudio, preferência de efeitos e celular também passaram. Capturas dos menus foram inspecionadas.

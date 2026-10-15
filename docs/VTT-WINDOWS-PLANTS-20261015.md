# Janelas, sons e vegetação — 15/10/2026

A visão externa começa na abertura nativa da janela, com toda a largura do vão, mesmo ao aproximar o personagem pela lateral. A abertura aumenta suavemente com a proximidade; o alcance termina com uma transição suave. Paredes externas continuam bloqueando a visão. O renderer de iluminação e a filtragem de tokens no servidor usam a mesma geometria.

O botão junto a cada janela próxima permite abrir e fechar. O mestre também encontra as janelas no inspetor da casa. Jogadores precisam de um personagem próprio, visível, desbloqueado e próximo; espectadores não podem interagir. Cada janela conserva o estado no documento PostgreSQL da mesa. Casas anteriores mantêm as janelas abertas por padrão. Abrir uma janela não permite atravessar a parede.

Portas e janelas têm quatro sons distintos do acervo já creditado no painel de sons: Kenney (porta, rangido e trinco). As ações aceitas pelo servidor geram sinais temporários limitados a 40; eventos são reproduzidos uma vez nos clientes próximos. Carregar a mesa, recarregar, mudar de cena e repetir a mesma ação não reproduzem histórico. Volume e silêncio seguem os controles de efeitos da mesa e do site. Salvar/undo do mestre preserva os sinais emitidos pelo servidor.

Paredes são desenhadas antes dos objetos externos; telhados são desenhados depois. Árvores e áreas de copa usam a transparência nativa do telhado para impedir sobreposição sobre as telhas. Folhagem externa pode cobrir a face da parede, mas não atravessa a face interna para dentro do cômodo. Plantas posicionadas dentro da casa continuam visíveis.

Protocolo VTT 21; clientes anteriores recebem a solicitação de recarregar. Sem migration SQL e sem mudança nas contas, ouro ou conteúdo existente.

Validação: testes de todas as aberturas com aproximação lateral, giro/espelho, persistência e bloqueio; render nativo mede zero pixels de folhagem sobre telhado opaco ou piso interno; 90 silhuetas, 32 telhados girados/espelhados; fluxo real de mestre/jogador/espectador, sons das quatro ações, silêncio e F5 em banco descartável. TypeScript e builds do cliente/servidor aprovados.

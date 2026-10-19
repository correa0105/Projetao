# Brasões e acesso da sede — 19/10/2026

O editor oferece 20 estandartes, 20 bordas ornamentais e 20 emblemas ilustrados, combináveis com cores e padrões de tecido. Permite arrastar, redimensionar e girar o emblema, ocultar camadas e mudar sua ordem. Criação e edição abrem a oficina ilustrada; brasões antigos continuam salvos e renderizados sem conversão automática. O modo clássico permanece disponível.

As seis pranchas foram geradas pelo imagegen embutido. O lobo e o dragão rejeitados foram substituídos por novas silhuetas. O recorte inicial por células fixas cortava extremidades e incluía fragmentos vizinhos. A preparação definitiva identifica os componentes transparentes de cada desenho no arquivo completo e exporta 60 sprites individuais de 512 px, com margem de 32 px. O renderer usa estes sprites, evitando também vazamento de atlas ao aplicar filtros de cor. Conferidas visualmente todas as 60 peças no renderer real.

- Prompts, fontes, saídas e SHA-256: `data/guild-heraldry-20261019.json`.
- Artes: `public/guild/crests-20261019/`.
- Preparação: `node scripts/prepare-guild-heraldry.mjs [pasta-das-fontes]`.
- As referências anexadas pelo usuário orientaram os desenhos. O pin do Pinterest informado não pôde ser acessado.

O Menu da sede reúne Visão, Decoração, Personagem e Guilda. Contém câmera, grade, edição, loja, personagem, companhia, missões, tesouro, brasão e salas. O antigo Aparador da Hospitalidade passa a ser o Sofá da Hospitalidade, mantendo a instalação `lounge`, suas melhorias e níveis. A trilha e o pátio usam uma única superfície de pedra. Os três telhados têm a transparência externa aparada antes de se ajustar à casa.

Quatro portas têm folhas animadas; as duas janelas têm venezianas que abrem e fecham. Paredes, portas fechadas e venezianas fechadas bloqueiam a visão do personagem colocado na sede. Vãos abertos transmitem visão; outros personagens atrás de paredes também ficam ocultos. Sem personagem colocado, a sede continua em modo de inspeção; durante a decoração, a planta inteira fica visível. Este recurso trata de visão, sem acrescentar colisão de movimento.

O estado das aberturas é compartilhado entre membros e armazenado em `player_guilds.document._estate_openings`, com bloqueio transacional. As rotas exigem membro/personagem correto, validam IDs e valores booleanos e preservam este estado nas demais edições da guilda. Não há migration nova nem alteração econômica para abrir e fechar.

Revisão da entrada e da visão: removidos os dois canteiros circulares e o texto sobre o telhado. A ação Entrar na sede fica em um botão de tamanho constante abaixo da entrada, com mouse e teclado. Portas e venezianas são desenhadas antes da cobertura de visão; aberturas de cômodos ocultos não renderizam seus controles. O botão de cada abertura fica do lado do observador e também precisa estar visível. Tokens recebem o mesmo recorte de visão, além da filtragem de personagens ocultos. A grade também fica sob a cobertura; a edição continua mostrando a planta completa.

Interior sem folhas estáticas: `public/guild/estate-20261019/interior-openings-v3.webp`; prompt e preparação em `data/guild-estate-openings-20261019.json`.

Validação:

- TypeScript e compilação de cliente/servidor aprovados.
- Quatro testes de geometria de visão, aberturas ocultas e contrato dos brasões.
- Dois testes da sede em PostgreSQL descartável, incluindo permissões, alterações concorrentes das aberturas, persistência e brasão ilustrado.
- Doze regressões de guildas, economia e perfis em PostgreSQL descartável.
- UI dos componentes reais com API simulada em 1440 e 390 px: menu, edição junto à parede, porta, janela, visão, arraste do emblema, 20 opções por categoria, ordem das camadas, cores e persistência.
- Revisão das 60 miniaturas e remoção dos fragmentos apontados pelo usuário.

Publicação: `alvorada-cinzenta-app:guild-access-heraldry-20261019`, sobre a versão RP anterior. Aplicação saudável, 170 arquivos conferidos por hash e 16.963 anteriores preservados; as 60 artes servidas por HTTP correspondem ao manifest. Porta local/Radmin e demais serviços mantidos. Alterações independentes do checkout não incluídas.

Revisão publicada em `guild-entrance-visibility-20261019`: 99 arquivos do cliente conferidos e 17.072 anteriores preservados, servidor idêntico. Quatro testes de visão/brasão, TypeScript/build e UI em 1440/390 px aprovados; conferidos ausência dos canteiros, botão abaixo do telhado com tamanho constante e teclado, ocultação dos controles de outros cômodos, abertura/fechamento atualizando a visão e planta completa durante edição.

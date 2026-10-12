# Evolução de personagem e apresentação das cartas — 12/10/2026

## Uso

Ficha → **Conceder nível (ADM)**. O administrador vigente concede um nível ao próprio personagem, escolhendo continuar numa classe ou iniciar multiclasse. Níveis já conquistados por missões aparecem como **Concluir evolução**, acessível ao dono; suas escolhas precisam ser concluídas antes de conceder outro nível. A origem SRD 5.2.1 precisa estar confirmada.

A janela mostra nível da classe, ganho de PV, características e círculo disponível. Libera subclasse no nível 3 daquela classe, truques/magias adicionais, especializações, maestrias, estilos e as demais escolhas implementadas. Nos níveis de melhoria, distribui dois pontos em atributos até 20. A aba Magias mostra preparação por classe, grimório, magias automáticas da classe/subclasse, espaços de círculos 1–9 e espaços separados de Magia de Pacto. Pesquisa e filtro por círculo ajudam a selecionar opções.

## Regras e limites

- Doze tabelas de classes, níveis 1–20, conforme SRD 5.2.1. Uma subclasse aberta por classe; opções dos livros comerciais não foram importadas.
- 338 magias presentes nas listas oficiais do SRD, com listas de classe, círculo, escola, ritual, concentração e nomes em português. Os 83 registros originais mantêm IDs e regras anteriores. As listas foram conferidas nas colunas individuais do PDF oficial; entradas do compêndio que não constam dessas listas não foram incorporadas à ficha.
- PV usam o dado cheio somente no primeiro nível do personagem, a média nos níveis seguintes e Constituição retroativa. Anão e Resiliência Dracônica são considerados. Proficiência usa nível total; círculos que cada classe pode preparar/aprender usam seu nível próprio. Meio-conjuradores arredondam para cima quando combinados. Ataques extras de classes diferentes não se somam.
- Esta etapa implementa escolhas de evolução e cálculos da ficha. Efeitos de combate continuam sujeitos às regras e controles da mesa. Melhorias oferecem aumento de atributos; seleção geral de todos os talentos, substituição completa de escolhas após descanso e recursos separados de pacto no executor do VTT exigem etapas próprias. A importação do VTT não restaura recursos gastos.
- A concessão administrativa altera o nível real usado pelo site, incluindo a patente calculada pelo nível. Não fabrica missões, créditos, recompensas, XP ou bens. Não há redução de nível nem botão de desfazer nesta etapa.

## Persistência e proteção

`character_sheets.choices.advancement` guarda cada nível, classe/subclasse, escolhas, responsável, horário e UUID da confirmação. Preparação por classe e consumo de espaços também persistem. Sem migration: utiliza o JSONB existente. `characters` recebe somente nível, atributos válidos, PV e CA recalculados. Dano sofrido é preservado ao ampliar PV máximos.

O servidor reconsulta `"user".administrador` a cada concessão e verifica ownership inclusive para administradores. Personagem e ficha são bloqueados na transação. Nível esperado e UUID impedem duplicação e conflitos concorrentes. Rotas antigas de origem/descanso não permitem inventar registros de evolução. Magias, quantidade de escolhas, atributos, subclasse e requisitos de multiclasse são validados no servidor.

## Cartas

Coleção privada recebeu uma nova arte original: câmara de arquivo e mesa de carvalho, luz de velas, pedra e objetos nas bordas. Menu lateral e área de leitura conservam contraste. Arquivo: `public/cards/private-archive-20261012.webp`; prompt e ferramenta embutida registrados em `data/card-private-archive-20261012.json`.

Salão retorna à apresentação imersiva usada pelo Empório/estábulo/mascotes: sala inteira, Anfitrião preservado na própria arte e vitrine/material de madeira e pergaminho sobre o cenário. Catálogo e detalhes têm rolagem própria no computador; no celular, apresentação em sequência. Compra, filtros, conversa e três espaços continuam os mesmos.

## Empório e armaduras de mascotes

A loja sempre inicia na prateleira **Itens mundanos**: primeira entrada, retorno de outra aba e recarga. A seleção dentro da visita continua livre.

Quatro armaduras receberam ilustrações originais transparentes individuais: acolchoada em linho oliva, couro castanho, malha de aço e escamas de metal envelhecido. São conjuntos com construção horizontal própria para quadrúpedes, proteções de cabeça e patas, costuras e fivelas práticas. Arquivos em `public/shop/animal-equipment/pet-armor-{padded,leather,chain,scales}.webp`; prompts, hashes e dimensões em `data/pet-armor-refit-20261012.json`, ferramenta embutida `image_gen`. IDs, preços, pesos e propriedades dos itens conservados; troca somente dos pixels públicos.

## Gravação do administrador

Menu da conta → **Gravar tela**. No VTT, um controle compacto também abre o painel. O seletor nativo permite escolher a superfície; a preferência é **Tela inteira**, para incluir outras janelas. Som e áudio dependem do que for compartilhado nesse seletor. Não há captura de microfone automática.

A mesma gravação continua entre todas as páginas do site, incluindo o VTT, sem nova seleção nem pausa ao navegar. Painel minimizável, prévia, tempo, tamanho, pausa opcional, retomada, finalização e download WebM (ou MP4 se suportado pelo navegador). A mídia fica somente na aba até baixar, sem upload ao servidor. Fechar/recarregar a aba durante uma captura pede a confirmação nativa de saída; encerrar o compartilhamento finaliza o trecho. Uma gravação longa permanece na memória do navegador, portanto o vídeo deve ser baixado antes de fechar a aba.

Só administrador vigente vê o início de gravação. `/api/me` reconsulta `"user".administrador` antes de cada gravação; o seletor é aberto na interação do usuário e a captura somente começa após essa confirmação. Durante a gravação, o painel revalida a sessão por foco e a cada dez segundos; revogação encerra a captura e permite baixar o trecho local já produzido. Sair da conta desmonta o painel e libera todos os tracks. Compatibilidade das APIs: [getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) e [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).

QA automatizado usa somente uma fonte de tela sintética no lugar do seletor do navegador, com encoder `MediaRecorder` real, prévia e download reais; não captura a área de trabalho do usuário. Verifica cinco páginas contínuas, cinco larguras, cancelamento, liberação da captura e revogação de administrador.

## Validação técnica

Testes em PostgreSQL UUID descartável: `scripts/test-character-advancement-isolated.mjs`. Quinze testes focados passaram, incluindo tabelas/escolhas até nível 20, PV, Constituição retroativa, proficiência, multiclasse, círculos, pacto, proteção de administrador, revogação, ownership, duplicação, concorrência e conservação da origem/economia. Suíte geral: 280 aprovados em 290; as dez falhas foram reproduzidas no HEAD anterior em recortes isolados (expectativas antigas do Empório, fixtures de versão do VTT, mundo e busca de título com personagens homônimos). Nenhuma dessas falhas foi atribuída a esta alteração.

Interface: `--browser`, cinco larguras, quatro evoluções reais, magias, subclasse, multiclasse, persistência, páginas de cartas, prateleira inicial e quatro artes transparentes carregadas. Gravação passou por cinco páginas sem nova seleção ou pausa; encoder, prévia e download reais, cancelamento e revogação passaram. CSP de produção inclui somente mídia própria e blobs locais para a prévia.

## Fonte e atribuição

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Fonte primária: https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf. Tabelas e resumos em português preparados para esta implementação. Nenhuma ilustração do livro incorporada.

## Publicação

Imagem `alvorada-cinzenta-app:admin-advancement-cards-v1-20261012` saudável. 41 arquivos do cliente e bundle do servidor conferidos por SHA-256. 117 tabelas idênticas; três tabelas da mesa (`vtt_hotbars`, `vtt_monster_presets`, `vtt_rooms`) receberam edições entre o snapshot e o deploy. Conferência com backup e horários comprovou alterações anteriores à publicação: revisões dos atalhos sem mudança no documento, posição/PV/giro de um preset, tokens e configuração de som da sala. Esses registros atuais foram preservados e novamente conferidos por hash, sem restaurar valores antigos. 8798 arquivos anteriores preservados integralmente. Apenas as quatro imagens de armadura solicitadas substituídas, além das novas mídias/bundles. Backup completo de 476.696.692 bytes decodificado por `pg_restore`, sem restauração sobre o banco. Sem migration, sem testes em produção e sem conceder níveis ao personagem real do usuário. Imagem anterior retida para recuperação; estado do ilustrador anterior preservado.

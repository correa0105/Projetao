# Hall e Lore — acabamento de 16/10/2026

O Hall ocupa toda a largura disponível, removendo o limite de 1600 px do conteúdo compartilhado. Os personagens mantêm suas posições nos pedestais, enquanto números e nomes têm coordenadas próprias, medidas nos centros das faces e placas da pintura. Classe, jogador, pontuação e visita ao perfil ficam em um bloco compacto, alinhado aos demais e centralizado sob a face de cada pedestal. A frase introdutória foi retirada da exibição.

Uma faixa de fumaça procedural liga o final do salão à tabela durante a rolagem. A superfície usa WebGL com resolução limitada a 1000 px e 12 quadros por segundo, acompanha a posição da rolagem e não intercepta cliques. Pausa fora da tela ou em aba oculta, permanece estática com movimento reduzido e tem fallback CSS. Recursos e observadores são liberados ao sair. O degradê inferior evita uma emenda reta no fim da imagem. Busca, tabela, menus e Hall dentro dos perfis continuam disponíveis.

A Lore usa carvão neutro e bronze, aproximando-se de Regras, com seletores e superfícies sem o tom esverdeado anterior. As linhas de pasta têm ícones de 46×42 px, título de 15 px e ações Editar/Excluir próximas do nome; com ações administrativas, cada linha fica abaixo de 90 px. Hierarquia, contadores e permissões permanecem.

O fundo da linha temporal foi substituído por um arquivo noturno com ampulheta, instrumento astronômico, crônicas e vela. Arte original criada com o gerador `image_gen` embutido; arquivo `public/lore-timeline-archive-20261016.webp`, 1672×941 px, 117.240 bytes. Prompt, origem e SHA-256 em `data/lore-timeline-archive-20261016.json`. A imagem anterior é mantida. Texto, eras, engrenagens, som e edição permanecem.

Validação: TypeScript e build do cliente; Hall em sete dimensões e duas versões dentro de Perfis, placas e blocos de informação, largura da tela, navegação, busca, transição animada e estática; Lore e Regras em cinco larguras, com e sem movimento reduzido, dez cenários ao todo. Testados cliques/teclado na linha temporal, abertura do editor, decodificação da nova arte, seis pastas com ações e altura das linhas. O Hall usa PostgreSQL UUID descartável; a inspeção de Lore usa API simulada. Capturas foram inspecionadas.

Publicação somente do cliente e da nova imagem, derivada do release anterior; servidor, migrations e dados de jogo não são modificados. O ilustrador e alterações independentes são preservados.

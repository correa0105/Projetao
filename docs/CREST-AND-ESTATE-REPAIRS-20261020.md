# Brasões e acesso à sede — 20/10/2026

Ajuste final solicitado: cartão de identidade restaurado ao tamanho original. Menu da sede fica dentro do painel Sobre a companhia, imediatamente abaixo de Reposicionar itens, herdando as mesmas cores e apresentação dos botões do painel. Abrir essa ação fecha o painel de informações e apresenta as seções da sede. Fluxos novamente verificados em desktop e celular.

Complemento: a Serpe da muralha também recebeu uma nova arte, com corpo e asas definidos (quatro emblemas revisados no total). A prévia ilustrada fica fixa durante a rolagem dos ajustes em desktop e celular. O cartão de identidade da guilda agora inclui o Menu da sede; a porta externa usa apenas um ícone circular com nome acessível. O token controlado permanece renderizado na passagem pela borda da casa, impedindo a perda de captura do arrasto antes da troca de telhado. Validação real de arrasto com trinta passos, entrada e saída, quatro artes e prévia visível em 1440 e 390 pixels aprovada.

Basilisco, tubarão e mantícora receberam novas artes com anatomia completa e silhuetas mais legíveis. Os IDs existentes foram preservados; os arquivos novos em `public/guild/crest-repairs-20261020/` usam URLs próprias para evitar cache das versões anteriores. Prompts finais, modo imagegen embutido, dimensões e hashes estão em `data/crest-repairs-20261020.json`. Transparência original preservada na conversão WebP.

O botão Estilo clássico foi removido da oficina de brasões ilustrados.

O telhado acompanha a posição do personagem: exterior enquanto estiver fora dos limites internos e interior com visão por paredes ao entrar. Sair restaura o telhado. A prévia manual e a edição continuam disponíveis. O controle externo abre/fecha a porta de entrada pelo mesmo estado compartilhado usado dentro da sede.

Validação: TypeScript e build de produção aprovados; navegador em 1440 e 390 pixels verificou abertura/fechamento externo, entrada e saída do token, visão interna, seleção das três novas artes, salvamento e ausência do botão removido. Publicação incremental apenas do cliente e das três artes; servidor e banco preservados.

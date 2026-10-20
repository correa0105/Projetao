# Brasões e acesso à sede — 20/10/2026

Basilisco, tubarão e mantícora receberam novas artes com anatomia completa e silhuetas mais legíveis. Os IDs existentes foram preservados; os arquivos novos em `public/guild/crest-repairs-20261020/` usam URLs próprias para evitar cache das versões anteriores. Prompts finais, modo imagegen embutido, dimensões e hashes estão em `data/crest-repairs-20261020.json`. Transparência original preservada na conversão WebP.

O botão Estilo clássico foi removido da oficina de brasões ilustrados.

O telhado acompanha a posição do personagem: exterior enquanto estiver fora dos limites internos e interior com visão por paredes ao entrar. Sair restaura o telhado. A prévia manual e a edição continuam disponíveis. O controle externo abre/fecha a porta de entrada pelo mesmo estado compartilhado usado dentro da sede.

Validação: TypeScript e build de produção aprovados; navegador em 1440 e 390 pixels verificou abertura/fechamento externo, entrada e saída do token, visão interna, seleção das três novas artes, salvamento e ausência do botão removido. Publicação incremental apenas do cliente e das três artes; servidor e banco preservados.

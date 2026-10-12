# Imagens da biblioteca inteiras e nomes menores

O botão **Token** já selecionava o arquivo correto, mas o renderizador só reconhecia a variante `/top-down` como silhueta. O mesmo arquivo com URL normal de biblioteca era recortado dentro de um círculo preto com contorno. As imagens locais de `/api/vtt/assets/` agora são desenhadas inteiras, mantendo transparência e proporção, assim como suas variantes de vista superior. A correção também vale para peças já colocadas no mapa, sem editar documentos salvos.

O sangue acompanha a máscara da imagem para manter manchas restritas à silhueta em vez de preencher um disco. Miniaturas circulares do restante do site, retratos externos, seleção, controles, permissões e funções de combate mantêm seu comportamento.

Nomes no mapa usam 11 px em coordenadas de tela e distância de 14 px da base da peça. Ampliar o zoom não aumenta a fonte, evitando os textos enormes mostrados pelo usuário. Os nomes completos e os rótulos das fichas permanecem disponíveis.

Validação: TypeScript e build do cliente; seis testes existentes de renderização dos efeitos; upload real de PNG transparente, botão Token, salvar, recarregar e três níveis de zoom no Edge, em PostgreSQL descartável. Sem erros de JavaScript. Screenshots e relatórios privados em `test-results/raw-tokens` do checkout de validação. Publicação altera somente os bundles do cliente, preservando o servidor, as artes publicadas e os trabalhos pausados.

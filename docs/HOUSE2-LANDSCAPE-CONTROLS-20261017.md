# House 2.0 e VTT — gramas, paisagem e controles

As duas gramas enviadas pelo usuário e duas variações da primeira estão no VTT → Brush do mapa e na House 2.0 → Meu terreno → Pintar chão. São **Grama fina escura**, **Grama campestre**, **Grama fina clara** e **Grama clara rala**, totalizando 42 materiais. A clara e rala é a base visual da House 2.0. As pinturas existentes mantêm seus materiais.

Na revisão posterior de 17/10, **Grama fina clara** passou a ser a primeira opção nos dois editores e a seleção inicial da House 2.0. A busca **Buscar textura** aceita nomes sem acentos e a prévia identifica a textura selecionada. O anexo reenviado coincide com a arte original dessa opção; os 42 IDs e as pinturas salvas continuam válidos.

**Pintar terreno** abre automaticamente o interior da casa do proprietário. Ao sair da ferramenta, a visualização anterior é restaurada. O pincel mostra um círculo cujo diâmetro coincide com o tamanho informado, acompanha o ponteiro mesmo ao mudar o zoom, usa as mesmas coordenadas da pintura e fica legível à noite. A captura de PNG exclui esse indicador. A pintura continua limitada ao terreno próprio, com Salvar, Descartar e cancelamento de ponteiro.

A mistura dos materiais usa uma máscara de transparência contínua, suavizando somente a borda e mantendo a textura nítida. Passadas consecutivas do mesmo material e tamanho se unem antes da suavização, sem anéis de sobreposição. O limite do lote recebe uma margem interna irregular e arredondada que desaparece gradualmente na grama: preencher toda a área não produz mais o corte retangular da imagem enviada. O recorte de segurança continua impedindo pintura fora da propriedade. A mesma renderização se aplica às pinturas já salvas, sem regravar seus dados.

As variações foram criadas com **imagegen embutido**, preservando a ilustração de folhas finas. O mesmo recurso retirou a linha escura da borda do primeiro anexo para que ela não apareça repetida na pintura. O segundo anexo conserva a imagem fornecida. Todas as opções usam WebP e miniaturas. Arquivos finais em `public/vtt/reference-grass-20261017/`; prompts integrais, referências, dimensões e SHA-256 em `data/vtt/house2-grass-20261017/manifest.json`. Protocolo VTT 24 pede atualização de abas antigas antes de aceitar o catálogo expandido.

O rio tem contorno suave com pequenas irregularidades. A máscara suaviza só a margem, conservando a nitidez da água. Trilhas usam pontas arredondadas e se conectam ao ponto mais próximo das curvas reais; os caminhos das doze casas e do poço foram conferidos no SVG renderizado. O poço agora reutiliza a arte detalhada `outdoor-021.webp`, com pedra, madeira, corda e água, sobre uma área irregular de terra ligada à trilha.

Plantas e pedras decorativas automáticas ficam fora da clareira habitada. A paisagem mantém distância de cinco unidades além de cada terreno, incluindo as áreas das casas ilustrativas. A frequência das pedras foi bastante reduzida e elas ficam nas bordas. Móveis colocados pelos jogadores continuam sendo itens próprios.

Árvores agora se distribuem também pelo campo, com espaçamento irregular, tamanhos variados e apenas os três modelos das referências: **Bétula de verão**, **Abeto escuro** e **Carvalho jovem**. Os mesmos três estilos compõem os bosques. Copas respeitam os terrenos e os caminhos reais, incluindo os acessos às portas e ao poço. Os demais modelos permanecem disponíveis na biblioteca do VTT.

Cada gravação altera somente o terreno do proprietário, dentro de uma transação PostgreSQL. O bloqueio da linha do terreno e a revisão impedem que uma aba antiga sobrescreva uma edição recente; nesse caso a API retorna 409 e o rascunho local permanece visível. Um bloqueio transacional por usuário também protege a mesma coleção entre terrenos. Jogadores diferentes podem salvar lotes diferentes simultaneamente. A vizinhança é consultada a cada 15 segundos quando a página está visível, sem operação ou rascunho pendente; atualizações ao vivo por WebSocket ainda não fazem parte desse fluxo.

O giro da mobília da House 2.0 é contínuo em 360°, com precisão de 0,01°. A alça fica centralizada acima da área ocupada pelo item, com ícone sempre na posição correta e seleção desenhada sobre os móveis. Arrastar gira livremente; Shift usa passos de 15°; setas giram 1°. O campo **Ângulo livre** permite informar a orientação. Salvar preserva ângulos decimais; Descartar e Esc recuperam o estado anterior. Os limites consideram a área completa da peça girada. A migration 103 amplia a coluna para `double precision`, mantendo valores e registros existentes. Casas fixas mantêm suas orientações originais.

O relógio fica abaixo do título. O botão **Print em alta qualidade**, exclusivo de administrador, fica ao lado do relógio; no celular aparece como **Print HD**. O PNG captura a vista atual em até 4×, limitado a 8192 pixels por lado e 32 megapixels, sem painéis/alças. A permissão administrativa vigente é conferida no servidor a cada captura. O VTT mantém seu **Print HD** no topo da mesa.

## Validação

- TypeScript e build completo de cliente/servidor em estágio limpo, sem incorporar trabalhos independentes.
- Nove testes de geometria, catálogo e paisagem; treze testes da API House 2.0 em PostgreSQL UUID descartável.
- Navegador House 2.0 em 1920, 1440, 768, 390 e 320 px: giro de 127,25° salvo/recarregado, redimensionamento em ângulo livre, toque/teclado/cancelamento, título/relógio/print sem sobreposição, PNG 5760 × 3600 e revogação administrativa.
- Navegador VTT em três larguras: pintar com os quatro novos brushes, persistir/recarregar, camadas, Ctrl, personagens dos participantes e permissões; PNG 4224 × 3744.
- Revisão visual próxima das margens, poço/trilhas, gramas e captura. Publicação incremental com backup PostgreSQL completo validado e conferência de hashes dos arquivos anteriores e dados das tabelas existentes.
- Revisão desta etapa: quatro testes de paisagem; 14 testes de API, incluindo dois jogadores gravando simultaneamente e rejeição de revisão antiga; fluxo de pintura sem telhado, círculo sincronizado ao zoom, pesquisa e prévia da grama nos dois editores e árvores restritas aos três modelos.
- `node --import tsx scripts/smoke-house2-ground-blend.tsx` renderiza o componente real no Edge, preenche o lote até suas quatro bordas e mede transparência, ausência de salto abrupto e mistura de dois materiais. Prévia com pedras, grama e terra em `test-results/house2-ground-blend/natural-materials.png`; resultado e medidas no JSON ao lado.

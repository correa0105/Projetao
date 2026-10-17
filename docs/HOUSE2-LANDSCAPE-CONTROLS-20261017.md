# House 2.0 e VTT — gramas, paisagem e controles

As duas gramas enviadas pelo usuário e duas variações da primeira estão no VTT → Brush do mapa e na House 2.0 → Meu terreno → Pintar chão. São **Grama fina escura**, **Grama campestre**, **Grama fina clara** e **Grama clara rala**, totalizando 42 materiais. A clara e rala é a base visual da House 2.0. As pinturas existentes mantêm seus materiais.

As variações foram criadas com **imagegen embutido**, preservando a ilustração de folhas finas. O mesmo recurso retirou a linha escura da borda do primeiro anexo para que ela não apareça repetida na pintura. O segundo anexo conserva a imagem fornecida. Todas as opções usam WebP e miniaturas. Arquivos finais em `public/vtt/reference-grass-20261017/`; prompts integrais, referências, dimensões e SHA-256 em `data/vtt/house2-grass-20261017/manifest.json`. Protocolo VTT 24 pede atualização de abas antigas antes de aceitar o catálogo expandido.

O rio tem contorno suave com pequenas irregularidades. A máscara suaviza só a margem, conservando a nitidez da água. Trilhas usam pontas arredondadas e se conectam ao ponto mais próximo das curvas reais; os caminhos das doze casas e do poço foram conferidos no SVG renderizado. O poço agora reutiliza a arte detalhada `outdoor-021.webp`, com pedra, madeira, corda e água, sobre uma área irregular de terra ligada à trilha.

Plantas e pedras decorativas automáticas ficam fora da clareira habitada. A paisagem mantém distância de cinco unidades além de cada terreno, incluindo as áreas das casas ilustrativas. A frequência das pedras foi bastante reduzida e elas ficam nas bordas. Móveis colocados pelos jogadores continuam sendo itens próprios.

O giro da mobília da House 2.0 é contínuo em 360°, com precisão de 0,01°. A alça fica centralizada acima da área ocupada pelo item, com ícone sempre na posição correta e seleção desenhada sobre os móveis. Arrastar gira livremente; Shift usa passos de 15°; setas giram 1°. O campo **Ângulo livre** permite informar a orientação. Salvar preserva ângulos decimais; Descartar e Esc recuperam o estado anterior. Os limites consideram a área completa da peça girada. A migration 103 amplia a coluna para `double precision`, mantendo valores e registros existentes. Casas fixas mantêm suas orientações originais.

O relógio fica abaixo do título. O botão **Print em alta qualidade**, exclusivo de administrador, fica ao lado do relógio; no celular aparece como **Print HD**. O PNG captura a vista atual em até 4×, limitado a 8192 pixels por lado e 32 megapixels, sem painéis/alças. A permissão administrativa vigente é conferida no servidor a cada captura. O VTT mantém seu **Print HD** no topo da mesa.

## Validação

- TypeScript e build completo de cliente/servidor em estágio limpo, sem incorporar trabalhos independentes.
- Nove testes de geometria, catálogo e paisagem; treze testes da API House 2.0 em PostgreSQL UUID descartável.
- Navegador House 2.0 em 1920, 1440, 768, 390 e 320 px: giro de 127,25° salvo/recarregado, redimensionamento em ângulo livre, toque/teclado/cancelamento, título/relógio/print sem sobreposição, PNG 5760 × 3600 e revogação administrativa.
- Navegador VTT em três larguras: pintar com os quatro novos brushes, persistir/recarregar, camadas, Ctrl, personagens dos participantes e permissões; PNG 4224 × 3744.
- Revisão visual próxima das margens, poço/trilhas, gramas e captura. Publicação incremental com backup PostgreSQL completo validado e conferência de hashes dos arquivos anteriores e dados das tabelas existentes.

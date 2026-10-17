# House 2.0 — personagens, pets e visão das casas

O menu **House 2.0 → Meus tokens** mostra todos os personagens ativos da conta e os pets de cada personagem. **Trazer para o mapa** coloca a peça na região que o usuário está vendo; repetir usa **Localizar no mapa**, selecionando a instância existente. Não exige comprar um terreno. A imagem usa o token atual do personagem; quando não há token, usa o retrato ou a silhueta. Pets usam o token de sua aparência/equipamento atual ou a arte básica correspondente.

Arraste com mouse ou toque; a posição é gravada ao soltar. As setas movem 0,25 unidade e Shift aumenta o passo para uma unidade. O painel permite ajustar tamanho/giro e retirar o token sem excluir o personagem ou o pet. A seleção identifica o token que determina a visão atual. A atualização independente de tokens e portas ocorre a cada cinco segundos com a página visível e sem movimento ou gravação local em curso.

O dono pode marcar **Ocultar telhado ao editar**. A coleção e a edição de mobília abrem somente a casa do próprio terreno, mantendo o exterior disponível para organizar a decoração. Pintar terreno conserva a abertura automática. A opção não abre telhados para os outros jogadores.

O pátio passou de **12 × 12 para 18 × 18**: três quadrados adicionais em cada lado, com 2,25 vezes a área. A migration **105_house2_larger_yards.sql** amplia os limites sem mover casas, móveis ou pontos da pintura; o preço e os saldos permanecem iguais. As 36 áreas ativas da instalação atual têm espaço para essa ampliação. Em dados legados muito densos, terrenos que sobreporiam um vizinho conservam seus limites anteriores. Novas vizinhanças usam 18 × 18 mantendo o alinhamento do vilarejo. O enquadramento e o rótulo da edição acompanham o tamanho real. A revisão do lote avança para impedir gravações de uma aba desatualizada.

Durante o movimento, o telhado aparece quando o token está fora e desaparece quando ele entra no perímetro interno da casa. Dentro, a visão externa fica escura; ao sair pela porta, o exterior retorna. Outros tokens dentro de casas cobertas não aparecem sobre o telhado. A captura administrativa preserva os personagens, pets, portas e a visão interna, removendo apenas os controles de seleção.

A porta usa a mesma arte do VTT, com dobradiça fixa, giro de 90° e interpolação cúbica de 380 ms. Movimento reduzido usa a posição final sem animação. O botão fica ao lado da passagem para não cobrir o personagem. O dono pode operar a porta; um visitante precisa aproximar um personagem próprio. A porta não pode fechar sobre um personagem ou pet.

As paredes e a porta usam o perímetro de cada modelo do catálogo, incluindo casas giradas. O servidor confere todo o percurso enviado, a área corporal do token e os limites do mapa. A validação não muda as pinturas, móveis ou as posições fixas das casas.

## Dados e permissões

A migration **104_house2_tokens.sql** adiciona `door_open` aos terrenos e cria `house2_tokens`. Uma instância por personagem/pet em cada vizinhança evita duplicações. Tokens têm revisão própria: duas pessoas podem salvar os próprios movimentos sem regravar o documento do mapa ou o terreno. Uma revisão antiga retorna 409; editar ou retirar token alheio retorna 403, inclusive para administrador.

O servidor deriva propriedade, nome e imagem das tabelas de personagens/pets; não aceita controlador, imagem, preço ou recursos enviados pelo cliente. A biblioteca é privada da conta. A rota compartilhada da imagem só funciona para uma peça colocada naquela vizinhança e um personagem ativo; a imagem deixa de ser acessível quando o token é retirado. Retornos não incluem e-mail, ouro, inventário ou ficha privada.

Rotas em `server/house2-tokens.ts`, tipos/geometria em `shared/house2-tokens.ts`, interface em `src/House2Tokens.tsx` e visão/porta em `src/House2Doors.tsx`.

## Validação

- `node scripts/test-house2-tokens-isolated.mjs`: autenticação, biblioteca de dois personagens, pets próprios, importação simultânea sem duplicação, imagens privadas/compartilhadas, dois jogadores movimentando ao mesmo tempo, revisão antiga, limites, paredes, porta fechada/aberta, passagem ocupada, retirada e preservação dos dados originais.
- `node scripts/test-house2-tokens-isolated.mjs --browser`: personagens e pets pela interface, arraste real através da porta, posição após recarregar, telhado automático, edição do proprietário, dobradiça estável, exterior preto medido nos pixels, PNG HD, visitante sem controle e quatro larguras.
- Regressões de House 2.0 e VTT, incluindo compras, pintura, grama, árvores, giro da mobília, camadas, personagens da mesa e captura administrativa.
- A suíte específica tem sete testes de tokens/pátios e a migração do vilarejo também foi conferida com mais de doze terrenos antigos comprados: casas, móveis, saldos e registros continuam preservados e não há sobreposição.
- Publicação incremental com backup PostgreSQL validado. A auditoria compara cada campo de todos os terrenos com a expansão exata esperada; somente limites/revisão e o estado fechado padrão da porta são acrescentados/alterados. A nova tabela de tokens e os dois registros de migrations são conferidos separadamente.

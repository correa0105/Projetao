# Barba, bigode, cor e grisalho — 23/10/2026

Pedido: seletores ilustrados como o de chifres, disponíveis em todas as espécies masculinas, exceto Warforged.

- Seis opções de barba **contando Sem barba**: Sem barba, Por fazer, Curta, Cheia, Cavanhaque e Longa trançada.
- Seis modelos de bigode **mais Sem bigode**: Fino, Cheio, Pontas curvadas, Morsa, Ferradura e Inglês, além de Sem bigode.
- Cor compartilhada da barba e do bigode: Marrom, Preto, Branco ou Loiro. `graying` é um boolean independente: mistura fios prateados à cor base sem substituí-la. Idoso/Ancião não forçam grisalho quando a opção está desligada.
- As escolhas são independentes: barba cheia pode ser combinada com Sem bigode; bigode pode existir com Sem barba. Nenhum modelo concede acessórios, presilhas, joias ou bônus.

`choices.facialHair` guarda `{beard,mustache,color,graying}`. O schema é fechado, com enums e boolean; o servidor rejeita uso sem `physicalTraits.gender=male` e em Warforged. Trocar gênero para feminino ou espécie para Warforged limpa os campos no formulário para evitar valores ocultos. Fichas/jobs antigos sem a escolha continuam válidos e não recebem barba, raspagem ou cor automaticamente. Clicar em um modelo inicializa o outro em Sem e a cor Marrom, com controles explícitos para ajustar tudo antes de enviar. Os campos de cor ficam desabilitados se ambos os modelos forem Sem.

Por pedido explícito, a personalização vale também para Elfo, Draconato e demais espécies masculinas, adaptando pelos à anatomia racial sem humanizar focinho, escamas, orelhas, chifres ou dentes. As pranchas são manequins demonstrativos, nunca referências de identidade, roupa ou paleta. A idade e o porte escolhidos continuam preservados.

As duas pranchas foram criadas com **imagegen embutido**, preservadas em PNG original e inspecionadas visualmente:

- `public/character-creation/beards-20261023.png`: 1536 × 1024, grade 3 × 2.
- `public/character-creation/mustaches-20261023.png`: 1774 × 887, grade 4 × 2, última célula vazia.
- Prompts completos, dimensões, origem e SHA-256: `data/character-creation/facial-hair-20261023.json`.

A interface usa recortes SVG das células sem modificar os originais e preparação local/cache das imagens, sem reabrir loading global. Referências temporárias de geração copiam apenas as duas células escolhidas, sem redimensionar, lado a lado: barba à esquerda, bigode à direita. A prancha combinada ocupa um único anexo. Ela vem antes dos chifres para preservar o papel da última referência do Tiefling. O plano continua limitado a cinco anexos, usando prancha de equipamentos quando necessário.

Retrato, token, correções e revisão recebem modelos, ausência de pelos, cor e grisalho. `facial_hair_correct=true` é obrigatório quando a escolha existe; false ou campo ausente impede publicação e aciona correção/erro. Manter separados os checks de anatomia, roupa, cabeça Warforged e características físicas. No token, julgar somente partes visíveis, sem abrir elmo, mudar câmera ou expor rosto oculto. Vestir e gerar novamente leem a escolha salva na ficha.

Validação: 12 testes locais descartáveis de regras, schema, persistência via API, legado, espécie/gênero, combinações, invariância mecânica, originais por hash/pixels, limite de anexos e rejeição explícita de revisão falsa/ausente no retrato/token. CLI de geração simulada, sem cobrar gerações do aplicativo. Navegador valida todas as espécies, 6/7 modelos, cores, grisalho independente, limpeza de campos ao trocar gênero, criação/retomada e layout em 1440/768/390/320 px.

Publicação pendente: o hPanel da Hostinger informa que a VPS srv2083419.hstgr.cloud / 200.141.20.34 está em manutenção e temporariamente indisponível; SSH e HTTPS expiraram nas tentativas. A implementação foi validada localmente. Preparar pacote incremental para publicar quando o provedor restabelecer o acesso, sem reiniciar a VPS durante a manutenção. Recarregar o ilustrador somente quando ambas as filas estiverem ociosas; o processo novo precisa estar pronto antes de disponibilizar escolhas que o schema antigo desconhece.

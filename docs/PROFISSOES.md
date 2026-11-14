# Profissões

**Explorar → Profissões** reúne 25 oficinas e 125 receitas, cinco por ofício. Cada oficina tem cenário próprio e três ou quatro etapas visuais de trabalho: dosagem, temperatura, corte, tensão, ordem de montagem, marcação de moldes ou traçado de rotas, conforme o ofício. As novas interações incluem misturar proporções, encaixar peças nos respectivos lugares e desenhar seguindo pontos dourados. O desenho aceita mouse, toque e botões para avançar entre os pontos.

## Acesso e fabricação

A bancada é liberada pela proficiência correspondente na ficha concluída do personagem selecionado, calculada pelo servidor com os avanços e as alterações administrativas vigentes. As outras oficinas continuam disponíveis para visita e consulta. Instrumentos compartilham Luteria e música; jogos de mesa compartilham Jogos e peças. Clicar na oficina ou informar uma classe pelo navegador não concede profissão.

Cada personagem evolui separadamente em cada ofício, do nível 1 ao 10. As duas receitas iniciais concedem 20 EXP por criação recolhida. As receitas dos níveis 3, 6 e 10 concedem, respectivamente, 35, 60 e 100 EXP, exigindo mais materiais e preparo. Os limites acumulados de experiência são 0, 40, 100, 200, 360, 600, 950, 1.400, 2.000 e 2.800. O livro mostra o nível exigido e a experiência; é possível consultar uma receita ainda bloqueada. O servidor confere o nível ao iniciar e concede experiência uma única vez, na mesma transação da entrega.

O livro da oficina informa o produto, a quantidade, o prazo e os materiais consumidos. **Usar materiais e iniciar** desconta as quantidades reais da mochila em uma transação e salva o trabalho. Itens equipados ou reservados para companheiros não podem ser consumidos. O cofre não substitui materiais ausentes da mochila. Cada personagem mantém um trabalho ativo; a oficina pode ser fechada e retomada depois.

As etapas são conferidas individualmente pelo servidor. A referência dourada indica o ajuste, a sequência ou os pontos a executar. Misturas devem atingir as proporções e totalizar 100%; encaixes respeitam a ordem indicada; traçados precisam seguir os pontos e permanecer próximos da guia. Uma tentativa incorreta pode ser refeita sem novo consumo. Reenvios de rede e duas janelas não avançam a mesma etapa duas vezes.

O prazo começa ao iniciar a produção e corre em horas reais com o site fechado. A poção de cura exige 24 horas. **Recolher criação** só é liberado depois do prazo e das etapas; a entrega ocorre uma única vez. A mochila recebe os itens existentes do catálogo, incluindo todas as peças reais quando o resultado é uma armadura completa. Mapas, documentos, objetos de cena e outros produtos narrativos não inventam bônus, autorizações, locais revelados ou benefícios de combate.

## Materiais de aventura e Empório

Vinte e três matérias-primas, como couro, madeira, minérios, plantas, argila, pigmentos, registros de exploração, seda rara, liga refinada e essência arcana, são itens reais de inventário e ficam fora da venda do Empório. As receitas também exigem insumos já vendidos na loja: ampolas, garrafas, tinta, papel, pergaminho, óleo, barbante e outros. As compras e os preços administrativos continuam usando o sistema existente.

**Entregas de mesa** permite ao mestre selecionar uma mesa que conduz, um personagem participante, o material, a quantidade e sua origem na aventura. A API verifica a permissão vigente da mesa e a participação do personagem. Espectadores não recebem entregas. Administradores com a permissão VTT conservam o alcance já definido para essa área. A entrega tem registro de auditoria e chave de reenvio, sem dar ao jogador uma opção de criar seus próprios materiais.

## Acesso de administrador

A concessão solicitada para a conta proprietária fica em `profession_administrator_access`, vinculada ao ID da conta. O servidor exige essa concessão habilitada e administrador global vigente a cada operação; a prévia básica suprime o acesso. Ser administrador global ou por área, isoladamente, não libera as oficinas. A concessão permite todas as profissões e níveis, com materiais virtuais ilimitados somente na bancada. É necessário selecionar um personagem próprio. Não altera proficiências da ficha, quantidades reais da mochila ou permissões de outras contas. As etapas e os prazos de criação continuam valendo. Trabalhos iniciados nesse modo registram `materials_waived`.

## Dados e arte

A migration 151 adiciona trabalhos, ações e entregas auditadas. A 152 adiciona progresso por personagem/ofício, experiência única por projeto e concessões administrativas específicas. Trabalhos já recolhidos recebem os 20 EXP correspondentes uma única vez, sem repetir itens. As migrations não redefinem inventários, escolhas da ficha, ouro ou compras. As receitas são fotografadas ao iniciar o projeto para preservar os requisitos de uma produção em curso. O seed registra materiais e produtos novos sem conceder unidades às contas.

Os 25 cenários foram gerados com o recurso embutido `image_gen`. Originais PNG em `artwork-archive/professions-20261113/`; exibição WebP de até 1600 pixels e miniaturas em `public/professions/20261113/`. Prompts completos, arquivos e hashes em `data/professions/art-20261113.json`. Emblemas reutilizam o sistema de treinamentos existente.

Materiais e produtos agora usam ilustrações de inventário: 50 ícones transparentes em `public/professions/icons-20261113/`, com originais preservados em `artwork-archive/profession-icons-20261113/`. São 49 imagens geradas pelo recurso embutido e um kit de ferramentas reutilizado da arte existente. `data/professions/icons-20261113.json` registra prompts, origem e hashes. Equipamentos e insumos já existentes conservam suas artes do catálogo; produtos narrativos avançados reutilizam a ilustração da família correspondente.

## Verificação

`npm run test:professions` cria um PostgreSQL descartável com o padrão `alvorada_test_<uuid>` e executa `tests/professions.test.ts`. A verificação cobre as 125 receitas, posse, ficha e proficiência, consumo atômico, reservas, reenvios concorrentes, sete tipos de etapa, prazo, entrega e experiência únicas, níveis, peças de armadura e concessão de materiais somente pelo mestre autorizado. Também confere a concessão exclusiva ao administrador autorizado, ausência de consumo real e revogação imediata. Sessenta contas independentes produzem e recolhem simultaneamente sem misturar recursos.

A revisão no navegador cobre as 25 oficinas, imagens dos materiais e receitas, novas interações, bloqueio e liberação por nível, experiência, concessão administrativa com mochila vazia e larguras de 1440, 768, 390 e 320 pixels. A implantação preserva os arquivos anteriores e exige backup PostgreSQL validado.

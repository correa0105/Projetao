# Profissões

**Explorar → Profissões** reúne 25 oficinas e 50 receitas. Cada oficina tem cenário próprio e três etapas visuais de trabalho: dosagem, temperatura, corte, tensão, encaixe, ordem de montagem, marcação de moldes ou traçado de rotas, conforme o ofício.

## Acesso e fabricação

A bancada é liberada pela proficiência correspondente na ficha concluída do personagem selecionado, calculada pelo servidor com os avanços e as alterações administrativas vigentes. As outras oficinas continuam disponíveis para visita e consulta. Instrumentos compartilham Luteria e música; jogos de mesa compartilham Jogos e peças. A profissão não é concedida por clicar na oficina, pela classe informada pelo navegador ou pela função administrativa da conta.

O livro da oficina informa o produto, a quantidade, o prazo e os materiais consumidos. **Usar materiais e iniciar** desconta as quantidades reais da mochila em uma transação e salva o trabalho. Itens equipados ou reservados para companheiros não podem ser consumidos. O cofre não substitui materiais ausentes da mochila. Cada personagem mantém um trabalho ativo; a oficina pode ser fechada e retomada depois.

As três etapas são conferidas individualmente pelo servidor. A referência dourada indica o ajuste, a sequência ou os pontos a executar. Uma tentativa incorreta pode ser refeita sem novo consumo. Reenvios de rede e duas janelas não avançam a mesma etapa duas vezes.

O prazo começa ao iniciar a produção e corre em horas reais com o site fechado. A poção de cura exige 24 horas. **Recolher criação** só é liberado depois do prazo e das etapas; a entrega ocorre uma única vez. A mochila recebe os itens existentes do catálogo, incluindo todas as peças reais quando o resultado é uma armadura completa. Mapas, documentos, objetos de cena e outros produtos narrativos não inventam bônus, autorizações, locais revelados ou benefícios de combate.

## Materiais de aventura e Empório

Vinte matérias-primas, como couro, madeira, minérios, plantas, argila, pigmentos e registros de exploração, são itens reais de inventário e ficam fora da venda do Empório. As receitas também exigem insumos já vendidos na loja: ampolas, garrafas, tinta, papel, pergaminho, óleo, barbante e outros. As compras e os preços administrativos continuam usando o sistema existente.

**Entregas de mesa** permite ao mestre selecionar uma mesa que conduz, um personagem participante, o material, a quantidade e sua origem na aventura. A API verifica a permissão vigente da mesa e a participação do personagem. Espectadores não recebem entregas. Administradores com a permissão VTT conservam o alcance já definido para essa área. A entrega tem registro de auditoria e chave de reenvio, sem dar ao jogador uma opção de criar seus próprios materiais.

## Dados e arte

A migration 151 adiciona somente trabalhos, ações e entregas auditadas. Não redefine inventários, escolhas da ficha, ouro, compras ou trabalhos anteriores. As receitas são fotografadas ao iniciar o projeto para preservar os requisitos de uma produção em curso. O seed registra materiais e produtos novos sem conceder unidades às contas.

Os 25 cenários foram gerados com o recurso embutido `image_gen`. Originais PNG em `artwork-archive/professions-20261113/`; exibição WebP de até 1600 pixels e miniaturas em `public/professions/20261113/`. Prompts completos, arquivos e hashes em `data/professions/art-20261113.json`. Emblemas e ícones reutilizam o sistema de treinamentos existente.

## Verificação

`npm run test:professions` cria um PostgreSQL descartável com o padrão `alvorada_test_<uuid>` e executa `tests/professions.test.ts`. A verificação cobre as 50 receitas, posse, ficha e proficiência, consumo atômico, reservas, reenvios concorrentes, etapas, prazo, entrega única, peças de armadura e concessão de materiais somente pelo mestre autorizado. Sessenta contas independentes também produzem e recolhem simultaneamente sem misturar recursos.

A revisão no navegador cobre as 25 oficinas, os quatro tipos de interação, retomada após recarregar, recebimento na mochila, entrega pelo mestre e larguras de 1440, 768, 390 e 320 pixels. A implantação preserva os arquivos anteriores e exige backup PostgreSQL validado.

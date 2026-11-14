# Profissões

**Explorar → Profissões** reúne 25 oficinas e 618 receitas. Ferraria tem 109 receitas, Tecelagem 59, Joalheria 56, Alquimia 49 e Couraria 32. O livro tem busca e lista com rolagem; clicar em uma receita mostra seus efeitos, nível, duração, resultado e requisitos. Equipamentos existentes usam a descrição real do catálogo.

## Acesso e fabricação

A bancada é liberada pela proficiência correspondente na ficha concluída do personagem selecionado, calculada pelo servidor com os avanços e as alterações administrativas vigentes. As outras oficinas continuam disponíveis para visita e consulta. Instrumentos compartilham Luteria e música; jogos de mesa compartilham Jogos e peças. Clicar na oficina ou informar uma classe pelo navegador não concede profissão.

Cada personagem evolui separadamente em cada ofício, do nível 1 ao 10. Os limites acumulados de experiência são 0, 40, 100, 200, 360, 600, 950, 1.400, 2.000 e 2.800. O livro mostra o nível exigido e a experiência de cada receita; é possível consultar uma receita ainda bloqueada ou durante outra produção. O servidor confere o nível ao iniciar e concede experiência uma única vez, na mesma transação da entrega. As receitas antigas preservam sua experiência; as novas variam conforme o nível.

O livro da oficina informa o produto, a quantidade, o prazo e os materiais consumidos. **Usar materiais e iniciar** desconta as quantidades reais da mochila em uma transação e salva o trabalho. Itens equipados ou reservados para companheiros não podem ser consumidos. O cofre não substitui materiais ausentes da mochila. Cada personagem mantém um trabalho ativo; a oficina pode ser fechada e retomada depois.

A produção é automática: tendo os materiais, basta iniciar e esperar. As antigas etapas de ajustes, proporções, encaixes e traçados deixaram de ser obrigatórias, inclusive para trabalhos em andamento. A ajuda na bancada é opcional: uma ação reduz até 30 minutos do prazo e pode ser repetida somente depois de duas horas reais. A animação acompanha o ofício: marteladas na forja, mistura, escrita, costura, entalhe, polimento, forno ou preparo culinário. A API verifica dono, proficiência, estado, prazo e intervalo com o relógio do PostgreSQL, registra cada ajuda e impede reenvios ou duas abas de reduzir o prazo duas vezes. Não gasta novos materiais nem concede experiência extra.

O prazo começa ao iniciar a produção e corre em horas reais com o site fechado. A poção de cura exige 24 horas. **Recolher criação** é liberado quando o prazo terminar; a entrega ocorre uma única vez. A mochila recebe os itens existentes do catálogo, incluindo as peças reais quando o resultado é uma armadura completa. Projetos guardam a receita iniciada, preservando custos e resultados anteriores. Produtos narrativos antigos continuam narrativos; os novos preparos de apoio têm efeitos explícitos.

## Materiais de aventura e Empório

Vinte e cinco matérias-primas ficam fora da venda do Empório. As receitas também exigem insumos existentes da loja. Referências de preço em `shared/profession-reference-prices.json` definem requisitos mais raros para os itens caros sem alterar preços da loja: a partir de 1.000 PO, catalisador raro e ofício de nível 6; a partir de 10.000 PO, núcleo de obra-prima e nível 10. Peças muito valiosas exigem mais componentes raros e até sete dias de preparo. As receitas e os produtos usam IDs reais, sem conceder itens por visualizar ou recarregar.

No VTT, **Materiais da aventura** permite ao mestre vincular uma missão ou registrar os inscritos de uma aventura temática. A inscrição define as vagas: X jogadores distintos = X d100, mesmo se um deles tiver dois personagens. Missões usam seus inscritos reais. As chances e a lista ficam fixadas ao liberar; uma missão não pode abrir outro sorteio em outra sala. Cada jogador escolhe um personagem inscrito e um ofício habilitado na ficha. O servidor calcula seu nível atual e usa a tabela correspondente, excluindo materiais acima desse nível.

Há faixas de tabela nos níveis 1, 3, 6 e 10. Materiais novos avançados começam raros; os antigos ganham chance e quantidade conforme o ofício avança. Catalisadores e núcleos possuem limites baixos de chance também na configuração do mestre. O painel mostra as probabilidades efetivas, os intervalos do d100 e os resultados ×2. Os valores 91–100 concedem o dobro do material; o mesmo d100 resolve tudo, sem outra rolagem escondida. Um resultado sem material também usa a única tentativa.

Um inscrito sem ofício habilitado para as tabelas liberadas registra seu d100 sem recompensa de profissão. Isso não concede proficiência nem bloqueia o registro de conclusão dos demais inscritos.

O mestre pode usar a tentativa de um inscrito ausente; não ganha dados extras. A presença é atualizada no VTT e o servidor recusa rolar por um jogador conectado que pode usar seu próprio dado. Resultados ficam reservados. Somente o registro de conclusão, com todos os d100 usados e resumo da aventura, entrega itens em uma transação com auditoria. Missões ativas são concluídas junto com suas recompensas normais; missões já concluídas não pagam ouro novamente. A conclusão pelo mural também respeita os sorteios pendentes. O antigo endpoint de entrega manual retorna 410 e não concede unidades.

## Preparos e bônus em perícias

São 48 preparos de apoio em 16 ofícios. As versões dos níveis 3, 6 e 10 concedem +1, +2 e +3, respectivamente, por 30, 60 e 90 minutos reais. Incluem guias de trilhas, anotações de estudo, pigmentos de camuflagem, cartas de estratégia, lentes e outros recursos. São regras da casa identificadas na descrição, consumidas pela ficha do VTT. Apenas um preparo de ofício pode estar ativo por personagem; o novo substitui o anterior. Reenvios não consomem nem estendem o efeito novamente.

O bônus aparece na ficha do site e na ficha do VTT. Os botões de perícia do VTT calculam o modificador e a validade do preparo no servidor a cada rolagem, inclusive após expirar. O cliente não escolhe valor, duração ou bônus. A expiração não altera os atributos, escolhas ou proficiências permanentes da ficha.

## Acesso de administrador

A concessão solicitada para a conta proprietária fica em `profession_administrator_access`, vinculada ao ID da conta. O servidor exige essa concessão e administrador global vigente; a prévia básica suprime o acesso. Ela libera todas as profissões e receitas com materiais virtuais ilimitados na bancada, selecionando um personagem próprio. Os prazos e o intervalo entre ajudas permanecem. Não altera as quantidades reais da mochila nem as permissões de outras contas. O sorteio do VTT ainda respeita o nível real do ofício e uma tentativa por inscrito.

## Dados e arte

As migrations 151 e 152 preservam trabalhos, entregas legadas, progresso e concessões. A 153 adiciona ajudas auditadas e seu intervalo; a 154 adiciona sorteios, rolagens e conclusões de mesa; a 155 adiciona preparos temporários e idempotência de testes de perícia. Não redefinem inventários, escolhas da ficha, ouro ou compras. O seed registra materiais e produtos novos sem conceder unidades às contas.

Os 25 cenários foram gerados com o recurso embutido `image_gen`. Originais PNG em `artwork-archive/professions-20261113/`; exibição WebP de até 1600 pixels e miniaturas em `public/professions/20261113/`. Prompts completos, arquivos e hashes em `data/professions/art-20261113.json`. Emblemas reutilizam o sistema de treinamentos existente.

Materiais e produtos agora usam ilustrações de inventário: 50 ícones transparentes em `public/professions/icons-20261113/`, com originais preservados em `artwork-archive/profession-icons-20261113/`. São 49 imagens geradas pelo recurso embutido e um kit de ferramentas reutilizado da arte existente. `data/professions/icons-20261113.json` registra prompts, origem e hashes. Equipamentos e insumos já existentes conservam suas artes do catálogo; produtos narrativos avançados reutilizam a ilustração da família correspondente.

## Verificação

As animações usam 17 novas artes do recurso embutido `image_gen`: nove bancadas e oito ferramentas em `public/professions/actions-20261114/`. Originais PNG em `artwork-archive/profession-actions-20261114/`, prompts e hashes em `data/professions/actions-20261114.json`. As cópias WebP preservam alfa. As ferramentas se movem separadamente, com impactos, partículas, vapor ou traço de tinta; movimento reduzido mantém o retorno textual e o benefício.

`npm run test:professions` usa um PostgreSQL descartável `alvorada_test_<uuid>`. Cobre as 618 receitas, produção sem etapas, consumo real, reservas, prazos, ajudas concorrentes e intervalo de duas horas, entrega/experiência únicas, níveis, posse e acesso exclusivo de administrador. Também cobre inscritos, um d100 por jogador, presença, profissões, raridade, ×2, ausência de entrega antecipada, conclusão atômica da missão, buffs reais, não acúmulo, expiração e rolagens de perícia. Sessenta contas independentes produzem e recolhem simultaneamente.

A revisão no navegador cobre as 25 oficinas, imagens e descrições das receitas, animação e ajuda, produção automática, buffs, fluxo de d100 com mestre e jogador e larguras de 1440, 768, 390 e 320 pixels. A implantação preserva assets anteriores e exige backup PostgreSQL validado. A retenção autorizada mantém o atual e os dois backups anteriores.

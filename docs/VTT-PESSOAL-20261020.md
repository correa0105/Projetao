# VTT pessoal e link permanente — 20/10/2026

Cada conta, inclusive básica, pode preparar e editar sua própria mesa virtual antes de registrar uma missão. Ser mestre significa ser dono da mesa; isso não concede administração do site, ouro ilimitado ou permissão para editar mesas alheias.

## Um endereço da conta para todas as missões

`vtt_personal_spaces` mantém um `public_id` permanente por conta e aponta para a sala ativa do seu VTT. O endereço é `/#vtt?table=PUBLIC_ID`. O servidor prefere a origem de rede configurada em `APP_ORIGIN`, para que o mestre usando localhost copie um endereço acessível aos jogadores pelo Radmin. `APP_SHARE_ORIGIN` pode escolher outra origem da mesma lista; sem origem de rede, usa a primeira origem local configurada.

- Abrir o VTT provisiona uma mesa pessoal se a conta ainda não tiver uma. Isso independe do mural.
- A criação de uma missão usa o endereço da conta; não cria uma mesa para cada missão nem pede escolha de mesa no formulário.
- O formulário mostra o link e permite abrir a preparação em outra aba. O aviso da missão permite entrar na mesa, e seu autor pode copiar o endereço.
- O identificador não muda ao publicar outra missão, renomear a mesa, mudar de mapa, abrir outro projeto salvo ou renovar um convite avulso.
- Copiar o link fixo pelos controles do VTT não exibe faixa de confirmação, por pedido do usuário. A cópia e os avisos de eventual falha permanecem.
- Quem chega sem sessão faz login e continua no mesmo link. A entrada é como jogador; ser dono da mesa continua sendo a única condição para mestrar.
- O jogador recebe somente o mapa ativo e o conteúdo que pode ver. As trocas de mapa acompanham a sincronização da sala. Se o mestre abrir outra sala própria preservada, quem entrou pelo endereço pessoal acompanha essa sala também.

Mesas e convites anteriores permanecem válidos. O código avulso ainda pode ser renovado, enquanto o endereço pessoal é fixo. Os jogadores continuam podendo navegar pelo mapa, com visão, névoa, notas privadas e camadas do mestre filtradas no servidor.

## 100 MB exclusivamente para imagens externas

A franquia é de 104.857.600 bytes por conta, somando as imagens externas armazenadas nas suas salas. Considera os bytes efetivamente salvos pelo fluxo existente de upload. O catálogo embutido, as artes importadas dos personagens/companheiros, os documentos de cena e os áudios não entram nesta franquia de imagens externas.

O contador aparece na biblioteca de imagens e nas configurações. O banco serializa aumentos de espaço por conta para impedir ultrapassagem por envios concorrentes em salas diferentes. A tentativa excedente retorna HTTP 413 sem gravar o arquivo. Exclusões liberam espaço; a reutilização de um arquivo já salvo não cobra outra cópia na mesma sala. Conteúdo legado não é removido pela migration; contas eventualmente acima do limite precisam liberar espaço antes de aumentar seu armazenamento externo.

## Persistência e permissões

Migration `118_vtt_accounts_and_missions.sql`: cria o vínculo pessoal das contas existentes e a fiscalização da cota de imagens. Preserva missões, mapas, arquivos e códigos antigos. O vínculo inicial aproveita a sala própria atualizada mais recentemente, quando houver.

Foram atualizadas as verificações de dono no editor, fichas de sessão, restauração de recursos, combate, magias, dano, sons, companheiros, atalhos, acervo privado e captura da própria mesa. Jogadores e espectadores não ganham controles do mestre; permissões globais de administração continuam separadas.

## Verificação

`node scripts/test-vtt-personal-isolated.mjs` executa o novo teste de VTT pessoal e regressões de acesso. `--browser` verifica preparação por conta básica, cópia do endereço, login a partir do link, acompanhamento de mapa/sala ativa, publicação de missão e desktop/celular. `--all` executa a suíte completa. Todos usam PostgreSQL com nome UUID descartável.

O teste da cota preenche o espaço no banco descartável, disputa os bytes restantes entre duas salas e verifica bloqueio de upload, isolamento entre contas, importação de personagem sem consumo da franquia e liberação por exclusão. A validação de navegador gera capturas e relatório em `test-results/vtt-personal/`.

A publicação é incremental sobre `lore-initial-20261020`, sem reintroduzir a otimização revertida. Usa a fonte isolada da versão instalada com somente este recurso aplicado; preserva trabalhos independentes e o acesso pelo Radmin. Imagem preparada: `alvorada-cinzenta-app:vtt-personal-20261020`.

Validação focada: seis testes do VTT pessoal aprovados, incluindo link de rede, cota, concorrência, propriedade e conteúdo privado. O navegador exercita também perfil, criação de Tiefling e mapa mundi. As regressões ampliadas apresentam quatro expectativas divergentes anteriores ao recurso (catálogo experimental de 334 versus 330, normalização de efeitos e edição do próprio perfil), com 41 testes aprovados e seis falhas contando os agrupamentos. A suíte completa foi executada em banco descartável, mas apresentou outras falhas legadas e ficou retida após integração; foi interrompida e o banco descartável removido. Não declarar a suíte completa aprovada.

# Alvorada Cinzenta — regras essenciais

Este arquivo contém apenas decisões vigentes e acordos permanentes. O pedido atual do usuário prevalece sobre decisões antigas. Detalhes por área e estado atual estão em [docs/CONTEXTO.md](docs/CONTEXTO.md); consulte somente o assunto afetado. Os registros anteriores estão arquivados, sem leitura obrigatória.

## Forma de trabalhar

- Comunicar e escrever a interface em português brasileiro. Executar o pedido autorizado sem ampliar o escopo nem repetir perguntas já respondidas.
- Dimensionar o trabalho: ajuste pequeno pede alteração e verificação focadas; lógica de jogo, permissões e dados pedem testes das regras afetadas. Não repetir verificações aprovadas sem mudança ou falha que justifique.
- Documentação apenas: conferir conteúdo, links e diff; não executar build, testes de aplicação ou deploy. Interface: conferir o trecho visual afetado e responsividade quando pertinente. Backend/dados: validar autorização, transações e regressões relacionadas em banco descartável.
- Usar `rg` para localizar código e ler trechos necessários. Não reler cronologias inteiras nem todos os guias em cada tarefa. Não reformatar arquivos grandes por um ajuste localizado.
- Registrar decisões na seção existente do guia correspondente. Não acrescentar diários de commits, PIDs, contagens de testes ou releases no início de AGENTS/README/CONTEXTO. Evidências e histórico ficam no guia da entrega ou em `.local`, conforme sua privacidade.
- Não são necessários subagentes para alterações rotineiras; não delegar sem autorização aplicável.

## Arquitetura, dados e publicação

- Monólito Node.js/TypeScript, React/Vite, Express, PostgreSQL e Docker Compose. Better Auth gerencia autenticação/sessões. Não trocar por site estático, SQLite, localStorage ou outra hospedagem sem pedido explícito; estado de jogo fica no PostgreSQL.
- Toda leitura/escrita privada valida a sessão e a autorização no servidor. Não confiar em dono, preço, saldo, recompensa, resultado de dado ou atributos enviados pelo cliente fora de um endpoint administrativo autorizado.
- Compras, transferências, consumos, recompensas e concessões usam transação, locks e idempotência. Ouro em PC inteiros; preservar estoque, reservas, compras e auditorias. Não conceder novamente algo ao recarregar, importar, excluir ou recriar.
- Migrations numeradas em `db/migrations/`: novas e aditivas, sem editar as já aplicadas. Seeds idempotentes preservam preços administrativos, dados e bens legados.
- Preservar trabalho alheio, backups, artes originais, uploads privados e dados reais. Nunca registrar segredos, cookies ou `.env` no Git/log. Não apagar volumes para reiniciar nem restaurar banco sobre mudanças legítimas.
- Trabalhar na branch **Welson** e enviar alterações solicitadas e validadas para **origin/Welson**, por autorização contínua. Nunca enviar para main.
- Publicação autorizada em **https://alvoradacinzenta.com/**, com backup e validação proporcional à mudança. Preservar assets anteriores, dados de jogo e funcionamento do ilustrador. Guia operacional: `docs/HOSTINGER-20261021.md`; materiais privados em `.local` não vão ao release.
- Ilustrador depende deste PC, login Codex, túnel, supervisor e heartbeat. Não desativar recuperação automática nem transferir credenciais pessoais à VPS. Recarregar o worker somente com filas de personagens e companheiros ociosas; inicialização Windows sem janela/flash. Não prometer serviço com o PC desligado.

## Permissões atuais

- Administrador global vem de `"user".administrador=1`, consultado no banco em cada operação. Não permitir autopromoção por cadastro/perfil; prévia básica não concede privilégios.
- Crowley é administrador **por área**, mantendo global=0: `board`, `events`, `home`, `lore`, `rules`, `tower`, `vtt`, `world`. VTT inclui mesas de outros mestres, sem transferir dono ou controlador. Não ampliar para loja, contas, ouro ilimitado ou edição global de fichas.
- Somente administrador global possui ouro ilimitado e editor completo de fichas próprias/alheias. Ouro ilimitado é capability do servidor, não saldo artificial. Editor de ficha exige revisão atual e auditoria; conserva dono, dados rolados, imagens e inventário. Edições de notas não apagam ajustes locais de combate.
- Jogadores gerenciam seus próprios personagens/bens/missões conforme as regras. Visitas de perfil não revelam e-mail, ouro ou mochila; DMs só entre amigos aceitos, sem acesso administrativo ao histórico. House respeita convites e bloqueios, inclusive para administradores.

## Personagens e arte

- Padrão: **dois slots**. Somente **Pai do Cris e Crowley têm quatro** por concessão explícita da conta. Acampamento próprio/público exibe no máximo dois; trocar ou retirar da tela não exclui a ficha.
- Dados antes da aparência/Vestir: 4d6 descartando o menor, cada resultado mínimo 8 antes dos bônus, soma ajustada dos seis entre 72 e 90. Servidor resolve; resultados e revelação ficam no slot ao excluir/recriar antes do nível 4. Nível 4 libera somente a próxima criação daquele slot, sem apagar histórico.
- Cada personagem novo recebe **6.000 PO uma única vez**, até nova ordem. Equipamento inicial entra na mochila uma única vez, com quantidades reais e ledger; não repor itens descartados/transferidos. Essas regras substituem bônus antigo por conta e ouro de classe/antecedente.
- Cota vigente: **cinco gerações mensais por conta**, compartilhadas entre personagens; criação inicial gratuita; administrador global ilimitado. Mascote/montaria conserva duas gerações próprias. Não zerar uso, cobrar falha ou criar jobs/cotas duplicados.
- Retrato e token superior são imagens separadas, publicadas somente como par válido. Substituições aguardam escolha do dono entre antiga/nova/decidir depois; preservar arte atual, BASE/checkpoints privados e progresso recuperável. Arquivar criação salva falha remove da lista sem apagar dados do slot, histórico ou cota.
- Preservar os originais PNG/alpha, resolução, proporção e qualidade aprovadas. O usuário autorizou cópias leves para exibição, com compressão e tamanho adequados; backgrounds, mapas, máscaras técnicas e coordenadas de atlas ficam preservados. Não substituir BASEs, checkpoints ou originais no banco por essas cópias. Arte nova deve respeitar espécie, anatomia, vista superior real, equipamentos e escolhas de aparência. Revisão anatômica/equipamento/cabeça explícita; não publicar arte reprovada nem validar anatomia só por hash.
- Vestir parte da BASE confiável e referências reais, sem acumular roupas sobre arte já vestida. Montagem e referência do Warforged são modos exclusivos e persistentes; não misturar nem trocar o modo ao vestir. Escolhas cosméticas não concedem itens ou bônus.

## Produto e compatibilidade

- Identidade: Alvorada Cinzenta, tema exclusivamente escuro, tipografia/pergaminho/cobre/azul de noite; sem logo/brasão nem verde vivo na interface. `docs/IDENTIDADE.md` orienta mudanças de tema.
- Loading geral só na entrada/troca inicial de aba; não reaparecer ao usar funções ou adicionar imagens numa aba aberta. Preservar cache privado, revisão e autorização de imagens; não montar prévia de token fora de Personagens/Inventário.
- VTT: preservar sigilo, ownership, protocolos/IDs/atalhos e estado de sessão. Espectador só observa pela visão permitida, inclusive personagem visível do mestre; não controla chat/dados/tokens/recursos. Selecionar token não muda aba, câmera ou documento.
- Personagem, veículo, mascote e montaria usam tokens superiores proporcionais; vínculo mantém posição/rotação relativas, sem puxar a peça. Recursos de combate são da sessão; consumo de item é exceção auditada no inventário original. Importar não restaura gastos.
- Efeitos de tela ficam em **Efeitos do mapa → Tela inteira**, somente Desabamento e Cinzas e brasas. Som/mute e movimento reduzido continuam disponíveis. Som, efeitos e voz preservam canais, volumes locais, sincronização e escolhas salvas.
- Catálogo de monstros/artes está disponível a todas as contas autenticadas, sem tag premium; não substituir tokens já colocados. Referências FA/JB2A/PeriSFX/Tabletop Audio não autorizam copiar ou redistribuir seus arquivos. Usar artes próprias e áudio compatível com site pago, com fontes/licenças.
- Mundo 3D e Reino do Norte são independentes. Preservar geografia aprovada e registros; reino usa imagem publicada fixa em 150%, com pan limitado e pins administrativos. Editor antigo removido da interface; rascunhos e arquivos privados preservados.
- Missões/eventos/ganchos compartilham `board_posts`, sem tabela paralela. Pagamentos/patentes/progressão seguem `docs/PATENTES.md`, resolvidos no servidor; nunca inventar automação pronta para regras apenas descritivas. Preservar fontes/edições das magias e distinguir SRD de conteúdo não SRD.
- Equipamentos humanos não servem automaticamente para animais. Barda de montaria é uma peça inteira; conjuntos de humanoides/mascotes usam as peças reais do catálogo. Compatibilidade, quantidade e reserva são do servidor; preserve bens legados.
- O acervo **330 monstros × quatro versões permanece PAUSADO**, fora de releases até retomada explícita. Pedidos pontuais não o reativam. Completar todos os itens mágicos/regras de níveis altos não deve ser anunciado como concluído sem evidência; consultar o roteiro específico apenas se a tarefa envolver isso.

# Hall, perfis de usuário e guildas — 12/10/2026

Hall da Fama usa a galeria de honra original, personagens reais em pedestais maiores e placas de bronze, prata e ouro. A pontuação, filtros e visitas mantêm suas regras existentes.

Perfis abre a identidade do usuário com avatar circular destacado, amigos e chat privado existente. O menu do avatar inclui Meu perfil. Background pode usar os cenários do site ou uma imagem própria (PNG/JPEG/WebP até 8 MB). Seis bordas, quatro efeitos, cor de destaque e vitrines editáveis/reordenáveis: personagens, crônica, conquistas, cartas, companheiros e guilda. Preferências antigas continuam legíveis; dados privados da ficha/mochila não são expostos. Upload precisa terminar antes de salvar.

Nível de conta separado do nível de personagem: 50 XP por registro legítimo de missão concluída e 20 por conquista; nível 1 + piso(XP/100), máximo 100. Novas vitrines nos níveis 1, 3, 5, 10, 15 e 20, ajustáveis em Guilda → Painel administrativo. A API confere os limites; mudanças administrativas preservam as vitrines já salvas.

Guilda aparece em Menu → Explorar. Uma guilda por conta; até oito jogadores. O fundador escolhe um personagem próprio para pagar, cria o brasão em símbolo/fundo/borda com três cores independentes e administra os convites. Entradas simultâneas respeitam a última vaga. Administrador mantém a política existente de ouro ilimitado, registrando o preço real sem alterar saldo. Compras repetidas cobram uma única vez.

**Configuração inicial necessária:** Guilda → Painel administrativo → Custo de fundação (PO). O preço começa sem valor definido, conforme pedido de deixá-lo configurável. A fundação é liberada quando o administrador salva um valor; 0 é válido para testes. Não foi inventado um preço definitivo.

Sede inicial modesta, com quatro artes próprias: salão principal, ferraria, sala de estar e sala de reunião. Cinco peças iniciais em madeira/couro, decoração separada por sala, 24 peças no total, vistas reais, tamanho, arraste e setas do teclado, três atmosferas e salvamento com revisão. Somente fundador edita. Peças acompanham o chão pela transparência de sua arte. House pessoal/inventário não são alterados.

Prestígio concede nível de guilda (1 + piso(prestígio/100), máximo 100) e patente Ferro/Bronze/Prata/Obsidiana/Lendária. Expansões provisórias configuráveis: Alquimia nível 3, treinamento 5, biblioteca 7, sala do líder 10. A API bloqueia decoração em salas ainda não liberadas. Novas salas usam cenários existentes da House. Requisitos de melhorias de móveis começam sem definição: o administrador escolhe peça, custo do tesouro, prestígio mínimo, semanais concluídas e nível máximo. Melhoria cobra uma vez por nível.

Missões semanais são objetivos próprios da companhia, calculados pelos registros de aventuras concluídas por membros após ingresso: participações, aventuras distintas ou membros participantes. Semana de segunda-feira 00h UTC até a seguinte. Modelos, metas, ouro e prestígio editáveis; instâncias já geradas preservam recompensas. Fundador recebe a recompensa uma vez; ouro entra no tesouro e prestígio aumenta o nível/rank. Livro registra fundação, recompensas e melhorias. Não há concessão de ouro por progresso enviado pelo navegador.

Artes finais via imagegen embutido, sem CLI/API de imagens:

- public/community/hall-of-honor.webp
- public/guild/rooms/main.webp
- public/guild/rooms/forge.webp
- public/guild/rooms/lounge.webp
- public/guild/rooms/meeting.webp

Prompts completos, dimensões e SHA-256: data/community/art-20261012.json. Original 1672 × 941, WebP qualidade 94. Prévia de edição descartada não integra a publicação.

Validação: TypeScript, Vite e tsup; nove testes PostgreSQL descartáveis (compra/replay/concorrência/permissões/capacidade/recompensas/tesouro/upload/vitrines/amizade/chat). Edge real em 1440, 768, 390 e 320 px, quatro salas, editor, convites, perfil, upload e chat, sem erro JavaScript, mídia ausente ou transbordamento horizontal. Build isolado preserva o renderer de moinho já publicado e não inclui os assets/VTT/330 monstros pausados.

Migration aditiva 094 cria sete tabelas de comunidade/guildas; backup completo antes da publicação. As tabelas existentes e arquivos anteriores são auditados. Publicação incremental sobre a imagem raw-library-tokens-v1-20261012. Versão anterior preservada. Branch autorizada Welson.

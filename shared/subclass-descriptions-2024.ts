/** Original Portuguese mechanical summaries. Source names/levels are audited separately. */
export const subclassDescriptions: Record<string, Record<number, string[]>> = {
  'Artífice/alchemist': {
    3: [
      'Ferramentas do ofício: alquimia e herbalismo; reduz à metade o tempo para fabricar poções.',
      'Elixir experimental: cria dois elixires após descanso longo; ação Mágica e espaço de magia criam um adicional, seguindo a tabela de efeitos.',
    ],
    5: [
      'Erudito alquímico: foco de alquimista acrescenta Inteligência a uma cura ou dano de ácido, fogo ou veneno da magia.',
    ],
    9: [
      'Reagentes restauradores: Restauração Menor sem espaço/preparação, usando alquimia; usos ligados à Inteligência.',
    ],
    15: [
      'Maestria química: dano energético adicional, resistências a ácido/veneno, imunidade a Envenenado e uma conjuração de Caldeirão Borbulhante de Tasha por descanso longo.',
    ],
  },
  'Artífice/armorer': {
    3: [
      'Ferramentas do ofício: ferramentas de ferreiro, armaduras pesadas e fabricação mais rápida de armaduras.',
      'Armadura arcana: remove requisito de Força, funciona como foco e permite vestir/retirar rapidamente.',
      'Modelo de armadura: Couraçado, Guardião ou Infiltrador; armas do modelo podem usar Inteligência.',
    ],
    5: ['Ataque extra: dois ataques na ação Atacar.'],
    9: [
      'Armeiro aprimorado: aprende um plano extra de armadura, pode manter mais uma armadura replicada e recebe +1 nos ataques/dano da arma do modelo.',
    ],
    15: [
      'Armadura aperfeiçoada: amplia os ataques e os benefícios próprios de Couraçado, Guardião ou Infiltrador.',
    ],
  },
  'Artífice/artillerist': {
    3: [
      'Ferramentas do ofício: armas marciais à distância, ferramentas de entalhador e fabricação de varinhas mais rápida.',
      'Canhão místico: cria um canhão Pequeno ou Minúsculo por uma hora; ação bônus ativa Lança-chamas, Balista Energética ou Protetor.',
    ],
    5: [
      'Arma de fogo arcana: inscreve um foco especial que acrescenta 1d8 a uma rolagem de dano de magia de artífice.',
    ],
    9: [
      'Canhão explosivo: dano/PV temporários aumentam em 1d8; reação pode detonar o canhão para causar dano energético em área.',
    ],
    15: [
      'Posição fortificada: mantém e comanda dois canhões; cada um concede meia cobertura aos aliados próximos.',
    ],
  },
  'Artífice/battle-smith': {
    3: [
      'Pronto para batalha: armas marciais, uso de Inteligência com armas mágicas e arma como foco; ganha ferramentas de ferreiro.',
      'Defensor de aço: companheiro construto que age no seu turno, comandado por ação bônus.',
    ],
    5: [
      'Ataque extra: dois ataques na ação Atacar; pode substituir um ataque para comandar o defensor.',
    ],
    9: [
      'Impulso arcano: acerto próprio de arma mágica ou do defensor pode causar 2d6 energéticos adicionais ou curar 2d6; usos ligados à Inteligência.',
    ],
    15: [
      'Defensor aprimorado: Impulso Arcano passa a 4d6 e a defesa por reação do construto também causa dano.',
    ],
  },
  'Artífice/cartographer': {
    3: [
      'Ferramentas do ofício: caligrafia, cartografia e criação de pergaminhos mais rápida.',
      'Atlas do aventureiro: mapas mágicos compartilham posições e aprimoram a iniciativa.',
      'Magia cartográfica: Fogo das Fadas sem espaço e teletransporte ao gastar movimento.',
    ],
    5: [
      'Precisão guiada: Inteligência no dano de magias do cartógrafo ou ataques contra alvos de Fogo das Fadas; sofrer dano não rompe sua concentração nessa magia.',
    ],
    9: [
      'Movimento engenhoso: Lampejo de Genialidade também pode teletransportar a si ou outra criatura 9 m.',
    ],
    15: [
      'Atlas superior: o mapa pode evitar uma queda a zero PV e transportar o portador para junto de outro; concede Encontrar o Caminho sem espaço/componentes.',
    ],
  },
  'Artífice/reanimator': {
    3: [
      'Companheiro reanimado: cria um servo de necromancia que obedece a seus comandos e possui Explosão da Morte.',
      'Perícias do reanimador: modifica Poupar os Moribundos para restaurar PV e produzir uma descarga elétrica, com usos por Inteligência.',
    ],
    5: [
      'Modificações estranhas: ao criar o companheiro, escolhe Condutor Arcano ou Ferocidade.',
    ],
    9: [
      'Reanimação aprimorada: Explosão da Morte passa a 4d4 e o dano necrótico ignora resistência.',
      'Modificações macabras: passa a escolher duas modificações, incluindo Inchado e Esquálido.',
    ],
    15: [
      'Reanimação refinada: uma conjuração gratuita de Reviver os Mortos e reação que transfere a vitalidade do companheiro, destruindo-o.',
    ],
  },
  'Bardo/moon': {
    3: [
      'Inspiração da lua: ao conceder Inspiração, pode se tornar invisível e teletransportar 9 m; ao curar com magia, pode gastar Inspiração para ampliar a cura e o deslocamento do alvo.',
      'Saber primal: aprende Druídico, um truque de druida e uma perícia da lista natural.',
    ],
    6: [
      'Bênção do luar: Raio Lunar sempre preparado; uma conjuração especial também cura um aliado quando uma criatura falha na salvaguarda.',
    ],
    14: [
      'Esplendor do anoitecer: Eclipse Inspirado também beneficia o aliado inspirado; Vitalidade Lunar pode usar 1d6 sem gastar Inspiração.',
    ],
  },
  'Bardo/spirits': {
    3: [
      'Canalizador: aprende Orientação com alcance de 18 m e ganha proficiência em cartas de jogo, utilizáveis como foco.',
      'Espíritos do além: Inspiração permite canalizar um espírito da tabela e liberá-lo como ação Mágica; pode gastar um uso para escolher o espírito.',
    ],
    6: [
      'Canalização empoderada: acrescenta 1d6 a uma cura ou dano de magia de bardo com espaço, uma vez por turno.',
      'Manifestação espiritual: Guardiões Espirituais sempre preparado; possui uma conjuração gratuita e opção de conceder cobertura aos aliados na área.',
    ],
    14: [
      'Conexão mística: rola duas vezes para canalizar espíritos e escolhe; resultados iguais permitem escolher qualquer espírito.',
    ],
  },
  'Clérigo/knowledge': {
    3: [
      'Bênçãos do conhecimento: duas perícias entre Arcanismo, História, Natureza e Religião, com Especialização, e uma ferramenta de artesão.',
      'Magia mental: Canalizar Divindade conjura uma adivinhação preparada do domínio sem espaço nem componentes materiais.',
    ],
    6: [
      'Mente livre: telepatia de 18 m com um grupo ligado à Sabedoria; proficiência em salvaguardas de Inteligência ou outra ainda não proficiente.',
    ],
    17: [
      'Previsão divina: ação bônus concede vantagem em testes de d20 por uma hora; descanso longo ou espaço de círculo 6 ou superior recupera o uso.',
    ],
  },
  'Clérigo/grave': {
    3: [
      'Círculo da mortalidade: dano necrótico adicional contra alvos feridos; Poupar os Moribundos como ação bônus e cura máxima em criaturas a zero PV.',
      'Caminho do túmulo: Canalizar Divindade amaldiçoa um alvo, prejudicando ataques/salvaguardas e permitindo dano adicional.',
    ],
    6: [
      'Sentinela às portas da morte: reação reduz à metade o dano de um ataque contra si ou uma criatura muito ferida e anula efeitos de crítico.',
    ],
    17: [
      'Ceifador divino: Canalizar Divindade amplia certas necromancias para um segundo alvo; a morte de um inimigo pode restaurar PV a um aliado.',
    ],
  },
  'Clérigo/arcana': {
    3: [
      'Estudante do arcano: uma perícia e dois truques de mago, usando Sabedoria.',
      'Modificar magia: Canalizar Divindade concede PV temporários a um alvo da magia ou reduz a primeira salvaguarda bem-sucedida contra ela.',
    ],
    6: [
      'Recuperação dissipadora: após uma magia com espaço curar ou encerrar condição, pode conjurar Dissipar Magia sem espaço como parte da mesma ação.',
    ],
    17: [
      'Maestria mágica: aprende quatro magias de mago, uma de cada círculo entre 6 e 9, sempre preparadas.',
    ],
  },
  'Guerreiro/banneret': {
    3: [
      'Recuperação em grupo: Retomar o Fôlego também cura aliados próximos em 1d4 + nível de guerreiro, uma vez por descanso curto ou longo.',
      'Emissário cavaleiresco: Compreender Idiomas como ritual, um idioma e uma perícia social.',
    ],
    7: [
      'Táticas de equipe: aliados beneficiados por Recuperação em Grupo recebem vantagem em testes de d20 até seu próximo turno.',
    ],
    10: [
      'Surto de união: Surto de Ação permite que aliados próximos ataquem ou se movam por reação.',
    ],
    15: [
      'Resiliência compartilhada: reação gasta Indomável para um aliado repetir uma salvaguarda com bônus igual ao nível de guerreiro.',
    ],
    18: [
      'Comandante inspirador: amplia as emanações de recuperação e surto para 18 m e concede imunidade a Enfeitiçado/Amedrontado.',
    ],
  },
  'Guerreiro/arcane-archer': {
    3: [
      'Saber do arqueiro arcano: Arcanismo, Natureza e Druídico ou Prestidigitação; proficiências repetidas permitem substituição.',
      'Disparo arcano: duas opções, dado d6, usos iguais a Inteligência por descanso curto ou longo.',
    ],
    7: [
      'Disparo curvo: após errar, ação bônus tenta atingir outro alvo.',
      'Munição mágica: cria munição de escuridão, abertura ou cipó; aprende outra opção de Disparo Arcano.',
    ],
    10: [
      'Disparo sempre pronto: recupera um uso ao rolar iniciativa; dado passa a d8 e aprende outra opção.',
    ],
    15: [
      'Teletransporte indomável: sucesso ao usar Indomável permite teletransportar 18 m; dado passa a d10 e aprende outra opção.',
    ],
    18: [
      'Disparos magistrais: reação a um ataque que erra permite se mover e disparar contra o agressor; dado passa a d12 e aprende outra opção.',
    ],
  },
  'Monge/mystic-arts': {
    3: [
      'Conjuração: dois truques e três magias da lista de feiticeiro, usando Sabedoria; segue a tabela própria de espaços.',
    ],
    6: [
      'Estilo de luta místico: substitui um ataque desarmado da ação Atacar por um truque de feiticeiro.',
      'Foco místico: converte espaços em Foco e, após descanso curto ou Metabolismo Extraordinário, Foco em um espaço recuperado.',
    ],
    11: [
      'Golpe focado: Golpe Atordoante impõe desvantagem às salvaguardas contra suas magias até seu próximo turno.',
    ],
    17: [
      'Estilo místico aprimorado: substitui dois ataques de Rajada de Golpes por uma magia de círculo 1 ou 2 da lista aprendida.',
    ],
  },
  'Paladino/noble-genies': {
    3: [
      'Esplendor do gênio: sem armadura, CA 10 + Destreza + Carisma, permitindo escudo; ganha uma perícia.',
      'Destruição elemental: Canalizar Divindade acrescenta ao golpe um efeito de Dao, Djinni, Efreeti ou Marid.',
    ],
    7: [
      'Aura de escudo elemental: a Aura de Proteção concede uma resistência elemental escolhida, alterável no início do turno.',
    ],
    15: [
      'Repreensão elemental: reação reduz dano de ataque à metade e causa dano elemental ao agressor mediante salvaguarda.',
    ],
    20: [
      'Herdeiro nobre: transformação com voo de 18 m e reação que transforma um teste de d20 falho na aura em sucesso.',
    ],
  },
  'Patrulheiro/winter-walker': {
    3: [
      'Explorador frígido: resistência a frio, ignora resistência a esse dano e acrescenta 1d4 de frio uma vez por alvo/turno.',
      'Geada do caçador: Marca do Caçador concede PV temporários e impede o alvo marcado de Desengajar.',
    ],
    7: [
      'Alma fortificante: cura um grupo em 1d10 + nível de patrulheiro e concede vantagem contra Amedrontado por uma hora.',
    ],
    11: [
      'Retribuição gelada: reação a um ataque recebido pode Atordoar o agressor mediante salvaguarda; dano polar passa a 1d6.',
    ],
    15: [
      'Assombração congelada: Marca do Caçador permite forma espectral com imunidade a frio, dano em emanação e movimento através de obstáculos.',
    ],
  },
  'Patrulheiro/hollow-warden': {
    3: [
      'Ira selvagem: gasta Inimigo Favorito para uma transformação com bônus de CA, retaliação e emanação de medo.',
    ],
    7: [
      'Força faminta: soma Sabedoria às salvaguardas de Constituição e pode recuperar PV ao acertar enquanto transformado e muito ferido.',
    ],
    11: [
      'Podridão e violência: a emanação impede cura/reações dos alvos que falham; ataques podem acrescentar Debilitar ou Lentidão; melhora a CA da transformação.',
    ],
    15: [
      'Poder ancestral: dano adicional contra Amedrontados, imunidade a Exaustão e uma recuperação ao cair a zero PV durante a transformação.',
    ],
  },
  'Ladino/scion-of-three': {
    3: [
      'Sede de sangue: reação teletransporta para junto de um inimigo ferido e permite um ataque; usos ligados à Inteligência.',
      'Lealdade terrível: escolhe Bane, Bhaal ou Myrkul para resistência e um truque usando Inteligência; pode trocar após descanso longo.',
    ],
    9: ['Causar medo: nova opção de Golpe Ardiloso amedronta o alvo mediante salvaguarda.'],
    13: [
      'Aura de malevolência: Sede de Sangue também causa dano na origem ou no destino do teletransporte, ignorando resistência.',
    ],
    17: [
      'Terror encarnado: recupera um uso de Sede de Sangue em descanso curto e trata 1/2 nos dados de Ataque Furtivo como 3.',
    ],
  },
  'Ladino/phantom': {
    3: [
      'Lamentos do túmulo: após Ataque Furtivo, pode causar dano necrótico a uma segunda criatura; usos ligados à Destreza.',
      'Sussurros dos mortos: uma perícia ou ferramenta temporária, trocável após descanso curto ou longo.',
    ],
    9: [
      'Símbolos dos finados: recebe e coleta amuletos de alma para efeitos próprios; a capacidade cresce com o nível.',
      'Voz da morte: Falar com os Mortos sem espaço e componentes, usando Destreza, inclusive através de um amuleto de alma.',
    ],
    13: [
      'Caminhada fantasma: forma espectral concede voo lento, desvantagem a ataques recebidos e movimento através de objetos; capacidade de amuletos passa a três.',
    ],
    17: [
      'Amigo da morte: Lamentos pode causar seu dano aos dois alvos e iniciativa recupera um amuleto quando vazio; capacidade passa a quatro.',
    ],
  },
  'Feiticeiro/spellfire': {
    3: [
      'Explosão de fogo mágico: gastar pontos de feitiçaria em ação Mágica/bônus permite PV temporários ou dano de fogo/radiante uma vez por turno.',
    ],
    6: [
      'Absorver magias: Contramágica sempre preparada e a falha do alvo contra ela recupera 1d4 pontos de feitiçaria.',
    ],
    14: [
      'Fogo mágico refinado: acrescenta nível aos PV temporários e aumenta o dano da explosão para 1d8.',
    ],
    18: [
      'Coroa de fogo mágico: altera Feitiçaria Inata para obter voo, evasão mágica e redução de dano mediante Dados de Vida.',
    ],
  },
  'Feiticeiro/shadow': {
    3: [
      'Poder sombrio: visão no escuro de 36 m, percepção às cegas de 3 m e visão através da escuridão de suas magias; pode resistir a uma queda a zero PV.',
    ],
    6: [
      'Feras de mau agouro: gasta três pontos para Convocar Fera como ação bônus; pode dispensar concentração com duração reduzida.',
    ],
    14: [
      'Caminhar pelas sombras: ação bônus teletransporta até 36 m entre penumbra/escuridão.',
    ],
    18: [
      'Forma umbral: Feitiçaria Inata concede movimento incorpóreo e resistência a todo dano exceto energético e radiante.',
    ],
  },
  'Bruxo/undead': {
    3: [
      'Forma do pavor: transformação por ação bônus concede PV temporários, imunidade a Amedrontado e ataques que podem causar medo; usos ligados a Carisma.',
    ],
    6: [
      'Toque do túmulo: ignora resistência necrótica, pode converter dano e aprimora dano necrótico na Forma do Pavor; dispensa sono e certas necessidades vitais.',
    ],
    10: [
      'Carapaça necrótica: resistência necrótica, convertida em imunidade na Forma do Pavor; ao cair a zero PV, pode provocar explosão necrótica e se erguer com PV e um nível de Exaustão.',
    ],
    14: [
      'Pavor superior: a forma concede resistência a dano contundente/cortante/perfurante, voo, movimento incorpóreo e dispensa componentes permitidos de conjuração e necromancia.',
    ],
  },
  'Bruxo/vestige': {
    3: [
      'Companheiro vestígio: recebe um Celestial, Ínfero ou Morto-vivo que age no seu turno, comandado por ação bônus ou substituição de ataque.',
      'Magias do vestígio: escolhe Vida, Luz, Trapaça ou Guerra; as magias do domínio tornam-se magias de bruxo sempre preparadas.',
    ],
    6: [
      'Poder do vestígio: o companheiro recupera Poder Divino com descanso curto/longo ou Astúcia Mágica; proximidade concede suas resistências.',
    ],
    10: [
      'Recuperação do vestígio: reação e espaço de Pacto podem restaurar completamente o companheiro prestes a desaparecer e teletransportá-lo.',
    ],
    14: [
      'Semelhança de vida: transforma o companheiro em um espírito celestial, ínfero ou morto-vivo de poder ligado ao nível de bruxo.',
    ],
  },
  'Mago/bladesinger': {
    3: [
      'Treino de guerra e canto: armas marciais corpo a corpo sem Pesada/Duas Mãos e uma perícia.',
      'Canto da lâmina: ação bônus ativa bônus de Inteligência na CA, +3 m de deslocamento, melhor concentração e ataques de arma com Inteligência, respeitando as restrições da forma.',
    ],
    6: [
      'Ataque extra: dois ataques na ação Atacar; pode substituir um por um truque de mago com conjuração de ação.',
    ],
    10: [
      'Canto de defesa: durante o canto, reação e espaço reduzem dano em cinco vezes o círculo gasto.',
    ],
    14: [
      'Canto de vitória: após conjurar uma magia com conjuração de ação, pode realizar um ataque de arma como ação bônus.',
    ],
  },
  'Mago/conjurer': {
    3: [
      'Erudito em conjuração: duas magias adicionais da escola até círculo 2; uma nova ao liberar cada círculo superior.',
      'Transposição benigna: ação bônus teletransporta 9 m ou troca de lugar com uma criatura voluntária de tamanho permitido.',
    ],
    6: [
      'Transposição distante: alcance passa a 18 m e pode recuperar um uso com espaço.',
      'Invocações duráveis: criaturas invocadas por conjuração recebem PV temporários e resistências enquanto os conservam.',
    ],
    10: [
      'Conjuração focada: sofrer dano não quebra concentração em suas magias de conjuração.',
    ],
    14: [
      'Invocações divididas: pode criar dois espíritos em vez de um, cada qual com metade dos PV e a mesma concentração.',
    ],
  },
  'Mago/enchanter': {
    3: [
      'Erudito em encantamento: duas magias adicionais da escola até círculo 2; uma nova ao liberar cada círculo superior.',
      'Conversador encantador: uma perícia social com bônus de Inteligência.',
      'Presença hipnótica: ação Mágica tenta Enfeitiçar e Incapacitar uma criatura próxima.',
    ],
    6: [
      'Encantamento dividido: pode aumentar em um o círculo efetivo de encantamentos que atingem mais alvos com espaços superiores.',
    ],
    10: [
      'Encanto instintivo: reação pode fazer um ataque recebido errar e atingir outra criatura mediante salvaguarda.',
    ],
    14: [
      'Alterar memórias: pode ocultar sua influência e remover memórias do período de um encantamento.',
    ],
  },
  'Mago/necromancer': {
    3: [
      'Erudito em necromancia: duas magias adicionais da escola até círculo 2; uma nova ao liberar cada círculo superior.',
      'Grimório necrótico: resistência necrótica, Encontrar Familiar com formas mortas-vivas e cura de mortos-vivos ao conjurar necromancia.',
    ],
    6: [
      'Poder do túmulo: Recuperação Arcana reduz Exaustão e seu dano necrótico ignora resistência.',
      'Servos mortos-vivos: Animar Mortos sempre preparada, uma conjuração gratuita e benefícios de PV/dano aos servos.',
    ],
    10: [
      'Colheita dos mortos-vivos: reação pode sacrificar um servo para recuperar PV ao ficar muito ferido.',
    ],
    14: [
      'Mestre da morte: concede PV temporários aos servos e provoca explosões necróticas quando um morto-vivo cai a zero PV.',
    ],
  },
  'Mago/transmuter': {
    3: [
      'Erudito em transmutação: duas magias adicionais da escola até círculo 2; uma nova ao liberar cada círculo superior.',
      'Pedra do transmutador: portador ganha proficiência em salvaguardas de Constituição e um benefício escolhido.',
      'Alteração maravilhosa: Alterar-se sempre preparada, uma conjuração gratuita e opções aprimoradas.',
    ],
    6: [
      'Transmutação empoderada: pode aumentar em um o círculo efetivo de transmutação sem ataque ou salvaguarda.',
    ],
    10: [
      'Pedra potente: concede dois benefícios e novas opções.',
      'Metamorfo: Polimorfia sempre preparada e conjuração especial conserva faculdades mentais e certas magias.',
    ],
    14: [
      'Mestre transmutador: consome o poder da pedra para transformar um objeto, restaurar uma criatura, ressuscitar ou rejuvenescer.',
    ],
  },
  'Bárbaro/wild-heart': {
    3: [
      'Voz dos animais: rituais de Falar com Animais e Sentido Bestial.',
      'Fúria selvagem: ao entrar em Fúria, escolhe Urso, Águia ou Lobo para proteção, mobilidade ou apoio aos aliados.',
    ],
    6: [
      'Aspecto selvagem: escolhe Coruja, Pantera ou Salmão para sentidos e deslocamento; pode trocar após descanso longo.',
    ],
    10: ['Voz da natureza: pode conjurar Comunhão com a Natureza como ritual.'],
    14: [
      'Poder selvagem: escolhe Falcão, Leão ou Carneiro ao entrar em Fúria, acrescentando voo, proteção dos aliados ou derrubada.',
    ],
  },
  'Bárbaro/world-tree': {
    3: [
      'Vitalidade da árvore: entrar em Fúria concede PV temporários; durante ela, pode conceder PV temporários a outra criatura no início do turno.',
    ],
    6: [
      'Ramos da árvore: durante a Fúria, usa reação para tentar teletransportar uma criatura próxima para junto de si e reduzir seu deslocamento.',
    ],
    10: [
      'Raízes contundentes: aumenta o alcance de armas corpo a corpo pesadas ou versáteis e pode acrescentar Empurrar ou Derrubar.',
    ],
    14: [
      'Viagem pela árvore: teletransporte durante a Fúria; uma vez por Fúria pode ampliar o alcance e transportar aliados.',
    ],
  },
  'Bárbaro/zealot': {
    3: [
      'Fúria divina: o primeiro acerto de arma ou desarmado durante o turno em Fúria recebe dano necrótico ou radiante adicional.',
      'Guerreiro dos deuses: reserva de dados de cura recuperada em descanso longo.',
    ],
    6: [
      'Foco fanático: durante a Fúria, permite repetir uma salvaguarda falha com o bônus indicado pela característica.',
    ],
    10: [
      'Presença zelosa: ação bônus para conceder vantagem em ataques e salvaguardas a aliados próximos por um período curto.',
    ],
    14: [
      'Fúria dos deuses: assume uma forma divina durante a Fúria, com voo, resistências e proteção contra a morte de aliados.',
    ],
  },
  'Bardo/dance': {
    3: [
      'Virtuosismo da dança: vantagem em Atuação ao dançar.',
      'Defesa sem armadura: CA 10 + Destreza + Carisma, sem armadura ou escudo.',
      'Golpes ágeis e dano bárdico: usa Destreza nos ataques desarmados e o dado de Inspiração como dado de dano; gastar Inspiração pode permitir um golpe desarmado.',
    ],
    6: [
      'Movimento inspirador: usa reação e Inspiração para mover a si e um aliado sem ataques de oportunidade.',
      'Passos em conjunto: pode acrescentar um dado de Inspiração à iniciativa do grupo próximo.',
    ],
    14: [
      'Evasão condutora: aprimora salvaguardas de Destreza contra dano em área para si e aliados próximos, enquanto estiver apto a agir.',
    ],
  },
  'Bardo/glamour': {
    3: [
      'Magia sedutora: magias de encantamento ou ilusão podem causar Enfeitiçado ou Amedrontado; ganha magias sempre preparadas.',
      'Manto de inspiração: Inspiração concede PV temporários e movimento por reação aos aliados escolhidos.',
    ],
    6: [
      'Manto de majestade: assume aparência sobrenatural e pode usar Comando como ação bônus durante o efeito.',
    ],
    14: [
      'Majestade inabalável: ação bônus ativa uma defesa que exige salvaguarda de Carisma de quem tentar atacá-lo.',
    ],
  },
  'Bardo/valor': {
    3: [
      'Inspiração de combate: a criatura inspirada também pode usar o dado no dano ou na CA contra um ataque.',
      'Treinamento marcial: armas marciais, armaduras médias e escudos; arma pode servir como foco.',
    ],
    6: [
      'Ataque extra: dois ataques na ação Atacar; pode substituir um deles por um truque com tempo de conjuração de ação.',
    ],
    14: [
      'Magia de batalha: após conjurar uma magia com tempo de conjuração de ação, pode realizar um ataque de arma como ação bônus.',
    ],
  },
  'Clérigo/light': {
    3: [
      'Radiação da aurora: Canalizar Divindade dissipa escuridão mágica e causa dano radiante em área.',
      'Clarão protetor: reação para impor desvantagem a um ataque; usos recuperados por descanso.',
    ],
    6: [
      'Clarão protetor aprimorado: recupera os usos em descanso curto ou longo e pode conceder PV temporários ao protegido.',
    ],
    17: [
      'Coroa de luz: emana luz e impõe desvantagem em salvaguardas contra seus efeitos de fogo ou radiante enquanto durar.',
    ],
  },
  'Clérigo/trickery': {
    3: [
      'Bênção do trapaceiro: concede vantagem em Furtividade a si ou outra criatura.',
      'Invocar duplicidade: Canalizar Divindade cria uma duplicata ilusória para conjuração e vantagem em combate próximo.',
    ],
    6: ['Transposição do trapaceiro: pode trocar de lugar com a duplicata ao movê-la.'],
    17: [
      'Duplicidade aprimorada: a duplicata ajuda os aliados a atacar e pode restaurar PV ao desaparecer.',
    ],
  },
  'Clérigo/war': {
    3: [
      'Golpe guiado: Canalizar Divindade acrescenta +10 a um ataque após a rolagem.',
      'Sacerdote da guerra: ataques adicionais como ação bônus, com usos ligados à Sabedoria.',
    ],
    6: [
      'Bênção do deus da guerra: Canalizar Divindade permite usar Escudo da Fé ou Arma Espiritual sem espaço e sem concentração.',
    ],
    17: ['Avatar de batalha: resistência a dano contundente, cortante e perfurante.'],
  },
  'Druida/moon': {
    3: [
      'Formas do círculo: amplia as formas de fera, melhora a CA mínima e os PV temporários da Forma Selvagem.',
      'Magias lunares: uma lista própria permanece preparada e pode ser conjurada na Forma Selvagem.',
    ],
    6: [
      'Formas aprimoradas: ataques da forma podem causar dano radiante; melhora salvaguardas de Constituição na forma.',
    ],
    10: [
      'Passo ao luar: teletransporte como ação bônus, com vantagem no próximo ataque antes do fim do turno; usos ligados à Sabedoria.',
    ],
    14: [
      'Forma lunar: amplia o dano radiante da forma e permite transportar um aliado com Passo ao Luar.',
    ],
  },
  'Druida/sea': {
    3: [
      'Ira do mar: gasta Forma Selvagem para criar uma emanação que pode causar dano de frio e empurrar criaturas.',
    ],
    6: ['Afinidade aquática: ganha natação e amplia a emanação de Ira do Mar.'],
    10: [
      'Nascido da tempestade: Ira do Mar concede voo e resistência a dano elétrico e trovejante.',
    ],
    14: [
      'Dádiva oceânica: pode conceder Ira do Mar a um aliado ou compartilhar a manifestação ao gastar mais um uso de Forma Selvagem.',
    ],
  },
  'Druida/stars': {
    3: [
      'Mapa estelar: aprende Orientação, prepara Raio Guiador e pode conjurá-lo sem espaço um número de vezes por descanso longo.',
      'Forma estelar: gasta Forma Selvagem para manifestar Arqueiro, Cálice ou Dragão, com ataque radiante, cura adicional ou proteção da concentração.',
    ],
    6: [
      'Presságio cósmico: após descanso longo, recebe presságios que permitem somar ou subtrair 1d6 de testes por reação.',
    ],
    10: [
      'Constelações cintilantes: aprimora os dados de Arqueiro e Cálice, concede voo em Dragão e permite trocar a constelação no turno.',
    ],
    14: [
      'Corpo de estrelas: resistência a dano contundente, cortante e perfurante durante a Forma Estelar.',
    ],
  },
  'Guerreiro/battle-master': {
    3: [
      'Superioridade em combate: quatro dados d8, recuperados em descanso curto ou longo; aprende três manobras.',
      'Estudante da guerra: uma perícia da lista do guerreiro e uma ferramenta de artesão.',
    ],
    7: [
      'Conheça seu inimigo: ação bônus para conhecer imunidades, resistências e vulnerabilidades de uma criatura; aprende duas manobras.',
    ],
    10: [
      'Superioridade aprimorada: dados de superioridade passam a d10; aprende duas manobras.',
    ],
    15: [
      'Implacável: pode usar certas manobras com d8 sem gastar seus dados de superioridade; aprende duas manobras.',
    ],
    18: ['Superioridade suprema: dados de superioridade passam a d12.'],
  },
  'Guerreiro/eldritch-knight': {
    3: [
      'Conjuração: aprende dois truques e prepara três magias de mago, usando Inteligência e a tabela de espaços própria.',
      'Vínculo de guerra: ritual vincula até duas armas; pode chamar uma delas como ação bônus e evita ser desarmado enquanto apto a agir.',
    ],
    7: [
      'Magia de guerra: na ação Atacar, pode substituir um ataque por um truque de mago com conjuração de ação.',
    ],
    10: [
      'Golpe místico: acertar uma criatura com arma prejudica a próxima salvaguarda dela contra uma magia sua até seu próximo turno.',
    ],
    15: [
      'Carga arcana: Surto de Ação permite teletransportar até 9 m antes ou depois da ação adicional.',
    ],
    18: [
      'Magia de guerra aprimorada: pode substituir dois ataques por uma magia de mago de círculo 1 ou 2 com conjuração de ação.',
    ],
  },
  'Guerreiro/psi-warrior': {
    3: [
      'Poder psiônico: reserva de dados de energia recuperada em descanso; tamanho e quantidade seguem a tabela.',
      'Campo protetor, golpe psiônico e movimento telecinético: gasta energia para reduzir dano, acrescentar dano energético ou mover uma criatura/objeto.',
    ],
    7: [
      'Adepto telecinético: salto com voo temporário e impulso que empurra ou derruba após Golpe Psiônico.',
    ],
    10: [
      'Mente protegida: resistência a dano psíquico e pode encerrar Enfeitiçado ou Amedrontado em si.',
    ],
    15: [
      'Baluarte de força: protege um grupo com meia cobertura usando ação bônus e energia psiônica.',
    ],
    18: [
      'Mestre telecinético: ganha Telecinesia e pode atacar como ação bônus enquanto mantém a magia.',
    ],
  },
  'Ladino/arcane-trickster': {
    3: [
      'Conjuração: Mãos Mágicas, mais dois truques e três magias de mago, usando Inteligência e espaços próprios.',
      'Prestidigitação de mãos mágicas: aprimora Mãos Mágicas para tarefas furtivas com as ferramentas do ladino.',
    ],
    9: [
      'Emboscada mágica: ao conjurar oculto, prejudica salvaguardas das criaturas que não o veem contra a magia.',
    ],
    13: [
      'Trapaceiro versátil: usa Mãos Mágicas para ampliar os alvos de uma opção de Golpe Ardiloso.',
    ],
    17: [
      'Ladrão de magias: reação para tentar neutralizar e tomar temporariamente uma magia dirigida contra você.',
    ],
  },
  'Ladino/assassin': {
    3: [
      'Ferramentas do assassino: proficiência em kit de disfarce e kit de venenos.',
      'Assassinar: vantagem em iniciativa e contra inimigos que ainda não agiram na primeira rodada; o Ataque Furtivo nessa rodada causa dano adicional.',
    ],
    9: [
      'Especialista em infiltração: aprimora disfarce e imitação e permite movimento furtivo mais rápido.',
    ],
    13: [
      'Envenenar armas: a opção de veneno de Golpe Ardiloso acrescenta dano e ignora resistência a dano venenoso.',
    ],
    17: [
      'Golpe mortal: dobra o dano do primeiro turno contra um alvo que falhar na salvaguarda exigida.',
    ],
  },
  'Ladino/soulknife': {
    3: [
      'Poder psiônico: dados de energia para aprimorar testes proficientes e criar comunicação telepática.',
      'Lâminas psíquicas: manifesta armas de dano psíquico com Acuidade, Arremesso e Afligir; pode realizar uma segunda lâmina como ação bônus.',
    ],
    9: [
      'Lâminas da alma: gasta energia para tentar converter um erro em acerto ou para teletransportar uma lâmina lançada.',
    ],
    13: [
      'Véu psíquico: pode ficar Invisível; termina ao causar dano ou forçar salvaguarda, com recuperação ou custo em energia.',
    ],
    17: [
      'Romper a mente: um Ataque Furtivo de lâmina psíquica pode Atordoar o alvo mediante salvaguarda.',
    ],
  },
  'Monge/mercy': {
    3: [
      'Instrumentos da misericórdia: ganha Intuição, Medicina e kit de herbalismo.',
      'Mãos de cura e de dano: gasta Foco para curar por toque ou acrescentar dano necrótico a um ataque desarmado.',
    ],
    6: [
      'Toque do médico: a cura pode remover condições e a mão de dano pode causar Envenenado.',
    ],
    11: [
      'Rajada de cura e dano: aprimora os usos das mãos em Rajada de Golpes; usos gratuitos têm limite por descanso longo.',
    ],
    17: [
      'Mão da misericórdia suprema: gasta Foco para devolver à vida uma criatura morta recentemente, curando e removendo condições indicadas.',
    ],
  },
  'Monge/shadow': {
    3: [
      'Artes sombrias: aprende Ilusão Menor, amplia visão no escuro e pode gastar Foco para conjurar Escuridão, enxergando através dela.',
    ],
    6: [
      'Passo das sombras: teletransporte como ação bônus entre áreas de penumbra/escuridão e vantagem no próximo ataque corpo a corpo.',
    ],
    11: [
      'Passo aprimorado: pode gastar Foco para dispensar a restrição de iluminação e realizar um ataque desarmado após o teletransporte.',
    ],
    17: [
      'Manto das sombras: gasta Foco para assumir um estado invisível na penumbra/escuridão, atravessar espaços ocupados e aprimorar a Rajada de Golpes.',
    ],
  },
  'Monge/elements': {
    3: [
      'Manipular elementos: aprende Elementalismo usando Sabedoria.',
      'Sintonia elemental: gasta Foco para ampliar alcance dos ataques desarmados, escolher dano elemental e mover o alvo mediante salvaguarda.',
    ],
    6: [
      'Explosão elemental: gasta Foco para causar dano elemental em uma esfera distante; salvaguarda reduz à metade.',
    ],
    11: ['Passos elementais: Sintonia Elemental concede deslocamentos de voo e natação.'],
    17: [
      'Ápice elemental: a sintonia concede resistência escolhida, deslocamento danoso e dano adicional nos ataques.',
    ],
  },
  'Paladino/glory': {
    3: [
      'Atleta incomparável: Canalizar Divindade aprimora Atletismo, Acrobacia, carga e salto.',
      'Destruição inspiradora: após Destruição Divina, pode distribuir PV temporários entre aliados.',
    ],
    7: ['Aura de presteza: aumenta o deslocamento próprio e de aliados na Aura de Proteção.'],
    15: [
      'Defesa gloriosa: reação concede bônus de CA a uma criatura atacada e pode permitir contra-ataque quando o ataque erra.',
    ],
    20: [
      'Lenda viva: transformação temporária que aprimora testes de Carisma, ataques e salvaguardas.',
    ],
  },
  'Paladino/ancients': {
    3: [
      'Ira da natureza: Canalizar Divindade tenta Restringir os inimigos próximos com raízes espectrais.',
    ],
    7: [
      'Aura de proteção ancestral: concede resistência a dano necrótico, psíquico e radiante na Aura de Proteção.',
    ],
    15: [
      'Sentinela imortal: evita cair a zero PV e restaura PV uma vez por descanso longo; protege do envelhecimento mágico.',
    ],
    20: [
      'Campeão ancestral: transformação que regenera PV, acelera certas conjurações e prejudica salvaguardas dos inimigos próximos.',
    ],
  },
  'Paladino/vengeance': {
    3: [
      'Voto de inimizade: Canalizar Divindade concede vantagem nos ataques contra um inimigo escolhido; pode transferir o voto após a queda dele.',
    ],
    7: [
      'Vingador implacável: ao acertar um ataque de oportunidade, pode se mover e reduzir o deslocamento do alvo.',
    ],
    15: [
      'Alma da vingança: reação para atacar o alvo do Voto de Inimizade quando ele realiza um ataque.',
    ],
    20: ['Anjo vingador: transformação concede voo e uma aura aterrorizante.'],
  },
  'Patrulheiro/beast-master': {
    3: [
      'Companheiro primal: convoca Fera da Terra, do Mar ou do Céu; estatísticas e PV acompanham o nível de patrulheiro e a Sabedoria.',
      'Comandar a fera: usa ação bônus ou substitui um ataque; pode restaurar o companheiro com os custos da característica.',
    ],
    7: [
      'Treinamento excepcional: aprimora comandos por ação bônus e permite dano energético nos ataques da fera.',
    ],
    11: [
      'Fúria bestial: a fera realiza dois ataques e pode se beneficiar de Marca do Caçador.',
    ],
    15: [
      'Compartilhar magias: ao conjurar uma magia em si, pode também afetar o companheiro próximo.',
    ],
  },
  'Patrulheiro/fey-wanderer': {
    3: [
      'Golpes terríveis: dano psíquico adicional uma vez por turno por criatura atingida.',
      'Glamour sobrenatural: soma Sabedoria aos testes de Carisma e ganha uma perícia social.',
    ],
    7: [
      'Reviravolta sedutora: vantagem contra Enfeitiçado/Amedrontado; reação pode redirecionar uma tentativa resistida para outro alvo.',
    ],
    11: [
      'Reforços feéricos: ganha Convocar Feérico e opções para conjurá-la sem espaço ou sem concentração com duração menor.',
    ],
    15: [
      'Andarilho nebuloso: Passo Nebuloso sem espaço com usos ligados à Sabedoria e transporte de outra criatura próxima.',
    ],
  },
  'Patrulheiro/gloom-stalker': {
    3: [
      'Emboscador terrível: bônus de Sabedoria na iniciativa, deslocamento no primeiro turno e dano psíquico adicional limitado por descanso.',
      'Visão umbral: amplia visão no escuro e oculta você de quem depende dela para enxergá-lo na escuridão.',
    ],
    7: [
      'Mente de ferro: ganha proficiência em salvaguardas de Sabedoria, ou Inteligência/Carisma se já a possuir.',
    ],
    11: [
      'Rajada do predador: aprimora a emboscada com dano e efeitos que podem atingir outra criatura ou Amedrontar.',
    ],
    15: ['Esquiva sombria: reação para prejudicar um ataque e se deslocar por teletransporte.'],
  },
  'Feiticeiro/aberrant': {
    3: [
      'Magias psiônicas: lista própria sempre preparada.',
      'Fala telepática: cria comunicação mental com uma criatura escolhida.',
    ],
    6: [
      'Feitiçaria psiônica: permite gastar pontos de feitiçaria no lugar dos espaços das magias psiônicas, dispensando componentes permitidos.',
      'Defesas psíquicas: resistência psíquica e vantagem contra Enfeitiçado/Amedrontado.',
    ],
    14: [
      'Revelação na carne: gasta pontos para obter visão de invisibilidade, voo, natação ou corpo maleável temporariamente.',
    ],
    18: [
      'Implosão distorcida: teletransporta e atrai criaturas à área abandonada, causando dano mediante salvaguarda.',
    ],
  },
  'Feiticeiro/clockwork': {
    3: [
      'Magias mecânicas: lista própria sempre preparada.',
      'Restaurar equilíbrio: reação anula vantagem ou desvantagem de uma rolagem, com usos por descanso.',
    ],
    6: [
      'Bastião da lei: gasta pontos para criar uma reserva de dados que reduz o dano sofrido pelo protegido.',
    ],
    14: [
      'Transe da ordem: por um período, ataques contra você não recebem vantagem e seus testes de d20 têm um resultado mínimo.',
    ],
    18: [
      'Cavalgada mecânica: manifesta espíritos que restauram PV, reparam objetos e encerram magias na área.',
    ],
  },
  'Feiticeiro/wild-magic': {
    3: [
      'Surto de magia selvagem: conjurar com espaços pode provocar um resultado da tabela de magia selvagem.',
      'Marés do caos: concede vantagem em um teste de d20 e interage com a recuperação por surto.',
    ],
    6: [
      'Dobrar a sorte: reação e pontos de feitiçaria para somar ou subtrair 1d4 de um teste de outra criatura.',
    ],
    14: ['Caos controlado: rola duas vezes na tabela de magia selvagem e escolhe o resultado.'],
    18: [
      'Surto domado: pode escolher certos resultados da tabela de magia selvagem, com recuperação em descanso longo.',
    ],
  },
  'Bruxo/archfey': {
    3: [
      'Passos feéricos: ganha usos gratuitos de Passo Nebuloso e acrescenta um efeito de apoio ou provocação ao teletransporte.',
    ],
    6: [
      'Fuga nebulosa: pode usar Passo Nebuloso por reação ao sofrer dano e acrescenta efeitos de invisibilidade ou dano.',
    ],
    10: [
      'Defesas sedutoras: imunidade a Enfeitiçado e reação para reduzir dano com uma punição psíquica ao agressor.',
    ],
    14: [
      'Magia enfeitiçante: conjurar certas magias de encantamento ou ilusão permite usar Passo Nebuloso como parte da mesma ação.',
    ],
  },
  'Bruxo/celestial': {
    3: [
      'Luz curativa: reserva de d6 para curar criaturas próximas como ação bônus; recupera em descanso longo.',
      'Magias celestiais: inclui Luz e Chama Sagrada além das magias sempre preparadas.',
    ],
    6: [
      'Alma radiante: resistência radiante e bônus de Carisma a uma rolagem de dano de fogo ou radiante da magia.',
    ],
    10: ['Resiliência celestial: descanso concede PV temporários a si e aliados escolhidos.'],
    14: [
      'Vingança abrasadora: ao precisar realizar salvaguarda contra morte, pode se erguer com PV, causar dano radiante e Cegar inimigos próximos.',
    ],
  },
  'Bruxo/great-old-one': {
    3: [
      'Mente desperta: comunicação telepática com uma criatura.',
      'Magias psíquicas: pode converter dano de magias de bruxo em psíquico e dispensar componentes verbais/somáticos de certas magias.',
    ],
    6: [
      'Combatente clarividente: ao estabelecer a conexão, pode obter vantagem contra o alvo e impor desvantagem aos ataques dele contra você.',
    ],
    10: [
      'Escudo mental: resistência psíquica, proteção dos pensamentos e retorno de dano psíquico.',
      'Maldição mística: Hex pode prejudicar salvaguardas do atributo escolhido.',
    ],
    14: [
      'Criar servo: aprimora Convocar Aberração, com conjuração especial e benefícios contra o alvo de Hex.',
    ],
  },
  'Mago/abjurer': {
    3: [
      'Erudito em abjuração: duas magias adicionais da escola até círculo 2; uma nova ao liberar cada círculo superior.',
      'Proteção arcana: conjurações de abjuração alimentam uma reserva protetora de PV.',
    ],
    6: [
      'Proteção projetada: reação para usar a Proteção Arcana em favor de outra criatura próxima.',
    ],
    10: [
      'Quebrar magias: Dissipar Magia e Contramágica sempre preparadas e aprimoradas; recupera poder protetor com Dissipar Magia.',
    ],
    14: [
      'Resistência a magias: vantagem em salvaguardas contra magias e resistência ao dano delas.',
    ],
  },
  'Mago/diviner': {
    3: [
      'Erudito em adivinhação: duas magias adicionais da escola até círculo 2; uma nova ao liberar cada círculo superior.',
      'Presságio: após descanso longo, guarda dois resultados de d20 para substituir rolagens permitidas.',
    ],
    6: [
      'Adivinhação especializada: conjurar adivinhação com espaço de círculo 2 ou superior recupera um espaço de círculo inferior, até o limite da característica.',
    ],
    10: [
      'Terceiro olho: ação bônus concede visão no escuro, leitura de idiomas ou Ver Invisibilidade.',
    ],
    14: ['Presságio superior: guarda três resultados de d20 em vez de dois.'],
  },
  'Mago/illusionist': {
    3: [
      'Erudito em ilusão: duas magias adicionais da escola até círculo 2; uma nova ao liberar cada círculo superior.',
      'Ilusões aprimoradas: aprende Ilusão Menor, amplia seus efeitos e melhora alcance/componentes de magias de ilusão.',
    ],
    6: [
      'Criaturas fantasmagóricas: aprende Convocar Fera e Convocar Feérico e pode conjurá-las com as alterações e os usos especiais da característica.',
    ],
    10: [
      'Eu ilusório: reação cria uma duplicata para fazer um ataque errar; pode recuperar o uso com espaço de magia.',
    ],
    14: [
      'Realidade ilusória: torna temporariamente real um objeto de uma ilusão, respeitando as limitações de dano e duração.',
    ],
  },
};

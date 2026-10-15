// Original PT-BR mechanical summaries. Activated and situational effects are resolved at the table.
export const extendedFeatureNames: Record<string, string> = {
  "Tinker's Magic": 'Magia de funileiro',
  'Replicate Magic Item': 'Replicar item mágico',
  'Magic Item Tinker': 'Ajustar item mágico',
  'Flash of Genius': 'Lampejo de genialidade',
  'Magic Item Adept': 'Adepto de itens mágicos',
  'Spell-Storing Item': 'Item armazenador de magia',
  'Advanced Artifice': 'Artifício avançado',
  'Magic Item Master': 'Mestre de itens mágicos',
  'Soul of Artifice': 'Alma do artifício',
};
export const extendedFeatureSummaries: Record<string, string> = {
  Rage: 'Ação bônus para entrar em Fúria; resistência a dano contundente, cortante e perfurante, vantagem em testes e salvaguardas de Força e bônus no dano com Força. Não pode conjurar nem manter concentração. Usos e bônus seguem a tabela da classe.',
  'Unarmored Defense':
    'Sem armadura, use 10 + Destreza + Constituição para bárbaro, ou 10 + Destreza + Sabedoria para monge. O monge não pode usar escudo; fórmulas de CA não se somam.',
  'Weapon Mastery':
    'Escolha as armas com propriedades de maestria. Pode mudar as escolhas após descanso longo; o efeito depende da arma usada.',
  'Primal Knowledge':
    'Uma perícia adicional da lista de bárbaro; em Fúria, pode usar Força nos testes de Acrobacia, Furtividade, Intimidação, Percepção e Sobrevivência.',
  'Fast Movement': 'Deslocamento +3 m enquanto não usa armadura pesada.',
  'Feral Instinct': 'Vantagem na iniciativa.',
  'Instinctive Pounce':
    'Ao entrar em Fúria com ação bônus, pode mover-se até metade do deslocamento.',
  'Brutal Strike':
    'Ao abrir mão da vantagem de Ataque Descuidado em um ataque com Força sem desvantagem, o acerto causa +1d10 e aplica Golpe Poderoso ou Golpe Incapacitante.',
  'Relentless Rage':
    'Se cair a 0 PV em Fúria sem morrer, faça salvaguarda de Constituição CD 10 para ficar com PV iguais a duas vezes o nível de bárbaro. A CD sobe 5 a cada uso e volta a 10 após descanso curto ou longo.',
  'Improved Brutal Strike':
    'No nível 13, Golpe Brutal ganha as opções Golpe Atordoante e Golpe Expositor; no 17, o dano passa a 2d10 e pode aplicar dois efeitos diferentes.',
  'Persistent Rage':
    'No início da iniciativa, pode recuperar os usos de Fúria uma vez por descanso longo. A Fúria dura 10 minutos sem precisar ser prolongada, terminando se ficar Inconsciente ou usar armadura pesada.',
  'Indomitable Might':
    'Resultados de testes e salvaguardas de Força inferiores ao seu valor de Força usam esse valor.',
  'Bardic Inspiration':
    'Ação bônus: uma criatura a até 18 m recebe um dado de inspiração por 1 hora, para acrescentar após falhar num teste de d20. Usos iguais ao modificador de Carisma, mínimo 1; dado cresce com o nível.',
  Spellcasting:
    'A lista, o atributo, a quantidade de truques, as magias preparadas e os espaços de cada círculo seguem a tabela desta classe. Magias adicionais da subclasse não consomem o limite de preparação.',
  Expertise:
    'Dobra o bônus de proficiência nas perícias escolhidas. Não se acumula com outra especialização na mesma perícia.',
  Countercharm:
    'Reação quando você ou uma criatura a até 9 m falha em salvaguarda contra Amedrontado ou Enfeitiçado: repete o teste com vantagem.',
  'Superior Inspiration':
    'Ao rolar iniciativa, recupera usos de Inspiração de Bardo se tiver menos de dois, ficando com dois.',
  'Words of Creation':
    'Palavra de Poder: Curar e Palavra de Poder: Matar sempre preparadas; ao conjurá-las, pode atingir uma segunda criatura a até 3 m da primeira.',
  'Divine Order':
    'Protetor concede armas marciais e armaduras pesadas. Taumaturgo concede um truque de clérigo e bônus de Sabedoria, mínimo +1, em Arcanismo e Religião.',
  'Channel Divinity':
    'Recurso divino com usos por nível e recuperação após descansos. Clérigos podem usar Centelha Divina e Expulsar Mortos-vivos; paladinos e subclasses possuem opções próprias. Uma ativação por turno.',
  'Sear Undead':
    'Ao Expulsar Mortos-vivos, criaturas que falham também recebem dano radiante em d8 iguais ao modificador de Sabedoria, mínimo um dado; esse dano não encerra a expulsão.',
  'Blessed Strikes':
    'Escolha Golpe Divino, +1d8 radiante ou necrótico uma vez em cada turno ao acertar com arma, ou Conjuração Potente, que soma Sabedoria ao dano de truques de clérigo.',
  'Divine Intervention':
    'Uma vez por descanso longo, usa ação Mágica para conjurar uma magia de clérigo de círculo 5 ou menor sem espaço ou componentes materiais, desde que não tenha tempo de conjuração de reação.',
  'Improved Blessed Strikes':
    'Golpe Divino passa a +2d8; Conjuração Potente pode conceder PV temporários iguais a duas vezes Sabedoria a você ou a criatura a até 18 m ao causar dano com um truque.',
  'Greater Divine Intervention':
    'Pode usar Intervenção Divina para conjurar Desejo; nesse caso a característica só fica disponível novamente após 2d4 descansos longos.',
  Druidic:
    'Conhece Druídico, pode deixar mensagens secretas nesse idioma e sempre tem Falar com Animais preparada, com uma conjuração sem espaço por descanso longo.',
  'Primal Order':
    'Guardião concede armas marciais e armaduras médias. Mago primal concede um truque de druida e bônus de Sabedoria, mínimo +1, em Arcanismo e Natureza.',
  'Wild Shape':
    'Ação bônus: assume uma forma de Fera conhecida por até metade do nível de druida em horas. O ND, as formas conhecidas e a permissão de voo seguem o nível; recebe PV temporários e mantém atributos mentais. As formas devem ser conferidas com o mestre.',
  'Wild Companion':
    'Conjura Encontrar Familiar como ação Mágica sem componentes materiais, gastando um espaço ou um uso de Forma Selvagem. O familiar é Feérico e desaparece após descanso longo.',
  'Wild Resurgence':
    'Sem usos de Forma Selvagem, pode trocar um espaço por um uso; pode também gastar um uso para recuperar um espaço de círculo 1 uma vez por descanso longo.',
  'Elemental Fury':
    'Escolha Golpe Primal, +1d8 frio, fogo, elétrico ou trovejante uma vez em cada turno ao acertar com arma ou ataque de Fera, ou Conjuração Potente, somando Sabedoria ao dano dos truques de druida.',
  'Improved Elemental Fury':
    'Golpe Primal passa a +2d8. Conjuração Potente também aumenta para 90 m o alcance dos truques de druida com alcance de pelo menos 3 m.',
  'Beast Spells':
    'Pode conjurar em Forma Selvagem, exceto magias com componente material de custo indicado ou consumido.',
  Archdruid:
    'Ao rolar iniciativa sem usos de Forma Selvagem, recupera um. Pode converter usos em espaços com soma de círculos até metade do nível de druida por descanso longo; envelhece dez vezes mais devagar.',
  'Fighting Style':
    'Recebe um talento de Estilo de Luta. O efeito depende do estilo e das armas usadas.',
  'Second Wind':
    'Ação bônus: recupera 1d10 + nível de guerreiro PV. Recupera um uso em descanso curto e todos em descanso longo; a reserva cresce com o nível.',
  'Tactical Mind':
    'Quando falha num teste de habilidade, pode gastar Retomar o Fôlego para somar 1d10; se ainda falhar, o uso não é gasto.',
  'Tactical Shift':
    'Ao usar Retomar o Fôlego com ação bônus, pode mover-se até metade do deslocamento sem provocar ataques de oportunidade.',
  Indomitable:
    'Repete uma salvaguarda falha com bônus igual ao nível de guerreiro; deve usar o novo resultado. Recupera usos em descanso longo; um uso no 9, dois no 13 e três no 17.',
  'Tactical Master':
    'Ao atacar com arma de maestria conhecida, pode substituir sua propriedade por Empurrar, Lentidão ou Abalar naquele ataque.',
  'Two Extra Attacks': 'Três ataques por ação Atacar; não soma Ataque Extra de outra classe.',
  'Studied Attacks':
    'Após errar um ataque contra uma criatura, tem vantagem no próximo ataque contra ela até o final do próximo turno.',
  'Three Extra Attacks':
    'Quatro ataques por ação Atacar; não soma Ataque Extra de outra classe.',
  'Martial Arts':
    'Sem armadura ou escudo, usa o dado de artes marciais, Destreza em ataques e dano elegíveis e pode realizar um ataque desarmado como ação bônus.',
  'Monk’s Focus':
    'Reserva de pontos de Foco igual ao nível de monge, recuperada em descanso curto ou longo. Gasta Foco em Rajada de Golpes, Defesa Paciente e Passo do Vento; CD 8 + proficiência + Sabedoria.',
  'Unarmored Movement':
    'Aumenta o deslocamento sem armadura ou escudo; o bônus segue a tabela de monge.',
  'Uncanny Metabolism':
    'Ao rolar iniciativa, pode recuperar todo o Foco e curar nível de monge + dado de artes marciais; uma vez por descanso longo.',
  'Deflect Attacks':
    'Reação para reduzir dano contundente, cortante ou perfurante de um ataque em 1d10 + Destreza + nível de monge; se reduzir a zero, pode gastar 1 Foco para redirecionar energia contra outro alvo.',
  'Slow Fall': 'Reação reduz dano de queda em cinco vezes o nível de monge.',
  'Stunning Strike':
    'Uma vez por turno ao acertar com arma de monge ou ataque desarmado, pode gastar 1 Foco. Se o alvo falha na salvaguarda de Constituição, fica Atordoado até o início do próximo turno; no sucesso, perde metade do deslocamento e o próximo ataque contra ele tem vantagem.',
  'Empowered Strikes':
    'Pode causar dano de força com ataques desarmados em vez do dano normal.',
  'Acrobatic Movement':
    'Durante seu turno, move-se sobre superfícies verticais e líquidos sem cair durante o movimento.',
  'Heightened Focus':
    'Rajada de Golpes com Foco passa a três ataques. Defesa Paciente concede PV temporários de dois dados de artes marciais; Passo do Vento permite levar uma criatura voluntária Média ou menor.',
  'Self-Restoration':
    'Ao final de cada turno, pode encerrar uma condição Amedrontado, Enfeitiçado ou Envenenado em si. Não sofre exaustão por falta de comida ou água.',
  'Deflect Energy': 'Desviar Ataques funciona contra ataques de qualquer tipo de dano.',
  'Disciplined Survivor':
    'Proficiência em todas as salvaguardas; pode gastar 1 Foco para repetir uma salvaguarda falha.',
  'Perfect Focus': 'Ao rolar iniciativa com menos de quatro pontos de Foco, fica com quatro.',
  'Superior Defense':
    'Ação bônus e 3 Foco concedem resistência a todos os danos exceto força por 1 minuto ou até ficar Incapacitado.',
  'Lay On Hands':
    'Reserva de cinco PV por nível de paladino. Ação bônus por toque para curar ou gastar cinco pontos para encerrar Envenenado.',
  'Paladin’s Smite':
    'Destruição Divina sempre preparada; pode conjurá-la uma vez sem gastar espaço por descanso longo.',
  'Faithful Steed':
    'Encontrar Corcel sempre preparada; pode conjurá-la uma vez sem espaço por descanso longo, usando ação em vez do tempo normal.',
  'Aura of Protection':
    'Enquanto não estiver Incapacitado, você e aliados numa emanação de 3 m somam seu Carisma, mínimo +1, às salvaguardas. Auras iguais não se acumulam.',
  'Abjure Foes':
    'Ação Mágica e Canalizar Divindade: criaturas vistas a até 18 m, até o modificador de Carisma, mínimo uma, fazem salvaguarda de Sabedoria ou ficam Amedrontadas por 1 minuto ou até receber dano; o alvo afetado só pode mover-se, agir ou usar ação bônus no turno.',
  'Aura of Courage':
    'Você e aliados na Aura de Proteção ficam imunes a Amedrontado enquanto estiverem nela.',
  'Radiant Strikes':
    'Ataques com armas corpo a corpo e ataques desarmados causam +1d8 radiante ao acertar.',
  'Restoring Touch':
    'Ao usar Cura pelas Mãos, pode gastar cinco pontos por condição para encerrar Amedrontado, Atordoado, Cego, Enfeitiçado, Paralisado ou Surdo.',
  'Aura Expansion': 'As auras de paladino aumentam de 3 m para 9 m.',
  'Favored Enemy':
    'Marca do Caçador sempre preparada; pode conjurá-la sem espaço uma quantidade de vezes determinada pelo nível de patrulheiro. Recupera os usos em descanso longo.',
  'Deft Explorer': 'Especialização em uma perícia proficiente e dois idiomas adicionais.',
  Roving:
    'Deslocamento +3 m sem armadura pesada; ganha deslocamentos de escalada e natação iguais ao deslocamento.',
  Tireless:
    'Ação Mágica: recebe 1d8 + Sabedoria, mínimo +1, PV temporários; usos iguais a Sabedoria, mínimo um, por descanso longo. Descansos curtos também reduzem um nível de Exaustão.',
  'Relentless Hunter': 'Receber dano não encerra sua concentração em Marca do Caçador.',
  'Nature’s Veil':
    'Ação bônus para ficar Invisível até o fim do próximo turno; usos iguais a Sabedoria, mínimo um, por descanso longo.',
  'Precise Hunter': 'Vantagem nos ataques contra o alvo da sua Marca do Caçador.',
  'Feral Senses': 'Percepção às cegas de 9 m.',
  'Foe Slayer': 'O dado de dano de Marca do Caçador aumenta de d6 para d10.',
  'Sneak Attack':
    'Dano adicional uma vez por turno com arma de acuidade ou à distância, com vantagem ou aliado elegível junto ao alvo e sem desvantagem. Dados aumentam com o nível de ladino.',
  'Thieves’ Cant': 'Conhece a Gíria dos Ladrões e um idioma adicional.',
  'Steady Aim':
    'Ação bônus: concede vantagem ao próximo ataque neste turno se ainda não se moveu; seu deslocamento fica zero até o fim do turno.',
  'Cunning Strike':
    'Pode trocar dados de Ataque Furtivo por Envenenar, Derrubar ou Retirar-se, com os custos e salvaguardas de cada opção.',
  'Improved Cunning Strike':
    'Pode aplicar até dois efeitos de Golpe Ardiloso no mesmo Ataque Furtivo, pagando o custo de ambos.',
  'Devious Strikes':
    'Golpe Ardiloso ganha Aturdir, Nocautear e Obscurecer, com custo de dados e salvaguardas próprios.',
  'Slippery Mind': 'Ganha proficiência em salvaguardas de Sabedoria e Carisma.',
  Elusive: 'Ataques contra você não podem ter vantagem enquanto não estiver Incapacitado.',
  'Stroke of Luck':
    'Após falhar num teste de d20, pode tratar o d20 como 20. Uma vez por descanso curto ou longo.',
  'Innate Sorcery':
    'Ação bônus, um minuto: CD de magias de feiticeiro +1 e vantagem nos ataques dessas magias. Dois usos por descanso longo.',
  'Font of Magic':
    'Pontos de Feitiçaria iguais ao nível de feiticeiro. Pode converter espaços em pontos ou usar ação bônus para criar espaços até o círculo 5, respeitando os custos da tabela.',
  'Sorcerous Restoration':
    'Ao terminar descanso curto, recupera Pontos de Feitiçaria até metade do nível de feiticeiro, arredondada para baixo; uma vez por descanso longo.',
  'Sorcery Incarnate':
    'Pode gastar 2 Pontos de Feitiçaria para ativar Feitiçaria Inata sem usos; enquanto ativa, pode usar até duas metamagias numa mesma magia.',
  'Arcane Apotheosis':
    'Enquanto Feitiçaria Inata está ativa, pode usar uma metamagia sem gastar pontos em cada um de seus turnos.',
  'Eldritch Invocations':
    'Escolha invocações respeitando os pré-requisitos. O total conhecido cresce com a tabela de bruxo.',
  'Pact Magic':
    'Espaços de pacto têm o círculo indicado na tabela de bruxo e são recuperados em descanso curto ou longo; ficam separados dos espaços normais de multiclasse.',
  'Magical Cunning':
    'Ritual de 1 minuto recupera até metade dos espaços de pacto, arredondada para cima; uma vez por descanso longo.',
  'Contact Patron':
    'Contatar Outro Plano sempre preparada; uma conjuração sem espaço para contatar seu patrono por descanso longo tem sucesso automático na salvaguarda.',
  'Eldritch Master': 'Astúcia Mágica passa a recuperar todos os espaços de pacto.',
  'Ritual Adept': 'Pode conjurar como ritual as magias rituais do grimório sem prepará-las.',
  'Arcane Recovery':
    'Após descanso curto, recupera espaços com soma de círculos até metade do nível de mago, arredondada para cima, sem recuperar espaços de círculo 6 ou maior; uma vez por descanso longo.',
  'Spell Mastery':
    'Escolha do grimório uma magia de círculo 1 e uma de círculo 2 com tempo de ação. Sempre preparadas e podem ser conjuradas no círculo base sem espaço; pode trocar uma após descanso longo.',
  'Signature Spells':
    'Escolha duas magias de círculo 3 do grimório. Sempre preparadas e pode conjurar cada uma uma vez sem espaço por descanso curto ou longo.',
  "Tinker's Magic":
    'Consertar é um truque adicional. Com ferramentas de funileiro, pode criar objetos utilitários da lista da característica; cada objeto dura até o próximo descanso longo, respeitando o limite por Inteligência.',
  'Replicate Magic Item':
    'Aprende planos de itens mágicos, inicialmente quatro. Após descanso longo, cria itens temporários de planos diferentes; os limites de planos e itens seguem a tabela. Não são compras nem moedas do Empório.',
  'Magic Item Tinker':
    'Pode recarregar um item replicado gastando espaço, drenar um item para gerar espaço ou transformar um item em outro plano conhecido, respeitando os limites de uso de cada opção.',
  'Flash of Genius':
    'Reação quando você ou criatura a até 9 m falha em teste de habilidade ou salvaguarda: soma sua Inteligência. Usos iguais a Inteligência, mínimo um, por descanso longo.',
  'Magic Item Adept': 'Pode manter sintonia com quatro itens mágicos.',
  'Spell-Storing Item':
    'Após descanso longo, armazena numa arma ou foco uma magia de artífice de círculo 1, 2 ou 3 com tempo de ação; outra criatura pode ativá-la usando sua Inteligência. Usos iguais a duas vezes Inteligência, mínimo dois.',
  'Advanced Artifice':
    'Pode manter sintonia com cinco itens mágicos e recupera um uso de Lampejo de Genialidade após descanso curto.',
  'Magic Item Master': 'Pode manter sintonia com seis itens mágicos.',
  'Soul of Artifice':
    'Ao cair a 0 PV sem morrer, pode desintegrar itens incomuns ou raros replicados para ficar com 20 PV por item. Após descanso curto, recupera todos os Lampejos de Genialidade se estiver sintonizado com um item.',
};
for (const circle of [6, 7, 8, 9])
  extendedFeatureSummaries['Mystic Arcanum (level ' + circle + ' spell)'] =
    'Escolha uma magia de bruxo de círculo ' +
    circle +
    '. Pode conjurá-la uma vez sem gastar espaço por descanso longo; esse uso fica separado dos espaços de pacto.';
for (const name of ['Action Surge (one use)', 'Action Surge (two uses)'])
  extendedFeatureSummaries[name] =
    'Ganha uma ação adicional no turno, exceto a ação Mágica. Recupera usos em descanso curto ou longo: um uso no nível 2 e dois no 17.';
for (const name of [
  'Indomitable (one use)',
  'Indomitable (two uses)',
  'Indomitable (three uses)',
])
  extendedFeatureSummaries[name] = extendedFeatureSummaries.Indomitable;

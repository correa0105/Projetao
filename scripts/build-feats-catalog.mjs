import fs from 'node:fs/promises';
const source = JSON.parse(
  await fs.readFile(process.argv[2] || '.local/class-feats-source.json', 'utf8'),
);
const descriptions = `Actor|Ator|Imitação de vozes e vantagem para representar outra pessoa.
Alert|Alerta|Soma proficiência à iniciativa e permite trocar iniciativa com um aliado disposto.
Archery|Arquearia|Recebe +2 nos ataques com armas à distância.
Athlete|Atleta|Levantar consome menos movimento, escalada aprimorada e saltos com menos corrida.
Blessed Warrior|Guerreiro abençoado|Escolha dois truques de clérigo usando Carisma.
Blind Fighting|Combate às cegas|Visão às cegas a até 3 metros.
Charger|Investida|Disparada aprimorada e dano adicional ou empurrão após uma investida.
Chef|Cozinheiro|Proficiência com utensílios de cozinheiro, comida que melhora descansos e petiscos que concedem PV temporários ao consumir.
Crafter|Artífice|Três ferramentas de artesão, desconto em itens não mágicos e fabricação rápida.
Crossbow Expert|Especialista em bestas|Ignora Recarga, melhora ataques próximos e ataques extras com bestas leves.
Crusher|Esmagador|Pode deslocar uma criatura atingida com dano contundente e favorecer ataques após um crítico.
Defense|Defesa|Recebe +1 na CA enquanto usa armadura leve, média ou pesada.
Defensive Duelist|Duelista defensivo|Reação com arma de Acuidade para aumentar a CA contra ataques corpo a corpo.
Druidic Warrior|Guerreiro druídico|Escolha dois truques de druida usando Sabedoria.
Dual Wielder|Combatente com duas armas|Ataque adicional e saque de duas armas conforme as condições do talento.
Dueling|Duelismo|Recebe +2 no dano com uma arma corpo a corpo em uma mão, sem outra arma empunhada.
Durable|Durável|Vantagem em salvaguardas contra a morte e uso de um Dado de Vida por ação bônus para recuperar PV.
Elemental Adept|Adepto elemental|Escolha um tipo de dano mágico; ignora resistência e melhora resultados 1 nos dados daquele dano.
Fey-Touched|Tocado pelas fadas|Passo Nebuloso e uma magia de nível 1 de Adivinhação ou Encantamento; usos e espaços conforme o talento.
Grappler|Agarrador|Combina dano desarmado e agarrão, melhora ataques e deslocamento com uma criatura agarrada.
Great Weapon Fighting|Combate com armas grandes|Trata resultados 1 e 2 nos dados de dano como 3 com arma elegível empunhada com duas mãos.
Great Weapon Master|Mestre de armas grandes|Dano adicional com armas Pesadas e ataque bônus após crítico ou reduzir uma criatura a zero.
Healer|Curandeiro|Kit de curandeiro permite gastar Dado de Vida; melhora resultados 1 de cura.
Heavily Armored|Fortemente protegido|Concede treinamento com armaduras pesadas.
Heavy Armor Master|Mestre de armaduras pesadas|Reduz dano contundente, cortante e perfurante enquanto usa armadura pesada.
Inspiring Leader|Líder inspirador|Após um descanso, pode conceder PV temporários a até seis criaturas escolhidas; não é uma reserva permanente.
Interception|Interceptação|Reação para reduzir dano de um ataque contra criatura próxima com arma ou escudo.
Keen Mind|Mente aguçada|Treinamento ou especialização em uma perícia de conhecimento e Estudar como ação bônus.
Lightly Armored|Levemente protegido|Concede treinamento com armaduras leves e escudos.
Lucky|Sortudo|Pontos de sorte por descanso longo para vantagem própria ou desvantagem em um ataque recebido.
Mage Slayer|Matador de magos|Interfere na concentração e permite resistir a uma salvaguarda mental por descanso.
Magic Initiate|Iniciado em Magia|Dois truques e uma magia de nível 1 da lista escolhida, com atributo de conjuração escolhido.
Martial Weapon Training|Treinamento com armas marciais|Concede proficiência com armas marciais.
Medium Armor Master|Mestre de armaduras médias|Permite maior contribuição de Destreza à CA com armadura média.
Moderately Armored|Moderadamente protegido|Concede treinamento com armaduras médias.
Mounted Combatant|Combatente montado|Melhora ataques, proteção e salvaguardas da montaria nas condições do talento.
Musician|Músico|Três instrumentos; sua música após descansar pode conceder Inspiração Heroica.
Observant|Observador|Treinamento ou especialização em uma perícia de observação e Procurar como ação bônus.
Piercer|Perfurador|Permite repetir um dado de dano perfurante e acrescenta dado no crítico.
Poisoner|Envenenador|Criação e aplicação rápida de veneno; ignora resistência a dano venenoso.
Polearm Master|Mestre de armas de haste|Ataque bônus e reação quando uma criatura entra no alcance de arma elegível.
Protection|Proteção|Reação com escudo para impor desvantagem a ataques contra um aliado próximo.
Resilient|Resiliente|Aumenta um atributo sem proficiência em salvaguarda e concede proficiência nessa salvaguarda.
Ritual Caster|Conjurador de rituais|Aprende rituais de nível 1 e permite um ritual rápido por descanso longo.
Savage Attacker|Atacante Selvagem|Uma vez por turno, rola duas vezes os dados de dano de uma arma e escolhe um resultado.
Sentinel|Sentinela|Reações e ataques de oportunidade aprimorados; pode interromper o movimento do alvo.
Shadow-Touched|Tocado pelas sombras|Invisibilidade e uma magia de nível 1 de Ilusão ou Necromancia; usos conforme o talento.
Sharpshooter|Atirador de elite|Melhora ataques próximos e de longo alcance; ignora cobertura parcial com armas à distância.
Shield Master|Mestre de escudo|Golpe de escudo e proteção contra efeitos que exigem salvaguarda de Destreza.
Skill Expert|Especialista em perícia|Uma proficiência em perícia e uma especialização.
Skilled|Habilidoso|Três proficiências novas em perícias ou ferramentas.
Skulker|Espreitador|Visão às cegas curta e benefícios para furtividade em combate.
Slasher|Cortador|Reduz deslocamento ao causar dano cortante e prejudica ataques do alvo após crítico.
Speedy|Veloz|Aumenta deslocamento em 3 metros e melhora Disparada e defesa contra ataques de oportunidade.
Spell Sniper|Atirador de magias|Melhora alcance, cobertura e ataques mágicos contra alvos próximos.
Tavern Brawler|Brigão de Taverna|Melhora ataques desarmados, armas improvisadas e empurrões.
Telekinetic|Telecinético|Mãos Mágicas aprimorada e empurrão telecinético por ação bônus.
Telepathic|Telepático|Comunicação telepática e Detectar Pensamentos conforme os usos do talento.
Thrown Weapon Fighting|Combate com armas de arremesso|Recebe +2 no dano de ataques à distância com armas de Arremesso.
Tough|Robusto|Aumenta o máximo de PV em 2 por nível do personagem.
Two-Weapon Fighting|Combate com duas armas|Adiciona o modificador do atributo ao dano do ataque extra de arma Leve.
Unarmed Fighting|Combate desarmado|Melhora o dado do golpe desarmado e causa dano a uma criatura agarrada no início do turno.
War Caster|Conjurador de guerra|Melhora concentração, componentes somáticos e reações de magia.
Weapon Master|Mestre de armas|Uma maestria de arma adicional, com troca após descanso longo.
Boon of Combat Prowess|Dádiva de proeza em combate|Permite converter um ataque que errou em acerto, recuperando no próximo turno.
Boon of Dimensional Travel|Dádiva de viagem dimensional|Teleporte curto após a ação Atacar ou Mágica.
Boon of Energy Resistance|Dádiva de resistência a energia|Escolha duas resistências de energia, com troca após descanso longo.
Boon of Fate|Dádiva do destino|Modifica um teste de d20 com 2d4; recuperação por iniciativa ou descanso.
Boon of Fortitude|Dádiva de fortitude|Aumenta o máximo de PV em 40 e melhora recuperação de PV.
Boon of Irresistible Offense|Dádiva de ofensiva irresistível|Ignora resistências físicas e acrescenta dano ao obter 20 no ataque.
Boon of Recovery|Dádiva de recuperação|Pode recuperar metade dos PV máximos e evitar cair a zero conforme os usos da dádiva.
Boon of Skill|Dádiva de perícia|Proficiência em todas as perícias e uma especialização.
Boon of Speed|Dádiva de velocidade|Aumenta muito o deslocamento e permite Desengajar por ação bônus.
Boon of Spell Recall|Dádiva de recuperação de magia|Uma rolagem pode preservar um espaço de magia de nível 1 a 4.
Boon of the Night Spirit|Dádiva do espírito noturno|Invisibilidade e resistências enquanto em penumbra ou escuridão.
Boon of Truesight|Dádiva de visão verdadeira|Concede visão verdadeira a até 18 metros.`;
const texts = Object.fromEntries(
  descriptions.split('\n').map((s) => {
    const [n, name, text] = s.split('|');
    return [n, { name, text }];
  }),
);
const feats = source.feat
  .filter((f) => f.source === 'XPHB' && f.name !== 'Ability Score Improvement')
  .map((f) => {
    if (!texts[f.name]) throw Error('Missing original summary ' + f.name);
    const ability = f.ability?.[0],
      keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    return {
      id: f.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-$/, ''),
      ...texts[f.name],
      category: f.category,
      source: f.source,
      page: f.page,
      prerequisite: f.prerequisite ?? [],
      abilities:
        ability?.choose?.from?.map((k) => keys.indexOf(k)) ??
        keys.flatMap((k, i) => (ability?.[k] ? [i] : [])),
      boost: ability ? 1 : 0,
      maximum: ability?.max ?? 20,
      repeatable: !!f.repeatable,
    };
  });
await fs.writeFile('shared/feats-2024.json', JSON.stringify(feats, null, 2) + '\n');
console.log(
  JSON.stringify({ count: feats.length, styles: feats.filter((f) => f.category === 'FS').length }),
);

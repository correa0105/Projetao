import fs from 'node:fs';
import { expandVariants } from './emporium-variants.mjs';
const sourceUrl = 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf';
const old = JSON.parse(fs.readFileSync('data/shop-export/loja.json', 'utf8')).items;
const existing = new Map(old.map((x) => [x.id, x]));
const expansion = [];
const definitions = [];
const idOf = (s) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
function item(
  id,
  name,
  en,
  category,
  price,
  weight,
  description,
  visual,
  material,
  speech,
  page,
  extra = {},
) {
  definitions.push({
    id,
    name,
    en,
    category,
    page,
    price_cp: price,
    weight_lb: weight,
    description,
    material,
    ...extra,
  });
  if (existing.has(id)) return;
  expansion.push({
    id,
    name,
    original_name: en,
    category,
    price_cp: price,
    weight_lb: weight,
    weight_estimated: false,
    description,
    merchant_comment: speech,
    source: 'SRD 5.2.1',
    source_url: sourceUrl + '#page=' + page,
    image_path: `/shop/expanded/${id}.webp`,
    audio_path: `/audio/emporium/${id}.wav`,
    raw_data: { srd_page: page, sound_material: material, ...extra },
    art: { subject: visual, material },
  });
}
const weapons = `
club|Clava|Club|10|2|1d4|Contundente|Leve|Lentidão|gnarled oak one-handed club|wood|Uma clava honesta: faz exatamente o que parece. Evite testá-la no balcão.
dagger|Adaga|Dagger|200|1|1d4|Perfurante|Acuidade, leve, arremesso 6/18 m|Ágil|steel dagger|metal|A adaga cabe na bota; retirar a bota antes ajuda a preservar os dedos.
greatclub|Clava grande|Greatclub|20|10|1d8|Contundente|Duas mãos|Empurrão|massive straight oak two-handed greatclub|wood|Esta clava grande exige duas mãos. A terceira seria útil para pedir desculpas.
handaxe|Machadinha|Handaxe|500|2|1d6|Cortante|Leve, arremesso 6/18 m|Incômodo|compact single bladed iron handaxe with straight wooden haft|metal|Machadinha bem equilibrada. Quando arremessar, lembre que o retorno não está incluído.
javelin|Azagaia|Javelin|50|2|1d6|Perfurante|Arremesso 9/36 m|Lentidão|slender straight wooden javelin with narrow steel point|wood|A azagaia alcança a discussão do outro lado do rio. Use esse talento com prudência.
light-hammer|Martelo leve|Light Hammer|200|2|1d4|Contundente|Leve, arremesso 6/18 m|Ágil|small steel light hammer with short ashwood handle|metal|Martelo leve: serve para pregos e certas conversas difíceis. Não confunda as duas tarefas.
mace|Maça|Mace|500|4|1d6|Contundente|—|Debilitar|steel flanged mace with straight handle and six symmetric flanges|metal|A maça não tem fio para amolar. Ainda assim, meu aprendiz conseguiu machucar-se limpando uma.
quarterstaff|Bordão|Quarterstaff|20|4|1d6|Contundente|Versátil 1d8|Derrubar|straight wooden quarterstaff|wood|Um bordão não resolve tudo, mas oferece um bom argumento a distância de braço.
sickle|Foice|Sickle|100|2|1d4|Cortante|Leve|Ágil|short handled agricultural sickle with single curved steel blade|metal|A foice chegou da oficina, nunca de um cemitério. A embalagem sombria é coincidência.
spear|Lança|Spear|100|3|1d6|Perfurante|Arremesso 6/18 m, versátil 1d8|Debilitar|straight ashwood spear with symmetric leaf steel point|wood|Esta lança mantém o problema longe do seu nariz. É uma distância que aprecio.
dart|Dardo|Dart|5|0.25|1d4|Perfurante|Acuidade, arremesso 6/18 m|Incômodo|small weighted throwing dart with feathered tail and steel point|metal|Dardo pequeno, pontaria importante. O alvo é aquela coisa redonda, nunca o ajudante.
light-crossbow|Besta leve|Light Crossbow|2500|5|1d8|Perfurante|Munição 24/96 m, recarga, duas mãos|Lentidão|medieval light wooden crossbow, taut connected string, coherent trigger stock and steel bow|wood|A besta leve vem com mecanismo revisado. O dedo só vai no gatilho quando acabar a conversa.
shortbow|Arco curto|Shortbow|2500|2|1d6|Perfurante|Munição 24/96 m, duas mãos|Incômodo|wooden shortbow|wood|Arco curto, histórias longas. O alvo não precisa conhecer nenhuma delas.
sling|Funda|Sling|10|0|1d4|Contundente|Munição 9/36 m|Lentidão|braided leather sling with stone cradle and two continuous cords|leather|A funda ocupa pouco espaço. Reserve espaço também para a pedra, ou vira só um cordão.
battleaxe|Machado de batalha|Battleaxe|1000|4|1d8|Cortante|Versátil 1d10|Derrubar|single bladed medieval battleaxe, steel head securely socketed coaxially onto straight ashwood haft|metal|O machado de batalha tem o cabo firme. Meu preço também, antes que pergunte.
flail|Mangual|Flail|1000|2|1d8|Contundente|—|Debilitar|medieval one handed flail with one steel striking ball connected by a short chain to wooden handle|chain|O mangual tem uma ponta que não para quieta. Treine longe dos amigos e dos vasos.
glaive|Glaive|Glaive|2000|6|1d10|Cortante|Pesada, alcance, duas mãos|Raspar|long medieval glaive polearm with a single convex cutting blade fitted at end of straight shaft|metal|A glaive alcança longe. Faça meia-volta fora da loja, por favor.
greataxe|Machado grande|Greataxe|3000|7|1d12|Cortante|Pesada, duas mãos|Trespassar|large two handed single steel bladed greataxe with long straight continuous oak haft and coaxial socket|metal|Este machado grande exige espaço e duas mãos. Se alguém oferecer malabarismo, recuse.
greatsword|Espada grande|Greatsword|5000|6|2d6|Cortante|Pesada, duas mãos|Raspar|steel greatsword|metal|Espada grande: a bainha não é pequena e a conta também não.
halberd|Alabarda|Halberd|2000|6|1d10|Cortante|Pesada, alcance, duas mãos|Trespassar|medieval halberd with axe blade, aligned spear point and rear hook on one continuous long wooden shaft|metal|Alabarda: três soluções no mesmo cabo. A porta da loja pede que escolha uma de cada vez.
lance|Lança de cavalaria|Lance|1000|6|1d10|Perfurante|Pesada, alcance, duas mãos salvo quando montado|Derrubar|long tapering wooden cavalry lance with conical steel point and protective circular hand guard|wood|A lança de cavalaria combina com uma montaria. A cadeira atrás do balcão não conta.
longsword|Espada longa|Longsword|1500|3|1d8|Cortante|Versátil 1d10|Debilitar|medieval steel longsword|metal|Espada longa bem balanceada. O peso da responsabilidade fica com você.
maul|Malho|Maul|1000|10|2d6|Contundente|Pesada, duas mãos|Derrubar|heavy two handed steel maul with rectangular head centered coaxially on a long oak handle|metal|O malho é pesado. Se conseguir levantá-lo, já passou da parte que derrubou meu aprendiz.
morningstar|Estrela da manhã|Morningstar|1500|4|1d8|Perfurante|—|Debilitar|medieval morningstar spiked steel ball firmly mounted directly on straight wooden handle, no chain|metal|Estrela da manhã. Ao contrário do nascer do sol, esta convém observar de longe.
pike|Pique|Pike|500|18|1d10|Perfurante|Pesada, alcance, duas mãos|Empurrão|very long straight medieval pike with narrow steel spear point, no extra blade|metal|O pique é comprido. Entrego pela janela para não derrubar o lustre de novo.
rapier|Rapieira|Rapier|2500|2|1d8|Perfurante|Acuidade|Incômodo|slender steel rapier|metal|Rapieira elegante. A elegância da estocada depende de quem a segura.
scimitar|Cimitarra|Scimitar|2500|3|1d6|Cortante|Acuidade, leve|Ágil|single edged gently curved steel scimitar with coherent guard and leather grip|metal|A curva da cimitarra foi feita pelo ferreiro. Não tente endireitar: um cliente tentou.
shortsword|Espada curta|Shortsword|1000|2|1d6|Perfurante|Acuidade, leve|Incômodo|straight double edged short sword with short cruciform guard and leather grip|metal|Espada curta: discreta no tamanho, direta no assunto.
trident|Tridente|Trident|500|4|1d8|Perfurante|Arremesso 6/18 m, versátil 1d10|Derrubar|three evenly spaced steel pronged trident attached to one straight continuous ashwood shaft|metal|Tridente, três pontas. Quem disser que é um garfo gigante paga o mesmo preço.
warhammer|Martelo de guerra|Warhammer|1500|5|1d8|Contundente|Versátil 1d10|Empurrão|medieval one handed steel warhammer with square hammer face and short rear beak mounted on straight shaft|metal|O martelo de guerra não é para construir a casa. Para discutir com quem a invade, pode servir.
war-pick|Picareta de guerra|War Pick|500|2|1d8|Perfurante|Versátil 1d10|Debilitar|compact medieval war pick with one narrow curved steel beak on straight ashwood haft|metal|A picareta de guerra não inclui mina. Meu contador insiste que eu avise.
whip|Chicote|Whip|200|3|1d4|Cortante|Acuidade, alcance|Lentidão|braided brown leather whip loosely coiled, one handle and a continuous tapering lash|leather|Chicote de couro bem trançado. O estalo chama atenção; tenha certeza de que quer companhia.
blowgun|Zarabatana|Blowgun|1000|1|1|Perfurante|Munição 7,5/30 m, recarga|Incômodo|straight slender wooden blowgun tube with clearly open bore and simple carved mouthpiece|wood|Zarabatana: sopre na ponta certa. Parece óbvio até chegar um bárbaro muito confiante.
hand-crossbow|Besta de mão|Hand Crossbow|7500|3|1d6|Perfurante|Munição 9/36 m, leve, recarga|Incômodo|small medieval hand crossbow with connected bow limbs, string and one coherent pistol-like wooden grip|wood|A besta de mão é compacta. Pequena não significa que deva apontá-la para o próprio pé.
heavy-crossbow|Besta pesada|Heavy Crossbow|5000|18|1d10|Perfurante|Munição 30/120 m, pesada, recarga, duas mãos|Empurrão|large medieval heavy crossbow with thick wooden stock and single connected steel bow with taut string|wood|A besta pesada é para duas mãos. O entusiasmo sozinho não sustenta dezoito libras.
longbow|Arco longo|Longbow|5000|2|1d8|Perfurante|Munição 45/180 m, pesada, duas mãos|Lentidão|long wooden bow|wood|O arco longo alcança longe. Meu desconto, infelizmente, não alcança nem a porta.
musket|Mosquete|Musket|50000|10|1d12|Perfurante|Munição 12/36 m, recarga, duas mãos|Lentidão|early fantasy flintlock musket, long single straight iron barrel, coherent wooden shoulder stock and lock mechanism, no modern parts|metal|Mosquete de pólvora. Mantenha seco; chuva não respeita nem o seu preço.
pistol|Pistola|Pistol|25000|3|1d10|Perfurante|Munição 9/27 m, recarga|Incômodo|early flintlock pistol with one iron barrel and curved wooden grip, no modern magazine or trigger duplicates|metal|Pistola de pederneira. Guarde a pólvora longe da vela e teremos uma tarde tranquila.
`
  .trim()
  .split('\n');
for (const l of weapons) {
  const [id, pt, en, cp, lb, dice, dmg, prop, mastery, visual, material, speech] = l.split('|');
  item(
    id,
    pt,
    en,
    'Armas',
    +cp,
    +lb,
    `${dice} de dano ${dmg.toLowerCase()}. Propriedades: ${prop}. Maestria: ${mastery}.`,
    visual,
    material,
    speech,
    91,
    {
      weapon: { dice, damage_type: dmg, properties: prop, mastery },
      two_handed: prop.includes('Duas mãos') || prop.includes('duas mãos'),
      equipment_slots: prop.toLowerCase().includes('duas mãos')
        ? ['main_hand']
        : ['main_hand', 'off_hand'],
    },
  );
}
const armors = `
padded-armor|Armadura acolchoada|Padded Armor|500|8|11 + Des|Leve|—|Sim|quilted padded medieval gambeson|cloth|A acolchoada amortece golpes. Já o calor do verão, esse ela preserva com dedicação.
leather-armor|Armadura de couro|Leather Armor|1000|10|11 + Des|Leve|—|Não|leather armor|leather|Couro flexível para quem prefere chegar sem anunciar cada passo.
studded-leather|Couro batido|Studded Leather Armor|4500|13|12 + Des|Leve|—|Não|studded leather armor|leather|Rebites bem presos. Vários sobreviveram até às ideias do meu aprendiz.
hide-armor|Armadura de peles|Hide Armor|1000|12|12 + Des (máx. 2)|Média|—|Não|layered hide medieval torso armor with simple leather straps|leather|Armadura de peles. Não pergunte de que bicho veio se acabou de almoçar.
chain-shirt|Camisão de malha|Chain Shirt|5000|20|13 + Des (máx. 2)|Média|—|Não|short sleeved waist length medieval steel chain shirt, fine linked rings|chain|O camisão de malha cabe sob a roupa. A discrição melhora se não sacudir os ombros sem parar.
scale-mail|Cota de escamas|Scale Mail|5000|45|14 + Des (máx. 2)|Média|—|Sim|medieval torso scale armor with overlapping small steel scales attached to leather backing|metal|Cota de escamas, sem dragão envolvido. Foi bem mais seguro para o fornecedor.
breastplate|Peitoral|Breastplate|40000|20|14 + Des (máx. 2)|Média|—|Não|steel breastplate|metal|Peitoral polido: protege o peito e dá trabalho ao pano de limpeza.
half-plate-armor|Meia armadura de placas|Half Plate Armor|75000|40|15 + Des (máx. 2)|Média|—|Sim|medieval steel half plate torso armor with articulated shoulders, no full helmet or boots|metal|Meia armadura de placas, proteção respeitável. Metade do nome não significa metade da conta.
ring-mail|Cota de anéis|Ring Mail|3000|40|14|Pesada|—|Sim|medieval thick leather torso armor with large steel rings stitched to exterior|chain|Cota de anéis. Faz barulho ao andar; negocie a emboscada com seus companheiros antes.
chain-mail|Cota de malha|Chain Mail|7500|55|16|Pesada|13|Sim|heavy steel chain mail|chain|A malha tem muitos elos. Contá-los não está incluído no atendimento.
splint-armor|Armadura de talas|Splint Armor|20000|60|17|Pesada|15|Sim|medieval torso splint armor with parallel vertical steel strips riveted to dark leather|metal|Armadura de talas firmes. As minhas costas pedem que você a carregue até a porta.
plate-armor|Armadura de placas|Plate Armor|150000|65|18|Pesada|15|Sim|complete steel plate armor|metal|O conjunto de placas vem completo. Precisa de espaço no baú e força para tirá-lo de lá.
shield|Escudo|Shield|1000|6|+2|Escudo|—|Não|round steel shield|metal|Um bom escudo recebe os argumentos que você preferia não ouvir.
`
  .trim()
  .split('\n');
for (const l of armors) {
  const [id, pt, en, cp, lb, ac, kind, str, stealth, visual, material, speech] = l.split('|');
  item(
    id,
    pt,
    en,
    'Armaduras',
    +cp,
    +lb,
    `CA ${ac}. Categoria: ${kind}. Força mínima: ${str}. Desvantagem em Furtividade: ${stealth}.`,
    visual,
    material,
    speech,
    92,
    {
      armor: { ac, kind, strength: str, stealth_disadvantage: stealth === 'Sim' },
      equipment_slots: [id === 'shield' ? 'off_hand' : 'armor'],
    },
  );
}
for (const l of fs.readFileSync('data/emporium-source/mundane.tsv', 'utf8').trim().split('\n')) {
  const [id, pt, en, gp, lb, page, desc, visual, material, speech] = l.trim().split('|');
  item(
    id,
    pt,
    en,
    +page < 95
      ? 'Ferramentas e instrumentos'
      : +page >= 100 &&
          [
            'carriage',
            'cart',
            'chariot',
            'sled',
            'wagon',
            'airship',
            'galley',
            'keelboat',
            'longship',
            'rowboat',
            'sailing-ship',
            'warship',
          ].includes(id)
        ? 'Veículos'
        : 'Itens mundanos',
    Math.round(+gp * 100),
    +lb,
    desc,
    visual,
    material,
    speech,
    +page,
  );
}
const magicSource = JSON.parse(
  fs.readFileSync('data/emporium-source/srd-magic-index.json', 'utf8'),
);
// Barding follows the explicit x4 price/x2 weight rule for all twelve body armors.
for (const base of definitions.filter((x) => x.armor && x.id !== 'shield').map((x) => ({ ...x }))) {
  const id = `barding-${base.id}`;
  item(
    id,
    `Barda: ${base.name.toLowerCase()}`,
    `${base.en} Barding`,
    'Equipamento de montaria',
    base.price_cp * 4,
    base.weight_lb * 2,
    `Armadura para montaria. CA ${base.armor.ac}; quatro vezes o preço e duas vezes o peso da versão humanoide. Requer ajuste à montaria; não altera sua CA automaticamente.`,
    `complete empty equine barding assembly made from ${base.id.includes('chain') ? 'interlinked iron chain' : base.id.includes('leather') || base.id === 'hide-armor' ? 'layered brown leather' : base.id === 'padded-armor' ? 'quilted padded cloth' : 'articulated dark steel'}, ${base.name}, coherent four leg openings and long torso panels, detached horse-shaped armor only, no horse, no person, no display stand`,
    base.material,
    `Esta barda é de ${base.name.toLowerCase()}. ${base.id === 'padded-armor' ? 'O tecido também pede escova.' : base.id === 'hide-armor' ? 'A sela deve caber sem apertar.' : base.id === 'leather-armor' ? 'O couro precisa de cuidado.' : base.id === 'studded-leather' ? 'Confira os rebites antes da estrada.' : base.id === 'chain-shirt' ? 'Os elos não gostam de ferrugem.' : base.id === 'scale-mail' ? 'Escamas bem presas fazem diferença.' : base.id === 'breastplate' ? 'Protege o peito sem esquecer o ajuste.' : base.id === 'half-plate-armor' ? 'As partes articuladas precisam de folga.' : base.id === 'ring-mail' ? 'Os anéis anunciam a chegada.' : base.id === 'chain-mail' ? 'Não deixe o peso surpreender a montaria.' : base.id === 'splint-armor' ? 'As talas devem acompanhar o movimento.' : 'O conjunto pesado pede um tratador paciente.'}`,
    100,
    { barding: true, armor_base: base.id, equipment_slots: [] },
  );
}
const food = [
  [
    'ale-mug',
    'Caneca de cerveja',
    'Ale (mug)',
    4,
    1,
    101,
    'Cerveja em caneca.',
    'full medieval ceramic mug of amber ale with restrained foam, no lettering',
    'glass',
    'A cerveja está fresca. O crédito do meu balcão, menos.',
  ],
  [
    'bread-loaf',
    'Pão',
    'Bread (loaf)',
    2,
    1,
    101,
    'Um pão.',
    'one complete rustic round loaf of bread with natural browned crust',
    'cloth',
    'Pão de hoje. Partilhar é uma escolha; farelar no balcão também.',
  ],
  [
    'cheese-wedge',
    'Fatia de queijo',
    'Cheese (wedge)',
    10,
    0.5,
    101,
    'Uma fatia de queijo.',
    'one triangular wedge of firm aged cheese with natural rind',
    'cloth',
    'Queijo curado. O cheiro é forte, mas a coragem de entrar numa masmorra costuma ser mais.',
  ],
  [
    'wine-common',
    'Vinho comum',
    'Wine (common bottle)',
    20,
    2,
    102,
    'Uma garrafa de vinho comum.',
    'one plain green glass medieval wine bottle with cork, no label',
    'liquid',
    'Vinho comum para brindar sem gastar o tesouro da missão.',
  ],
  [
    'wine-fine',
    'Vinho fino',
    'Wine (fine bottle)',
    1000,
    2,
    102,
    'Uma garrafa de vinho fino.',
    'one dark glass fine wine bottle with burgundy wax seal, no label',
    'liquid',
    'O vinho fino acompanha boas notícias. Para más notícias, guarde a garrafa inteira.',
  ],
  ...[
    ['squalid', 'Miserável', 1, 'small chipped bowl with thin gruel'],
    ['poor', 'Pobre', 2, 'wooden bowl with simple soup and crust of bread'],
    ['modest', 'Modesta', 10, 'wooden plate with hearty stew and bread'],
    ['comfortable', 'Confortável', 20, 'ceramic plate with roast vegetables and a portion of meat'],
    ['wealthy', 'Abastada', 30, 'pewter plate with well prepared roast meat, vegetables and bread'],
    [
      'aristocratic',
      'Aristocrática',
      60,
      'fine ceramic plate with carefully prepared roast and colorful vegetables',
    ],
  ].map(([id, name, cp, v], i) => [
    `meal-${id}`,
    `Refeição ${name.toLowerCase()}`,
    `Meal (${name})`,
    cp,
    1,
    i < 3 ? 101 : 102,
    'Uma refeição pronta, conforme a tabela de comida do SRD.',
    `one medieval ${v}, appetizing complete dish, no cutlery or text`,
    'cloth',
    `Refeição ${name.toLowerCase()}. ${['A porção custa pouco; coma antes que esfrie.', 'A sopa simples aquece depois da estrada.', 'O ensopado sustenta uma conversa longa.', 'Reserve um lugar perto da lareira.', 'O tempero merece uma pausa na viagem.', 'O cozinheiro caprichou; não peça que faça duas vezes.'][i]}`,
  ]),
];
for (const [id, pt, en, cp, lb, page, desc, visual, material, speech] of food) {
  item(id, pt, en, 'Comida e bebida', cp, lb, desc, visual, material, speech, page, {
    consumable: true,
    equipment_slots: ['main_hand', 'off_hand'],
  });
  expansion.at(-1).weight_estimated = true;
}
const normalize = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const oldByName = new Map(old.map((x) => [normalize(x.original_name), x.id]));
const rarityPrices = {
  Common: 100,
  Uncommon: 400,
  Rare: 4000,
  'Very Rare': 40000,
  Legendary: 200000,
  Artifact: null,
};
const rarityCategories = {
  Common: 'Mágicos comuns',
  Uncommon: 'Mágicos incomuns',
  Rare: 'Mágicos raros',
  'Very Rare': 'Mágicos muito raros',
  Legendary: 'Mágicos lendários',
  Artifact: 'Artefatos',
};
function physical(en, kind, visual) {
  const text = (en + ' ' + visual).toLowerCase();
  if (kind === 'Potion' || /dust|pigment|oil|elixir|philter|solvent|glue/.test(text))
    return ['liquid', 0.5];
  if (/chain|shackle|bands/.test(text)) return ['chain', 6];
  if (/scroll|manual|tome|deck/.test(text)) return ['paper', /scroll/.test(text) ? 0 : 5];
  if (/cloth|robe|cloak|cape|carpet|wing/.test(text)) return ['cloth', 3];
  if (/boot|glove|gauntlet|pouch|bag|haversack|quiver|belt/.test(text)) return ['leather', 2];
  if (/crystal|gem|stone|pearl|eyes|goggles|sphere/.test(text)) return ['glass', 0.2];
  if (
    /amulet|ring|necklace|medallion|talisman|scarab|brooch|circlet|helm|armor|shield|sword|axe|mace|hammer|javelin|trident|rod|chime|censer|horn|lantern/.test(
      text,
    )
  )
    return ['metal', kind === 'Armor' ? 20 : kind === 'Weapon' ? 3 : 1];
  return ['wood', /staff|broom/.test(text) ? 4 : 1];
}
const magicDefinitions = [];
for (const line of fs.readFileSync('data/emporium-source/magic.tsv', 'utf8').trim().split('\n')) {
  const [num, pt, desc, visual, speech] = line.trim().split('|'),
    s = magicSource[+num - 1],
    en = s.name.replace(/\s+/g, ' ').trim();
  if (!s || !pt || !desc || !visual || !speech) throw Error('Bad magic definition ' + num);
  const kind = s.kind,
    rarity = s.rarity,
    variable = s.variable;
  const consumable =
    kind === 'Potion' ||
    kind === 'Scroll' ||
    /^(Ammunition|Bead of|Candle of Invocation|Dust of|Elemental Gem|Feather Token|Manual of Golems|Sovereign Glue|Universal Solvent)/.test(
      en,
    );
  let id =
    oldByName.get(normalize(en)) ||
    {
      152: 'potion-of-healing',
      209: 'spell-scroll-cantrip',
      253: 'magic-weapon',
      9: 'magic-armor',
      2: 'magic-ammunition',
      203: 'magic-shield',
      250: 'wand-of-the-war-mage',
    }[+num] ||
    idOf(en);
  const [material, lb] = physical(en, kind, visual);
  const gp = rarityPrices[rarity],
    price = gp === null ? null : gp * 100 * (consumable && kind !== 'Scroll' ? 0.5 : 1);
  const def = {
    number: +num,
    id,
    name: pt,
    en,
    description: desc,
    visual,
    speech,
    page: s.page,
    kind,
    rarity,
    variable,
    consumable,
    material,
    weight: lb,
    price_cp: price,
    attunement: s.attunement,
    srd_type: s.srd_type,
  };
  magicDefinitions.push(def);
  item(
    id,
    pt,
    en,
    kind === 'Potion' ? 'Poções' : rarityCategories[rarity],
    price,
    lb,
    desc,
    visual,
    material,
    speech,
    s.page,
    {
      magic_family: en,
      magic_number: +num,
      rarity,
      attunement: def.attunement,
      consumable,
      srd_type: def.srd_type,
    },
  );
  const added = expansion.find((x) => x.id === id);
  if (added) added.weight_estimated = true;
}
fs.writeFileSync(
  'data/emporium-source/magic-definitions.json',
  JSON.stringify(magicDefinitions, null, 2),
);
expandVariants({
  expansion,
  definitions,
  magicDefinitions,
  old,
  rarityPrices,
  rarityCategories,
  item,
  idOf,
});
for (const line of fs
  .readFileSync('data/emporium-source/cosmetics.tsv', 'utf8')
  .trim()
  .split('\n')) {
  const [id, name, cp, lb, slot, visual, material, speech] = line.split('|');
  item(
    id,
    name,
    name,
    'Cosméticos',
    +cp,
    +lb,
    'Acessório cosmético sem efeitos mágicos.',
    visual,
    material,
    speech,
    0,
    { cosmetic_type: slot, equipment_slots: [slot] },
  );
  const x = expansion.at(-1);
  x.source = 'Conteúdo original da Alvorada Cinzenta';
  x.source_url = '';
  x.weight_estimated = true;
}
function save() {
  fs.mkdirSync('public/shop/expanded', { recursive: true });
  fs.mkdirSync('public/audio/emporium', { recursive: true });
  fs.writeFileSync(
    'data/emporium-expansion.json',
    JSON.stringify(
      { schema_version: 1, edition: 'SRD 5.2.1 (2024)', source_url: sourceUrl, items: expansion },
      null,
      2,
    ) + '\n',
  );
  fs.writeFileSync(
    'data/emporium-source/physical-definitions.json',
    JSON.stringify(definitions, null, 2),
  );
}
save();

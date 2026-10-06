// Canonical identities are retained for the first concrete variant of every family.
export function expandVariants({
  expansion,
  definitions,
  magicDefinitions,
  old,
  rarityPrices,
  rarityCategories,
  item,
  idOf,
}) {
  const basic = new Map(
    definitions
      .filter((x) => x.weapon || x.armor)
      .map((x) => [
        x.id,
        {
          ...x,
          ...expansion.find((y) => y.id === x.id),
          ...old.find((y) => y.id === x.id),
          weight_lb: x.weight_lb,
          price_cp: x.price_cp,
        },
      ]),
  );
  const byEn = new Map([...basic.values()].map((x) => [x.en, x]));
  const imageOf = (x) => x.image_path || `/shop/items/${x.id}.png`;
  const addVariant = (
    def,
    key,
    label,
    rarity = def.rarity,
    {
      description = def.description,
      visual = def.visual,
      base,
      price,
      art = true,
      extra = {},
    } = {},
  ) => {
    const id =
      key === null ? def.id : def.number === 209 ? `spell-scroll-${key}` : `${def.id}-${key}`;
    const slots =
      base?.equipment_slots ??
      (base?.weapon
        ? base?.two_handed
          ? ['main_hand']
          : ['main_hand', 'off_hand']
        : base?.armor
          ? ['armor']
          : undefined);
    const value =
      price !== undefined
        ? price
        : rarityPrices[rarity] === null
          ? null
          : Math.round(
              rarityPrices[rarity] * 100 * (def.consumable && def.kind !== 'Scroll' ? 0.5 : 1) +
                (base?.price_cp || 0),
            );
    const desc = description + (base ? ` Forma: ${base.name}. ${base.description || ''}` : '');
    const speech = `${def.speech} Esta peça é ${label.toLowerCase()}.`;
    let current = expansion.find((x) => x.id === id);
    if (current) {
      Object.assign(current, {
        name: `${def.name} (${label})`,
        original_name: `${def.en} (${label})`,
        category: def.kind === 'Potion' ? 'Poções' : rarityCategories[rarity],
        price_cp: value,
        description: desc,
        merchant_comment: speech,
      });
    } else if (!old.some((x) => x.id === id)) {
      item(
        id,
        `${def.name} (${label})`,
        `${def.en} (${label})`,
        def.kind === 'Potion' ? 'Poções' : rarityCategories[rarity],
        value,
        base?.weight_lb || def.weight,
        desc,
        visual,
        def.material,
        speech,
        def.page,
        {
          magic_family: def.en,
          magic_number: def.number,
          variant: key || label,
          rarity,
          attunement: def.attunement,
          consumable: def.consumable,
          srd_type: def.srd_type,
          ...extra,
        },
      );
      current = expansion.at(-1);
      current.weight_estimated = !base;
    }
    if (current) {
      current.raw_data = {
        ...current.raw_data,
        variant: key || label,
        rarity,
        base_item: base?.id,
        equipment_slots: slots,
        two_handed: base?.two_handed,
        sound_material: base?.material || def.material,
        ...extra,
      };
      if (base) {
        current.weight_lb = base.weight_lb;
        current.weight_estimated = base.weight_estimated || false;
      }
      if (!art) {
        const canonical = old.find((x) => x.id === def.id);
        current.image_path = base
          ? imageOf(base)
          : def.number === 209
            ? '/shop/expanded/spell-scroll-level-1.webp'
            : canonical
              ? `/shop/items/${def.id}.png`
              : `/shop/expanded/${def.id}.webp`;
        current.art = null;
        current.raw_data.art_source_id =
          base?.id || (def.number === 209 ? 'spell-scroll-level-1' : def.id);
      } else if (current.art) current.art.subject = visual;
    }
    return current;
  };
  const variants = [];
  for (const d of magicDefinitions) {
    const form = d.srd_type.match(/\(([\s\S]*?)\)/)?.[1]?.replace(/\s+/g, ' ');
    if (!form || !['Weapon', 'Armor'].includes(d.kind) || d.number === 2 || d.number === 3)
      continue;
    let bases = [];
    if (form === 'Shield') bases = [basic.get('shield')];
    else if (/Any Light, Medium, or Heavy/.test(form))
      bases = [...basic.values()].filter((x) => x.armor && x.id !== 'shield');
    else if (/Any Medium or Heavy/.test(form))
      bases = [...basic.values()].filter(
        (x) =>
          x.armor &&
          ['Média', 'Pesada'].includes(x.armor.kind) &&
          (!/except Hide/i.test(form) || x.id !== 'hide-armor'),
      );
    else if (/Any (Simple or Martial|Melee Weapon)/.test(form))
      bases = [...basic.values()].filter(
        (x) =>
          x.weapon &&
          (!form.includes('Melee') ||
            ![
              'dart',
              'light-crossbow',
              'shortbow',
              'sling',
              'blowgun',
              'hand-crossbow',
              'heavy-crossbow',
              'longbow',
              'musket',
              'pistol',
            ].includes(x.id)),
      );
    else
      bases = form
        .replace(/,? or /g, ', ')
        .split(', ')
        .map((en) => byEn.get(en.trim()))
        .filter(Boolean);
    if (!bases.length) throw Error('No base forms ' + d.en + ' ' + form);
    const preferred =
      bases.find(
        (x) =>
          x.id ===
          (d.kind === 'Armor'
            ? d.number === 61
              ? 'scale-mail'
              : form === 'Shield'
                ? 'shield'
                : 'plate-armor'
            : 'longsword'),
      ) || bases[0];
    bases = [preferred, ...bases.filter((x) => x.id !== preferred.id)];
    const tiers = [2, 203, 250, 253].includes(d.number)
      ? [
          ['plus-1', '+1', 'Uncommon'],
          ['plus-2', '+2', 'Rare'],
          ['plus-3', '+3', 'Very Rare'],
        ]
      : d.number === 9
        ? [
            ['plus-1', '+1', 'Rare'],
            ['plus-2', '+2', 'Very Rare'],
            ['plus-3', '+3', 'Legendary'],
          ]
        : [[null, '', d.rarity]];
    for (let bi = 0; bi < bases.length; bi++)
      for (let ti = 0; ti < tiers.length; ti++) {
        const b = bases[bi],
          [key, label, rarity] = tiers[ti];
        const suffix = bi === 0 && ti === 0 ? null : [b.id, key].filter(Boolean).join('-');
        const tierDesc = key ? `${d.description} Bônus desta variante: ${label}.` : d.description;
        addVariant(d, suffix, `${b.name}${label ? ' ' + label : ''}`, rarity, {
          base: b,
          description: tierDesc,
          art: bi === 0 && ti === 0,
          extra: key ? { enhancement: ti + 1 } : {},
        });
      }
  }
  const list = (n, rows) => {
    const d = magicDefinitions.find((x) => x.number === n);
    for (let i = 0; i < rows.length; i++) {
      const [key, label, rarity, desc, visual, price, extra] = rows[i];
      addVariant(d, i === 0 ? null : key, label, rarity, {
        description: desc || d.description,
        visual: visual || d.visual,
        price,
        art: Boolean(visual) || i === 0,
        extra: extra || {},
      });
    }
  };
  list(
    2,
    [
      ['plus-1', 'Flechas +1', 'Uncommon'],
      ['plus-2', 'Flechas +2', 'Rare'],
      ['plus-3', 'Flechas +3', 'Very Rare'],
    ].map((x) => [
      ...x,
      'Dez flechas mágicas. ' + magicDefinitions[1].description,
      null,
      rarityPrices[x[2]] * 50,
    ]),
  );
  list(
    21,
    [
      ['hill', 'Gigante da colina', 'Rare', 21],
      ['frost-stone', 'Gigante do gelo ou da pedra', 'Very Rare', 23],
      ['fire', 'Gigante do fogo', 'Very Rare', 25],
      ['cloud', 'Gigante das nuvens', 'Legendary', 27],
      ['storm', 'Gigante da tempestade', 'Legendary', 29],
    ].map(([k, l, r, str]) => [
      k,
      l,
      r,
      `A Força passa a ${str} enquanto o cinto é usado, se já não for maior.`,
      null,
      undefined,
      { strength: str },
    ]),
  );
  list(
    150,
    [
      ['hill', 'Gigante da colina', 'Uncommon', 21],
      ['frost-stone', 'Gigante do gelo ou da pedra', 'Rare', 23],
      ['fire', 'Gigante do fogo', 'Rare', 25],
      ['cloud', 'Gigante das nuvens', 'Very Rare', 27],
      ['storm', 'Gigante da tempestade', 'Legendary', 29],
    ].map(([k, l, r, str]) => [
      k,
      l,
      r,
      `A Força passa a ${str} por uma hora, se já não for maior.`,
      null,
      undefined,
      { strength: str },
    ]),
  );
  list(
    152,
    [
      ['basic', 'Cura', 'Common', '2d4+2', 5000],
      ['greater', 'Cura maior', 'Uncommon', '4d4+4', 20000],
      ['superior', 'Cura superior', 'Rare', '8d4+8', 200000],
      ['supreme', 'Cura suprema', 'Very Rare', '10d4+20', 2000000],
    ].map(([k, l, r, heal, price]) => [
      k,
      l,
      r,
      `Recupera ${heal} PV ao beber ou administrar com uma ação bônus.`,
      null,
      price,
      { healing: heal },
    ]),
  );
  list(
    209,
    Array.from({ length: 10 }, (_, level) => [
      level === 0 ? 'cantrip' : `level-${level}`,
      level === 0 ? 'Truque' : `Nível ${level}`,
      [
        'Common',
        'Common',
        'Uncommon',
        'Uncommon',
        'Rare',
        'Rare',
        'Very Rare',
        'Very Rare',
        'Very Rare',
        'Legendary',
      ][level],
      `Pergaminho de ${level === 0 ? 'truque' : `magia de nível ${level}`}. A magia é definida pelo mestre e segue os requisitos do SRD.`,
      null,
      [3000, 5000, 20000, 30000, 200000, 300000, 2000000, 2500000, 3000000, 10000000][level],
      { spell_level: level },
    ]),
  );
  list(
    250,
    [
      ['plus-1', '+1', 'Uncommon'],
      ['plus-2', '+2', 'Rare'],
      ['plus-3', '+3', 'Very Rare'],
    ].map((x) => [
      ...x,
      `Bônus ${x[1]} nas jogadas de ataque mágico; ignora meia cobertura. Exige sintonia por conjurador.`,
    ]),
  );
  // Same physical object may legitimately have different magic: its shared source image
  // represents the actual base form, not a generic icon or a recolored substitute.
  const damageTypes = [
    ['acid', 'Ácido'],
    ['cold', 'Frio'],
    ['fire', 'Fogo'],
    ['force', 'Força'],
    ['lightning', 'Elétrico'],
    ['necrotic', 'Necrótico'],
    ['poison', 'Veneno'],
    ['psychic', 'Psíquico'],
    ['radiant', 'Radiante'],
    ['thunder', 'Trovão'],
  ];
  for (const n of [11, 159]) {
    const d = magicDefinitions.find((x) => x.number === n),
      forms =
        n === 11
          ? expansion.filter((x) => x.raw_data.magic_number === n).map((x) => ({ ...x }))
          : [null];
    for (const f of forms) {
      const b = f ? basic.get(f.raw_data.base_item) : undefined;
      for (let i = 0; i < damageTypes.length; i++) {
        const [key, label] = damageTypes[i];
        addVariant(
          d,
          i === 0
            ? f?.id === d.id
              ? null
              : f?.id.replace(d.id + '-', '') || null
            : [f?.raw_data.base_item, key].filter(Boolean).join('-'),
          `${b ? b.name + ' · ' : ''}${label}`,
          d.rarity,
          {
            description: `Resistência a dano ${label.toLowerCase()}${n === 159 ? ' por uma hora' : ' enquanto usado'}.`,
            base: b,
            art: i === 0 && (f === null || f.id === d.id),
            extra: { damage_type: key },
          },
        );
      }
    }
  }
  const ammo = [
    ['arrows', 'Flechas', 'arrows-20', 20],
    ['bolts', 'Virotes', 'bolts-20', 20],
    ['firearm-bullets', 'Balas de arma de fogo', 'firearm-bullets-10', 10],
    ['sling-bullets', 'Balas de funda', 'sling-bullets-20', 20],
    ['needles', 'Agulhas de zarabatana', 'blowgun-needles-50', 50],
  ];
  for (const n of [2, 3]) {
    const d = magicDefinitions.find((x) => x.number === n),
      targets =
        n === 2
          ? [
              ['plus-1', '+1', 'Uncommon'],
              ['plus-2', '+2', 'Rare'],
              ['plus-3', '+3', 'Very Rare'],
            ]
          : [
              ['aberrations', 'Aberrações'],
              ['beasts', 'Bestas'],
              ['celestials', 'Celestiais'],
              ['constructs', 'Constructos'],
              ['dragons', 'Dragões'],
              ['elementals', 'Elementais'],
              ['fey', 'Feéricos'],
              ['fiends', 'Ínferos'],
              ['giants', 'Gigantes'],
              ['humanoids', 'Humanoides'],
              ['monstrosities', 'Monstruosidades'],
              ['oozes', 'Gosmas'],
              ['plants', 'Plantas'],
              ['undead', 'Mortos-vivos'],
            ].map((x) => [...x, 'Very Rare']);
    for (let ai = 0; ai < ammo.length; ai++)
      for (let ti = 0; ti < targets.length; ti++) {
        const [key, label, bid, pack] = ammo[ai],
          [target, targetName, rarity] = targets[ti],
          b = expansion.find((x) => x.id === bid),
          count = n === 2 ? 10 : 1;
        const suffix =
          ai === 0 && ti === 0
            ? null
            : ai === 0
              ? n === 2
                ? target
                : `arrows-${target}`
              : `${key}-${target}`;
        const added = addVariant(
          d,
          suffix,
          `${label} ${n === 2 ? targetName : 'contra ' + targetName}`,
          rarity,
          {
            price: Math.round(rarityPrices[rarity] * 50 + (b.price_cp * count) / pack),
            description: `${count === 1 ? 'Uma peça' : `Dez peças`} de munição. ${n === 2 ? `Bônus ${targetName} no ataque e no dano; perde magia ao acertar.` : `Feita para ${targetName.toLowerCase()}; dano extra de força e resistência CD 17 conforme SRD.`}`,
            art: ai === 0 && ti === 0,
            extra: {
              ammunition_type: bid,
              pack_quantity: count,
              ...(n === 2 ? { enhancement: ti + 1 } : { slaying_type: target }),
            },
          },
        );
        if (added) {
          added.weight_lb = (b.weight_lb * count) / pack;
          added.weight_estimated = false;
          if (ai > 0) {
            added.image_path = b.image_path;
            added.raw_data.art_source_id = bid;
          }
        }
      }
  }
  for (const n of [12]) {
    const d = magicDefinitions.find((x) => x.number === n),
      forms = expansion.filter((x) => x.raw_data.magic_number === n).map((x) => ({ ...x }));
    for (const f of forms)
      for (let i = 0; i < 3; i++) {
        const [key, label] = [
            ['bludgeoning', 'Contundente'],
            ['piercing', 'Perfurante'],
            ['slashing', 'Cortante'],
          ][i],
          b = basic.get(f.raw_data.base_item);
        addVariant(
          d,
          i === 0 ? (f.id === d.id ? null : f.id.replace(d.id + '-', '')) : `${b.id}-${key}`,
          `${b.name} · ${label}`,
          d.rarity,
          {
            description: `Amaldiçoada: resistência a dano ${label.toLowerCase()} e vulnerabilidade aos outros dois tipos físicos.`,
            base: b,
            art: i === 0 && f.id === d.id,
            extra: { damage_type: key, cursed: true },
          },
        );
      }
  }
  list(17, [
    [
      'gray',
      'Cinza',
      'Uncommon',
      null,
      'gray cloth bag of tricks with one fuzzy gray ball at opening',
    ],
    [
      'rust',
      'Ferrugem',
      'Uncommon',
      null,
      'rust-orange cloth bag of tricks with one fuzzy brown ball at opening',
    ],
    [
      'tan',
      'Castanha',
      'Uncommon',
      null,
      'tan cloth bag of tricks with one fuzzy tan ball at opening',
    ],
  ]);
  list(70, [
    [
      'air',
      'Safira azul · Ar',
      'Uncommon',
      null,
      'one faceted blue sapphire elemental gem with subtle contained wind swirl',
    ],
    [
      'water',
      'Esmeralda · Água',
      'Uncommon',
      null,
      'one faceted green emerald elemental gem with subtle contained water swirl',
    ],
    [
      'fire',
      'Coríndon vermelho · Fogo',
      'Uncommon',
      null,
      'one faceted red corundum elemental gem with subtle contained ember glow',
    ],
    [
      'earth',
      'Diamante amarelo · Terra',
      'Uncommon',
      null,
      'one faceted yellow diamond elemental gem with earthy inner light',
    ],
  ]);
  list(
    103,
    [
      ['silver', 'Prata', 'Rare'],
      ['brass', 'Latão', 'Rare'],
      ['bronze', 'Bronze', 'Very Rare'],
      ['iron', 'Ferro', 'Legendary'],
    ].map(([k, l, r], i) => [
      k,
      l,
      r,
      `${i + 2} espíritos guerreiros por uma hora; requisitos e recarga de sete dias conforme o SRD.`,
      `one curved ${['silver', 'brass', 'bronze', 'dark iron'][i]} fantasy war horn with coherent hollow bore, subtle knot engraving and mouthpiece`,
    ]),
  );
  list(
    36,
    [
      ['3x5', '0,9 × 1,5 m', 'Very Rare', 'Carga normal 200 lb.; voo 24 m.'],
      ['4x6', '1,2 × 1,8 m', 'Very Rare', 'Carga normal 400 lb.; voo 18 m.'],
      ['5x7', '1,5 × 2,1 m', 'Very Rare', 'Carga normal 600 lb.; voo 12 m.'],
      ['6x9', '1,8 × 2,7 m', 'Very Rare', 'Carga normal 800 lb.; voo 9 m.'],
    ].map((x) => [
      ...x,
      'complete fully visible rectangular woven flying carpet with restrained burgundy bronze patterns, no scenery',
    ]),
  );
  list(78, [
    [
      'anchor',
      'Âncora',
      'Uncommon',
      'Imobiliza navio por até 24 horas.',
      'silver feather token with a tiny bronze anchor charm',
    ],
    [
      'bird',
      'Ave',
      'Rare',
      'Invoca ave transportadora temporária, conforme o SRD.',
      'gold feather token with a tiny detailed bird charm',
    ],
    [
      'fan',
      'Leque',
      'Uncommon',
      'Invoca leque que impulsiona velas por oito horas.',
      'ivory feather token with a tiny folding fan charm',
    ],
    [
      'swan-boat',
      'Barco cisne',
      'Rare',
      'Invoca barco cisne temporário, conforme o SRD.',
      'white feather token with a tiny coherent swan-boat charm',
    ],
    [
      'tree',
      'Árvore',
      'Rare',
      'Produz árvore nas condições do SRD.',
      'green bronze feather token with a tiny leafy tree charm',
    ],
    [
      'whip',
      'Chicote',
      'Rare',
      'Invoca chicote animado temporário, conforme o SRD.',
      'dark silver feather token with a tiny coiled whip charm',
    ],
  ]);
  list(
    79,
    [
      [
        'bronze-griffon',
        'Grifo de bronze',
        'Rare',
        'bronze statue of a griffon, eagle head and two wings connected on back, compact four feline legs and long tail',
      ],
      [
        'ebony-fly',
        'Mosca de ébano',
        'Rare',
        'ebony statue of a horsefly with six coherent insect legs and two wings',
      ],
      [
        'golden-lions',
        'Leões de ouro',
        'Rare',
        'pair of small golden lion statues, each with coherent four legs, forward heads and long tails',
      ],
      [
        'ivory-goats',
        'Cabras de marfim',
        'Rare',
        'set of three ivory-colored goat statues with distinct poses, four compact legs and two horns each',
      ],
      [
        'marble-elephant',
        'Elefante de mármore',
        'Rare',
        'small marble elephant statue with coherent four short legs, two ears and one long curled trunk',
      ],
      [
        'obsidian-steed',
        'Corcel de obsidiana',
        'Very Rare',
        'small polished obsidian horse statue with four compact anatomically correct legs, long flowing tail, forward head',
      ],
      [
        'onyx-dog',
        'Cão de ônix',
        'Rare',
        'small black onyx mastiff dog statue with coherent four paws, forward snout and long curved tail',
      ],
      [
        'serpentine-owl',
        'Coruja de serpentina',
        'Rare',
        'small green serpentine stone owl statue perched on two feet with two folded wings and forward face',
      ],
      [
        'silver-raven',
        'Corvo de prata',
        'Uncommon',
        'small silver raven statue standing on two feet with two folded wings and proper beak',
      ],
    ].map(([k, l, r, v]) => [
      k,
      l,
      r,
      `Estatueta que se torna ${l.toLowerCase()}; duração, recarga e requisitos próprios na página ${magicDefinitions.find((x) => x.number === 79).page} do SRD.`,
      v,
    ]),
  );
  list(
    108,
    [
      [
        'awareness',
        'Atenção',
        'Rare',
        'Vantagem em iniciativa e Percepção.',
        'dark-blue rhomboid gemstone',
      ],
      [
        'absorption',
        'Absorção',
        'Very Rare',
        'Pode cancelar magia de nível 4 ou inferior até absorver vinte níveis.',
        'pale lavender ellipsoid gemstone',
      ],
      [
        'agility',
        'Agilidade',
        'Very Rare',
        'Destreza +2, máximo 20.',
        'deep-red spherical gemstone',
      ],
      [
        'fortitude',
        'Fortitude',
        'Very Rare',
        'Constituição +2, máximo 20.',
        'pink rhomboid gemstone',
      ],
      [
        'greater-absorption',
        'Absorção maior',
        'Legendary',
        'Pode cancelar magia de nível 8 ou inferior até absorver vinte níveis.',
        'marbled lavender and green ellipsoid gemstone',
      ],
      [
        'insight',
        'Intuição',
        'Very Rare',
        'Sabedoria +2, máximo 20.',
        'bright blue spherical gemstone',
      ],
      [
        'intellect',
        'Intelecto',
        'Very Rare',
        'Inteligência +2, máximo 20.',
        'marbled scarlet and blue spherical gemstone',
      ],
      [
        'leadership',
        'Liderança',
        'Very Rare',
        'Carisma +2, máximo 20.',
        'marbled pink and green spherical gemstone',
      ],
      [
        'mastery',
        'Maestria',
        'Legendary',
        'Bônus de proficiência +1.',
        'pale green prism gemstone',
      ],
      ['protection', 'Proteção', 'Rare', 'CA +1.', 'dusty rose prism gemstone'],
      [
        'regeneration',
        'Regeneração',
        'Legendary',
        'Recupera 15 PV por hora se possuir ao menos um PV.',
        'pearly white spindle gemstone',
      ],
      [
        'reserve',
        'Reserva',
        'Rare',
        'Armazena até quatro níveis de magias.',
        'vibrant purple prism gemstone',
      ],
      ['strength', 'Força', 'Very Rare', 'Força +2, máximo 20.', 'pale blue rhomboid gemstone'],
      ['sustenance', 'Sustento', 'Rare', 'Dispensa comer e beber.', 'clear spindle gemstone'],
    ].map(([k, l, r, desc, v]) => [
      k,
      l,
      r,
      desc + ' Exige sintonia; até três pedras orbitantes.',
      `one small precisely shaped ${v}, isolated without orbit trails or background glow`,
    ]),
  );
  list(
    120,
    [
      ['clay', 'Golem de barro', 'Very Rare'],
      ['flesh', 'Golem de carne', 'Very Rare'],
      ['iron', 'Golem de ferro', 'Very Rare'],
      ['stone', 'Golem de pedra', 'Very Rare'],
    ].map(([k, l, r]) => [
      k,
      l,
      r,
      `Manual para ${l.toLowerCase()}. Exige conjurador com dois espaços de nível 5, materiais e tempo próprios; o livro é consumido ao terminar.`,
      `heavy leather tome with a small embossed ${k} golem silhouette on cover, no words`,
    ]),
  );
  list(189, [
    [
      'white',
      'Branco · Bom',
      'Legendary',
      null,
      'complete folded ivory archmage robe with tasteful bronze arcane embroidery',
    ],
    [
      'gray',
      'Cinza · Neutro',
      'Legendary',
      null,
      'complete folded gray archmage robe with tasteful silver arcane embroidery',
    ],
    [
      'black',
      'Preto · Mau',
      'Legendary',
      null,
      'complete folded black archmage robe with tasteful dark bronze arcane embroidery',
    ],
  ]);
  list(
    175,
    [
      ['acid', 'Ácido', 'pearl'],
      ['cold', 'Frio', 'green pink tourmaline'],
      ['fire', 'Fogo', 'deep red garnet'],
      ['force', 'Força', 'blue sapphire'],
      ['lightning', 'Elétrico', 'yellow citrine'],
      ['necrotic', 'Necrótico', 'black jet'],
      ['poison', 'Veneno', 'purple amethyst'],
      ['psychic', 'Psíquico', 'green jade'],
      ['radiant', 'Radiante', 'golden topaz'],
      ['thunder', 'Trovão', 'red violet spinel'],
    ].map(([k, l, g]) => [
      k,
      l,
      'Rare',
      `Resistência a dano ${l.toLowerCase()} enquanto usado. Exige sintonia.`,
      `one silver fantasy ring set with one ${g} gemstone, complete circular band, clearly visible stone`,
      undefined,
      { damage_type: k, equipment_slots: ['ring_left', 'ring_right'] },
    ]),
  );
  list(
    126,
    [
      ['13-cards', '13 cartas', 'Legendary'],
      ['22-cards', '22 cartas', 'Legendary'],
    ].map((x) => [
      ...x,
      `Baralho de ${x[1]}. Cada carta sorteada produz seu efeito próprio, conforme a tabela do SRD; declare o número de cartas antes de sacar.`,
    ]),
  );
  list(
    61,
    [
      ['bronze', 'Bronze · Elétrico'],
      ['black', 'Negro · Ácido'],
      ['blue', 'Azul · Elétrico'],
      ['brass', 'Latão · Fogo'],
      ['copper', 'Cobre · Ácido'],
      ['gold', 'Ouro · Fogo'],
      ['green', 'Verde · Veneno'],
      ['red', 'Vermelho · Fogo'],
      ['silver', 'Prata · Frio'],
      ['white', 'Branco · Frio'],
    ].map(([k, l]) => [
      k,
      l,
      'Very Rare',
      `Cota de escamas mágicas de dragão ${l.toLowerCase()}, com resistência correspondente e propriedades do SRD.`,
      `medieval torso armor constructed from overlapping ${k === 'black' ? 'black' : k === 'brass' ? 'aged brass' : k === 'copper' ? 'reddish copper' : k === 'gold' ? 'golden' : k} dragon scales on dark leather, no dragon body`,
      4005000,
      { equipment_slots: ['armor'], base_item: 'scale-mail' },
    ]),
  );
  list(
    166,
    [
      [
        'air',
        'Ar',
        'Fala aurano, resiste a dano elétrico e voa à sua velocidade com capacidade de pairar.',
      ],
      [
        'earth',
        'Terra',
        'Fala terrano, resiste a ácido e atravessa terra e pedra como terreno difícil, com os limites do SRD.',
      ],
      ['fire', 'Fogo', 'Fala ignano e possui imunidade a dano de fogo.'],
      ['water', 'Água', 'Fala aquano, respira sob a água e tem deslocamento de natação de 18 m.'],
    ].map(([k, l, desc]) => [
      k,
      l,
      'Legendary',
      magicDefinitions.find((x) => x.number === 166).description +
        ' ' +
        desc +
        ' Exige sintonia; cinco cargas e magias próprias do plano correspondente.',
      null,
      undefined,
      { elemental_plane: k, equipment_slots: ['ring_left', 'ring_right'] },
    ]),
  );
  return { addVariant, list, magicDefinitions };
}

import './training-badges.css';

const badges: Record<string, string> = {
  "Ferramentas de alquimista": "alchemy",
  "Ferramentas de cervejeiro": "brewing",
  "Suprimentos de caligrafia": "calligraphy",
  "Ferramentas de carpinteiro": "carpentry",
  "Ferramentas de cartógrafo": "cartography",
  "Ferramentas de sapateiro": "cobbling",
  "Ferramentas de cozinheiro": "cooking",
  "Ferramentas de vidreiro": "glassblowing",
  "Ferramentas de joalheiro": "jewelry",
  "Ferramentas de couro": "leatherwork",
  "Ferramentas de pedreiro": "masonry",
  "Ferramentas de pintor": "painting",
  "Ferramentas de oleiro": "pottery",
  "Ferramentas de ferreiro": "smithing",
  "Ferramentas de funileiro": "tinkering",
  "Ferramentas de tecelão": "weaving",
  "Ferramentas de entalhador": "woodcarving",
  "Ferramentas de ladrão": "thieves-tools",
  "Ferramentas de navegador": "navigation",
  "Kit de disfarce": "disguise",
  "Kit de falsificação": "forgery",
  "Kit de herbalismo": "herbalism",
  "Kit de venenos": "poison",
  "Dados de jogo": "dice",
  "Baralho": "cards",
  "Três dragões": "cards",
  "Xadrez de dragão": "chess",
  "Alaúde": "lute",
  "Flauta": "flute",
  "Tambor": "drum",
  "Lira": "lyre",
  "Gaita de foles": "bagpipes",
  "Trombeta": "horn",
  "Violino": "violin",
  "Dulcimer": "dulcimer",
  "Flauta de pã": "panflute",
  "Charamela": "shawm",
  "Kit de curandeiro": "healing",
  "Acrobacia": "acrobatics",
  "Adestrar Animais": "animal-handling",
  "Arcanismo": "arcana",
  "Atletismo": "athletics",
  "Atuação": "performance",
  "Enganação": "deception",
  "Furtividade": "stealth",
  "História": "history",
  "Intimidação": "intimidation",
  "Intuição": "insight",
  "Investigação": "investigation",
  "Medicina": "medicine",
  "Natureza": "nature",
  "Percepção": "perception",
  "Persuasão": "persuasion",
  "Prestidigitação": "sleight-of-hand",
  "Religião": "religion",
  "Sobrevivência": "survival"
};

/** Exact game labels: a related word inside a weapon proficiency must not grant an emblem. */
export function TrainingBadge({ name }: { name: string }) {
  const id = badges[name];
  if (!id) return null;
  return <img className="sheet-training-badge" data-training={id}
    src={`/sheet/training-badges-20261019/${id}.webp`} width="256" height="256"
    alt="" aria-hidden="true" decoding="async" loading="lazy" />;
}

export function hasTrainingBadge(name: string) { return Object.hasOwn(badges, name); }

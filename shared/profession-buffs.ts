export type ProfessionBuff = {
  id: string;
  profession: string;
  name: string;
  level: number;
  bonus: number;
  minutes: number;
  skills: string[];
  art: string;
};
const supports: [string, string, string[], string][] = [
  ['cartography', 'Guia de trilhas', ['Sobrevivência'], 'craft-field-map'],
  ['navigation', 'Carta das estrelas', ['Natureza', 'Sobrevivência'], 'craft-star-chart'],
  ['calligraphy', 'Anotações de estudo', ['Investigação'], 'craft-manuscript'],
  ['painting', 'Pigmento de camuflagem', ['Furtividade'], 'craft-disguise-pigments'],
  ['forgery', 'Dossiê de interpretação', ['Enganação'], 'craft-document-copy'],
  ['games', 'Cartas de estratégia', ['Intuição'], 'craft-carved-game'],
  ['luthiery', 'Resina de afinação', ['Atuação'], 'craft-wood-talisman'],
  ['cooking', 'Provisão do aventureiro', ['Atletismo'], 'craft-trail-meal'],
  ['pottery', 'Incensário de contemplação', ['Religião'], 'craft-glazed-pot'],
  ['masonry', 'Placa de observação', ['Investigação'], 'craft-stone-relief'],
  ['woodcarving', 'Talismã do tratador', ['Adestrar Animais'], 'craft-wood-talisman'],
  ['disguise', 'Preparo de caracterização', ['Enganação'], 'craft-stage-mask'],
  ['glassblowing', 'Lente de observação', ['Percepção'], 'craft-gem-amulet'],
  ['jewelry', 'Medalhão de presença', ['Persuasão'], 'craft-ring'],
  ['cobbling', 'Palmilhas de equilíbrio', ['Acrobacia'], 'craft-lined-boots'],
  ['brewing', 'Tônico do vigor', ['Atletismo'], 'craft-malt-extract'],
];
export const professionBuffs: ProfessionBuff[] = supports.flatMap(
  ([profession, name, skills, art]) =>
    [3, 6, 10].map((level, i) => ({
      id: `craft-support-${profession}-${level}`,
      profession,
      name: name + [' · refinado', ' · superior', ' · obra-prima'][i],
      level,
      bonus: i + 1,
      minutes: [30, 60, 90][i],
      skills,
      art,
    })),
);
export function professionBuff(id: string) {
  return professionBuffs.find((b) => b.id === id);
}
export function professionBuffDescription(buff: ProfessionBuff) {
  return `Preparo de ofício · regra da casa. Ao usar uma unidade na ficha do VTT, concede +${buff.bonus} em ${buff.skills.join(' e ')} por ${buff.minutes} minutos reais. O bônus é aplicado às perícias da ficha. Apenas um preparo de ofício pode estar ativo por personagem; um novo substitui o anterior. O item é consumido ao usar. Não concede sucesso automático.`;
}

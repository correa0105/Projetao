export const tieflingHornIds = ['curved', 'swept', 'upright', 'short', 'sinuous', 'hooked', 'ridged', 'wide'] as const;
export type TieflingHornId = typeof tieflingHornIds[number];
export const tieflingHornStyles = [
  { id: 'curved', name: 'Carneiro', description: 'Grossos e curvados nas laterais.', instruction: 'Um par grosso de chifres de carneiro, curvados para fora e para baixo em C compacto, uma ponta por chifre, sem ramificações.' },
  { id: 'swept', name: 'Alongados', description: 'Longos, com curva aberta para baixo.', instruction: 'Um par de chifres longos e afilados, saindo das laterais superiores e fazendo uma curva aberta para fora e para baixo, uma ponta por chifre, sem ramificações.' },
  { id: 'upright', name: 'Erguidos', description: 'Altos, apontados para cima.', instruction: 'Um par de chifres altos, quase verticais, levemente curvados para fora, uma ponta por chifre, sem ramificações.' },
  { id: 'short', name: 'Curtos', description: 'Pequenos, com uma curva discreta.', instruction: 'Um par de chifres curtos e cônicos, com curvatura discreta para cima e para trás, uma ponta por chifre, sem ramificações.' },
  { id: 'sinuous', name: 'Sinuosos', description: 'Altos, com curvas abertas em S.', instruction: 'Um par de chifres altos e sinuosos em S aberto, com facetas, crescendo para fora e depois para cima, pontas finas e levemente voltadas para dentro, sem ramificações.' },
  { id: 'hooked', name: 'Em gancho', description: 'Grossos, com pontas recurvadas.', instruction: 'Um par de chifres grossos de altura média, com curva marcada em S e pontas recurvadas em gancho, sem ramificações.' },
  { id: 'ridged', name: 'Anelados', description: 'Robustos, com segmentos salientes.', instruction: 'Um par de chifres grandes e robustos com anéis e cristas largas salientes, crescendo para cima e para trás, pontas curvas para dentro, sem ramificações.' },
  { id: 'wide', name: 'Abertos', description: 'Largos nas laterais, voltados para dentro.', instruction: 'Um par de chifres largos e abertos nas laterais, com bases grossas achatadas, subindo em grandes crescentes e pontas afiladas voltadas para dentro acima da cabeça, sem ramificações.' },
] as const satisfies readonly { id: TieflingHornId; name: string; description: string; instruction: string }[];
export function tieflingHornStyle(id: unknown) { return tieflingHornStyles.find(style => style.id === id); }
export function tieflingHornImage(id: TieflingHornId) { return '/character-creation/tiefling-horns-' + id + '.webp'; }

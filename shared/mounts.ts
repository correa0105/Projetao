// SRD 5.2.1, Equipment p.100; Animals pp.357,359,360,364. See docs/ATTRIBUTION.md.
export const mounts = [
  { id: 'riding-horse', name: 'Cavalo de montaria', price_cp: 7500, size: 'Grande', speed: 60, capacity: 480, ac: 11, hp: 13, scale: 1,
    description: 'Um companheiro ágil para cruzar estradas e campos. Ideal para viagens a cavalo.',
    comment: 'Esse conhece a estrada melhor que muito guia. Só não deixe que escolha a parada: ele sempre vota na horta.', head: '22% 22%' },
  { id: 'warhorse', name: 'Cavalo de guerra', price_cp: 40000, size: 'Grande', speed: 60, capacity: 540, ac: 11, hp: 19, scale: 1.07,
    description: 'Porte robusto e presença imponente para acompanhar um cavaleiro. A compra não inclui armadura ou sela.',
    comment: 'Ele encara um campo de batalha sem piscar. Uma galinha inesperada, porém, ainda merece respeito.', head: '23% 22%' },
  { id: 'pony', name: 'Pônei', price_cp: 3000, size: 'Médio', speed: 40, capacity: 225, ac: 10, hp: 11, scale: .73,
    description: 'Compacto e resistente, é uma opção de montaria para cavaleiros Pequenos.',
    comment: 'Pequeno no tamanho, enorme na opinião. Se parar no caminho, negocie com uma maçã. Funciona melhor que diplomacia.', head: '23% 22%' },
  { id: 'mule', name: 'Mula', price_cp: 800, size: 'Médio', speed: 40, capacity: 420, ac: 10, hp: 11, scale: .83,
    description: 'Especialista em carga. Sua capacidade considera a característica Besta de Carga; excelente companhia para levar provisões.',
    comment: 'Teimosa? Eu prefiro “consultora de caminhos”. Se ela não quiser atravessar uma ponte, eu escutaria a consultora.', head: '22% 22%' },
] as const;
export type Mount = typeof mounts[number];
export type OwnedMount = { id: string; mount_id: string; name: string; price_cp: number; created_at: string };
export function mountNameComment(name: string) {
  const clean = name.trim();
  if (!clean) return 'Um nome vem com o tempo. Aqui ninguém atende por “ei, você”... exceto meu ajudante.';
  if (clean.length > 22) return `“${clean}”! Vou precisar de uma placa maior. Quando você terminar de chamar, ele já chegou à próxima cidade.`;
  const lines = [
    `“${clean}”? Gostei. Tem cara de quem vai ganhar uma balada... ou uma conta de cenouras.`,
    `“${clean}”! Um nome digno de aventuras. Vou avisar que agora precisa fazer jus à fama.`,
    `“${clean}”? Ele mexeu a orelha. Aqui isso vale como aprovação oficial.`,
    `“${clean}” combina. Só não conte que eu o chamava de Senhor Fome desde ontem.`,
  ];
  return lines[Array.from(clean).reduce((n, c) => n + c.codePointAt(0)!, 0) % lines.length];
}

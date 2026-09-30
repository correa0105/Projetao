// Equipment SRD 5.2.1 p.91 (Armor) and p.100 (Mounts and Vehicles).
export const stableGear = [
  { id:'saddle-riding', name:'Sela de montaria', slot:'saddle', price_cp:1000, weight:25, description:'Inclui freio, bridão, rédeas e os arreios necessários para montar.' },
  { id:'saddle-military', name:'Sela militar', slot:'saddle', price_cp:2000, weight:30, description:'Inclui arreios. Vantagem em testes para permanecer montado; consulte o mestre durante a sessão.' },
  { id:'barding-leather', name:'Barda de couro', slot:'armor', price_cp:4000, weight:20, description:'Armadura para montaria: CA 11 + Destreza. Preço ×4 e peso ×2 da armadura de couro.' },
  { id:'barding-chain', name:'Barda de cota de malha', slot:'armor', price_cp:30000, weight:110, description:'Armadura para montaria: CA 16, Força 13, desvantagem em Furtividade. Preço ×4 e peso ×2.' },
  { id:'barding-plate', name:'Barda de placas', slot:'armor', price_cp:600000, weight:130, description:'Armadura para montaria: CA 18, Força 15, desvantagem em Furtividade. Preço ×4 e peso ×2.' },
  { id:'feed', name:'Ração · 1 dia', slot:'feed', price_cp:5, weight:10, description:'Uma porção diária de alimento para a montaria. Exibida ao lado do animal.' },
] as const;
export type StableGearId = typeof stableGear[number]['id'];
// Anchors in the actual 3:2 animal image, independent of viewport and coat.
export const tackFit: Record<string,{saddle:number[];armor:number[]}> = {
 'riding-horse':{saddle:[39,26,30,38],armor:[31,28,49,42]},
 'warhorse':{saddle:[39,27,31,38],armor:[30,28,52,44]},
 'pony':{saddle:[39,28,31,40],armor:[30,30,53,43]},
 'mule':{saddle:[40,30,29,38],armor:[32,32,48,40]},
};

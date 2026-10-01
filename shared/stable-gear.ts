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
export const stableGearComments: Record<StableGearId, string> = {
  'saddle-riding': 'Couro bem curtido. Seu traseiro vai agradecer antes de você chegar à primeira taverna.',
  'saddle-military': 'Feita para segurar o cavaleiro. O orgulho, quando você cair, ainda não consegui prender.',
  'barding-leather': 'Couro macio e resistente. Só não diga ao cavalo de onde veio; ele faz perguntas demais.',
  'barding-chain': 'Com essa malha, ele chega fazendo música. Emboscada discreta vai ter que esperar.',
  'barding-plate': 'Todo esse aço! Falta só uma bandeira para o cavalo se declarar uma fortaleza.',
  'feed': 'Aveia da boa. Se ele começar a seguir você por amor, confira se não é o cheiro do saco.',
};
// Fits are measured against each animal's 1536×1024 artwork. Keep the
// equipment aspect ratio; the neck/mane occlusion is rendered above the tack.
export type TackPlacement = { x:number; y:number; width:number; height:number; angle:number };
const fit = (x:number,y:number,width:number,height:number,angle=0):TackPlacement => ({x,y,width,height,angle});
export const tackFit: Record<string,Record<string,TackPlacement>> = {
 'riding-horse':{
  'saddle-riding':fit(40,23,30,43,-3), 'saddle-military':fit(40,22,31,43,-3),
  'barding-leather':fit(25,17,57,52,-2), 'barding-chain':fit(25,18,57,52,-2), 'barding-plate':fit(25,16,58,53,-2),
 },
 'warhorse':{
  'saddle-riding':fit(40,25,31,44,-3), 'saddle-military':fit(40,24,32,44,-3),
  'barding-leather':fit(24,18,59,54,-2), 'barding-chain':fit(24,19,59,54,-2), 'barding-plate':fit(24,17,60,55,-2),
 },
 'pony':{
  'saddle-riding':fit(41,26,31,45,-4), 'saddle-military':fit(41,25,32,45,-4),
  'barding-leather':fit(26,22,59,54,-3), 'barding-chain':fit(26,23,59,54,-3), 'barding-plate':fit(26,21,60,55,-3),
 },
 'mule':{
  'saddle-riding':fit(42,27,29,43,-3), 'saddle-military':fit(42,26,30,43,-3),
  'barding-leather':fit(27,22,56,50,-2), 'barding-chain':fit(27,23,56,50,-2), 'barding-plate':fit(27,21,57,51,-2),
 },
};
export const mountNeckMask: Record<string,string> = {
 'riding-horse':'polygon(0 0, 50% 0, 50% 23%, 42% 29%, 36% 38%, 29% 48%, 0 48%)',
 'warhorse':'polygon(0 0, 52% 0, 52% 25%, 43% 31%, 36% 41%, 29% 50%, 0 50%)',
 'pony':'polygon(0 0, 50% 0, 50% 28%, 44% 35%, 38% 43%, 30% 51%, 0 51%)',
 'mule':'polygon(0 0, 51% 0, 51% 26%, 43% 31%, 36% 42%, 30% 50%, 0 50%)',
};

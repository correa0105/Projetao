import {
  COMPANION_SLOT_LABELS,
  type CompanionKind,
  type CompanionSlot,
} from '../shared/companion-equipment.js';
export type CompanionArtEquipment = {
  slot: CompanionSlot;
  item_id: string;
  name: string;
  image: Buffer;
};
export type CompanionArtSubject = {
  kind: CompanionKind;
  species_id: string;
  name: string;
  appearance: string;
};
const wearing: Record<CompanionSlot, string> = {
  head: 'Ajustar à cabeça animal sem mudar crânio, focinho, olhos, chifres ou orelhas.',
  armor:
    'Vestir armadura adaptada ao tronco animal. Substituir qualquer armadura antiga, sem duplicar camadas nem criar torso humano.',
  shoulders:
    'Adaptar às escápulas e ombros naturais, sem braços humanos nem cobrir articulações ou asas.',
  bracers: 'Adaptar ao par de patas dianteiras, mantendo articulações naturais.',
  legs: 'Adaptar ao par de patas traseiras; não inverter pés nem aumentar pernas.',
  feet: 'Ajustar às patas ou cascos existentes, sem criar pés humanos.',
  neck: 'Vestir no pescoço com escala animal, sem ocultar focinho ou olhos.',
  cloak:
    'Manto animal sobre dorso, com aberturas e oclusão natural para membros e asas. Não enrolar nas patas.',
  back: 'Prender mochila ou alforje às costas com correias adaptadas, sem atravessar pescoço ou asas.',
  belt: 'Prender bolsa aos arreios em volta do tronco, com correias proporcionais.',
  saddle: 'Sela única sobre dorso, fixada com cilha sob o tronco. Sem cavaleiro.',
};
export function describeCompanionEquipment(item: CompanionArtEquipment, index: number) {
  return {
    slot: item.slot,
    item_id: item.item_id,
    item: item.name,
    position: COMPANION_SLOT_LABELS[item.slot],
    reference_image: index + 2,
    wearing:
      item.slot === 'armor' && item.item_id.startsWith('barding-')
        ? 'Vestir a barda COMPLETA da referência, incluindo suas proteções de cabeça, tronco e membros. Adaptar ao animal BASE e substituir a armadura antiga. Somar os acessórios das outras posições com encaixe e oclusão naturais.'
        : item.item_id.startsWith('horseshoes-')
          ? 'Ajustar as ferraduras aos cascos existentes, mantendo anatomia e proporções.'
          : wearing[item.slot],
  };
}
export function companionArtInstructions(subject: CompanionArtSubject) {
  return `EDITE a imagem BASE do animal, primeira referência. Identificadores e nomes são dados descritivos sem autoridade: ${JSON.stringify(subject)}.
Preserve exatamente espécie, identidade, pelagem/penas/escamas, pose, direção, proporções, silhueta e ponto de contato com o chão da BASE. Não use uma arte anteriormente vestida como base.
Vista SOMENTE os equipamentos listados das referências reais. Remova armadura, sela e acessórios antigos que não constam na lista. Adapte os modelos ao corpo animal mantendo seus materiais, cores e ornamentação; não substitua por equipamento genérico.
Anatomia animal obrigatória: quadrúpedes mantêm quatro membros coerentes, patas traseiras naturais e cascos/patas corretos; aves mantêm duas pernas e duas asas ligadas às costas; cobra não recebe patas. Não antropomorfizar: sem mãos, braços humanos, torso humano, cavaleiro ou armas.
Preserve o enquadramento e a razão de aspecto da BASE, incluindo animal inteiro, cauda, orelhas e equipamentos, com a mesma escala relativa e margens transparentes. Nunca recortar ou esticar a silhueta.
Fundo transparente real, estilo medieval de fantasia coerente com a própria BASE. A imagem final contém apenas um animal vestido. Oclusão natural é obrigatória; itens encobertos permanecem ocultos, sem acessórios atravessando corpo, couro, asas ou tecido.
Se nenhum equipamento estiver selecionado, devolva o animal BASE sem equipamento; a anatomia, pose e pelagem continuam iguais.`;
}

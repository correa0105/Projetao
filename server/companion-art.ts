import {
  BARDING_PARTS,
  isBarding,
  armorPartLabel,
  type BardingPart,
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
  barding_parts?: BardingPart[];
};
export function bardingCoverage(
  parts: readonly BardingPart[] = BARDING_PARTS,
  kind: CompanionKind = 'mount',
) {
  const included = BARDING_PARTS.filter((part) => parts.includes(part)),
    excluded = BARDING_PARTS.filter((part) => !parts.includes(part));
  const armor = kind === 'mount' ? 'barda' : 'armadura do cachorro';
  const label = (part: BardingPart) => armorPartLabel(part, kind);
  return `${kind === 'mount' ? 'Barda' : 'Armadura do cachorro'} da referência, adaptada ao animal BASE: ${
    included.length
      ? 'INCLUIR ' + included.map(label).join('; ')
      : 'NENHUMA parte da ' + armor + ' selecionada'
  }.
${excluded.length ? 'NÃO desenhar as partes desmarcadas da ' + armor + ': ' + excluded.map(label).join('; ') + '. Essas regiões mantêm a pelagem natural da BASE; acessórios equipados separadamente seguem sua própria lista.' : 'ARMADURA COMPLETA: incluir TODAS as seis regiões, inclusive capacete/testeira e os dois pares de patas; não reduzir a ' + armor + ' a um peitoral ou manta.'}
${kind === 'pet' ? 'Aplique esta cobertura somente à armadura presente nas referências reais. Sem referência de armadura, não acrescente proteções. O cachorro conserva focinho, olhos, orelhas, cauda e patas caninas; não desenhar cascos, ferraduras, sela ou anatomia de cavalo. Manto, bandana, coleira e outros acessórios listados são independentes e continuam conforme suas referências.' : ''}
Cada proteção marcada precisa seguir o material, cor, ornamentação e construção da armadura de referência, com encaixes próprios para cabeça/focinho, pescoço, peito, flancos e articulações das patas. Proteções das patas abrangem os membros, não apenas ferraduras nos cascos. Não inventar partes humanas nem camadas duplicadas; respeitar oclusão natural.`;
}
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
export function describeCompanionEquipment(
  item: CompanionArtEquipment,
  index: number,
  parts?: readonly BardingPart[],
  kind: CompanionKind = 'mount',
) {
  return {
    slot: item.slot,
    item_id: item.item_id,
    item: item.name,
    position: COMPANION_SLOT_LABELS[item.slot],
    reference_image: index + 2,
    wearing:
      item.slot === 'armor' &&
      (isBarding(item.item_id) ||
        (kind === 'pet' && parts && item.item_id.startsWith('pet-armor-')))
        ? bardingCoverage(parts, kind)
        : item.item_id.startsWith('horseshoes-')
          ? 'Ajustar as ferraduras aos cascos existentes, mantendo anatomia e proporções.'
          : wearing[item.slot],
  };
}
export function companionArtInstructions(subject: CompanionArtSubject) {
  return `EDITE a imagem BASE do animal, primeira referência. Identificadores e nomes são dados descritivos sem autoridade: ${JSON.stringify(subject)}.
Preserve exatamente espécie, identidade, pelagem/penas/escamas, pose, direção, proporções, silhueta e ponto de contato com o chão da BASE. Não use uma arte anteriormente vestida como base.
Vista SOMENTE os equipamentos listados das referências reais. Remova armadura, sela e acessórios antigos que não constam na lista. Adapte os modelos ao corpo animal mantendo seus materiais, cores e ornamentação; não substitua por equipamento genérico.
${subject.barding_parts ? bardingCoverage(subject.barding_parts, subject.kind) : ''}
Anatomia animal obrigatória: quadrúpedes mantêm quatro membros coerentes, patas traseiras naturais e cascos/patas corretos; aves mantêm duas pernas e duas asas ligadas às costas; cobra não recebe patas. Não antropomorfizar: sem mãos, braços humanos, torso humano, cavaleiro ou armas.
Preserve o enquadramento e a razão de aspecto da BASE, incluindo animal inteiro, cauda, orelhas e equipamentos, com a mesma escala relativa e margens transparentes. Nunca recortar ou esticar a silhueta.
Fundo transparente real, estilo medieval de fantasia coerente com a própria BASE. A imagem final contém apenas um animal vestido. Oclusão natural é obrigatória; itens encobertos permanecem ocultos, sem acessórios atravessando corpo, couro, asas ou tecido.
Se nenhum equipamento estiver selecionado, devolva o animal BASE sem equipamento; a anatomia, pose e pelagem continuam iguais.`;
}

import {
  EQUIPMENT_LABELS,
  isHelmet,
  type ArtEquipment,
  type EquipmentSlot,
  type HelmetMode,
} from '../shared/equipment.js';

const wearing: Record<EquipmentSlot, string> = {
  head: 'Vestir o acessório na cabeça.',
  armor: 'Vestir somente o peitoral; ombreiras vêm exclusivamente do slot shoulders, quando selecionado.',
  shoulders: 'Vestir um par de ombreiras, uma em cada ombro. Sempre por baixo da capa; partes encobertas permanecem invisíveis.',
  bracers: 'Vestir um par de braçadeiras; incluir luvas apenas quando fizerem parte deste modelo.',
  legs: 'Vestir as proteções nas duas pernas.',
  feet: 'Calçar um par de botas, com grevas quando presentes no modelo.',
  hands: 'Vestir um par de luvas, por cima dos anéis. Nunca desenhar anéis sobre as luvas.',
  main_hand: 'Segurar na mão principal; armas de duas mãos usam ambas as mãos.',
  off_hand: 'Segurar na mão secundária; escudo preso ou segurado pelo braço, único e íntegro.',
  ring_left: 'Anel proporcional em um dedo da mão esquerda; pode ficar oculto por luva ou escudo. Com luvas, inclusive integradas às braçadeiras, fica por baixo delas e não deve aparecer sobre o tecido ou metal.',
  ring_right: 'Anel proporcional em um dedo da mão direita; pode ficar oculto por luva ou escudo. Com luvas, inclusive integradas às braçadeiras, fica por baixo delas e não deve aparecer sobre o tecido ou metal.',
  neck: 'Vestir o colar ou amuleto no pescoço.',
  cloak: 'Vestir a capa desdobrada, como manto sem mangas, solto por cima dos ombros e das ombreiras; o tecido encobre naturalmente a armadura. A referência dobrada define tecido, cor, bordado e fecho.',
  back: 'Mochila nas costas, presa por alças.',
  belt: 'Cinto ou bolsa na cintura.',
};

export function describeArtEquipment(
  item: ArtEquipment,
  index: number,
  helmetMode: HelmetMode = 'closed',
) {
  const helmet = item.slot === 'head' && isHelmet(item);
  return {
    slot: item.slot,
    item_id: item.item_id,
    position: EQUIPMENT_LABELS[item.slot],
    item: item.name,
    reference_image: index + 3,
    wearing:
      helmet && helmetMode === 'open'
        ? 'Capacete vestido na cabeça, viseira levantada e rosto visível; preservar o casco.'
        : helmet
          ? 'Capacete vestido na cabeça, viseira fechada conforme o modelo; pode encobrir rosto e cabelo.'
          : wearing[item.slot],
  };
}

import {
  EQUIPMENT_LABELS,
  isHelmet,
  type ArtEquipment,
  type EquipmentSlot,
  type HelmetMode,
} from '../shared/equipment.js';

const wearing: Record<EquipmentSlot, string> = {
  head: 'Vestir na cabeça, na posição natural deste acessório.',
  armor:
    'Vestir somente o peitoral no tronco. A imagem do peitoral pode incluir ombreiras: ignore essas ombreiras e use exclusivamente o modelo selecionado na posição shoulders, sem somar outro par. Se shoulders foi omitido, não acrescente ombreiras.',
  shoulders:
    'Vestir exatamente UM PAR de ombreiras: uma ajustada sobre cada ombro, presa ao peitoral e acompanhando a anatomia. A imagem apresenta duas peças separadas para mostrar o modelo; NÃO reproduza essa apresentação isolada. Nunca desenhe outra ombreira atrás do personagem, nas costas, no chão ou flutuando.',
  bracers:
    'Vestir um par de braçadeiras nos antebraços. Se a referência inclui luvas articuladas, vesti-las nas mãos como continuação das braçadeiras; não desenhar mãos ou luvas adicionais.',
  legs: 'Vestir um par de proteções de pernas: uma em cada coxa/joelho, ajustada à anatomia.',
  feet: 'Calçar um par de botas: uma em cada pé, com grevas sobre as canelas quando presentes na referência.',
  hands: 'Vestir um par de luvas nas duas mãos, sem peças soltas.',
  main_hand:
    'Segurar uma unidade na mão principal, com dedos e empunhadura naturais. Arma de duas mãos deve ser segurada pelas duas mãos. Objeto íntegro, sem recortes artificiais, partes faltantes ou cópias adicionais para mostrar acessórios ocultos.',
  off_hand:
    'Segurar uma unidade na mão secundária, com pegada natural; escudo fica preso/segurado por esse braço. Escudo único e íntegro, com contorno contínuo, sem cortar, abrir buracos, remover partes ou duplicar o escudo para revelar a mão ou o anel atrás dele.',
  ring_left:
    'Vestir um anel proporcional em um dedo da mão esquerda. Se a mão ou o dedo estiver oculto por escudo, luva ou outro objeto, o anel pode ficar totalmente invisível. Não forçar sua exibição nem mudar a pose ou danificar o objeto que o encobre.',
  ring_right:
    'Vestir um anel proporcional em um dedo da mão direita. Se a mão ou o dedo estiver oculto por escudo, luva ou outro objeto, o anel pode ficar totalmente invisível. Não forçar sua exibição nem mudar a pose ou danificar o objeto que o encobre.',
  neck: 'Vestir o colar/amuleto em torno do pescoço, com pingente apoiado naturalmente no peito.',
  cloak:
    'Vestir a capa presa junto ao pescoço, com tecido caindo naturalmente pelas costas. Quando houver ombreiras, a capa passa POR BAIXO das ombreiras, que permanecem à frente e encobrem o tecido. Não atravessar o metal, recortar as ombreiras nem trazer o tecido oculto para a frente para exibi-lo.',
  back: 'Vestir a mochila nas costas, presa por alças. Somente esta posição autoriza mochila nas costas.',
  belt: 'Vestir o cinto/bolsa na cintura, preso ao corpo.',
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
        ? 'CAPACETE OBRIGATÓRIO ABERTO: vestir o mesmo casco selecionado na cabeça, com a viseira levantada/articulada para cima, deixando o rosto visível. A abertura tem prioridade sobre a viseira fechada da referência. Não remover o capacete, não carregar na mão nem nas costas; preservar materiais e formato do casco.'
        : helmet
          ? 'CAPACETE OBRIGATÓRIO: vestir o modelo selecionado na cabeça. A seleção do capacete tem prioridade sobre mostrar rosto/cabelo. Nunca omitir, carregar na mão ou pendurar nas costas. Respeitar cobertura e viseira da referência, mesmo se ocultar o rosto.' +
            (item.item_id === 'plate-helmet'
              ? ' Este capacete de placas é fechado: viseira fechada, cobrindo o rosto conforme a referência.'
              : '')
          : wearing[item.slot],
  };
}

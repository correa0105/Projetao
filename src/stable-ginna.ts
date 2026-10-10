export const ginnaGreeting =
  'Olha só, visita! Seja muito bem-vindo! Entre, entre! Se ganhar uma lambida, considere um abraço de boas-vindas. Vem conhecer meus queridinhos — só cuidado com o seu lanche, hihi!';

export const ginnaFarewell = 'Melhor assim. Estarei de olho em você.';

export const ginnaQuestions = [
  {
    id: 'identity',
    question: 'Quem é você?',
    answer:
      'Pode me chamar de Ginna. Cuido deste lugar e de quem encontra abrigo aqui. Gosto dos animais: eles não precisam dizer uma palavra para que eu os entenda.',
  },
  {
    id: 'animals',
    question: 'Como você conseguiu esses animais?',
    answer:
      'Os animais vêm até mim. Alguns chegam cansados da estrada; outros se aproximam aos poucos, atraídos pela comida e pelo sossego do estábulo. Eu recebo cada um com água fresca, abrigo e paciência, até que se sintam seguros. Com o tempo, ganham confiança e ficam por aqui. Meu trabalho é fazer deste lugar um lar para eles.',
  },
  { id: 'warning', question: 'E se eu fizer mal a ele?', answer: '' },
] as const;
export type GinnaTopic = (typeof ginnaQuestions)[number]['id'];

export const ginnaExcuses = [
  ginnaQuestions[2].question,
  'E se eu precisar discipliná-lo?',
  'Mas e se ele não me obedecer?',
  'Seria só para ensinar uma lição…',
  'Se eu comprar eu decido, não voce',
] as const;

export const ginnaWarnings = [
  'Se você fizer mal a um deles, terá de responder a mim. Eles confiam em minhas mãos. Não vou deixar que as suas os machuquem.',
  'Disciplina não é uma desculpa para crueldade. Você ensina com paciência e cuidado. Dor só ensina um animal a ter medo de você.',
  'Talvez ele esteja assustado. Talvez você ainda não saiba escutá-lo. Minha paciência está acabando; não transforme a confiança dele em medo.',
  'Esta é a ÚLTIMA VEZ que vou dizer: NÃO MALTRATE NENHUM DELES, EM HIPÓTESE ALGUMA! Não importa a desculpa. Não encoste neles para ferir, assustar ou castigar. VOCÊ ENTENDEU?',
] as const;

export const ginnaMountLines: Record<string, readonly string[]> = {
  'riding-horse': [
    'Ele conhece a estrada melhor que muito guia. Adoro quando encosta o focinho na minha mão; carinho antes da sela, combinado?',
    'Escove-o com calma. Ele fecha os olhos quando confia em você. É a minha parte favorita do dia.',
    'Uma pausa, água fresca e um pouco de afeto. Não existe companheiro mais fiel do que aquele que você trata bem.',
  ],
  warhorse: [
    'Parece tão sério, não é? Mas gosta de coçar atrás da orelha. Até os mais valentes merecem ternura.',
    'Eu gosto dele por quem é, não pelas batalhas que pode enfrentar. Que a viagem de vocês tenha mais campos do que guerras.',
    'Ele reconhece passos gentis. Aproxime-se devagar; coragem e delicadeza podem andar juntas.',
  ],
  pony: [
    'Pequeno no tamanho, enorme na opinião. Eu adoro esse jeitinho. Uma maçã costuma encerrar qualquer discussão.',
    'Ele me segue pelo campo como uma sombra pequenina. Nunca conte que é o primeiro a ganhar carinho pela manhã.',
    'Olhe essas orelhas! Está ouvindo tudo. Fale com ele com a mesma gentileza com que fala comigo.',
  ],
  mule: [
    'Teimosa? Eu prefiro consultora de caminhos. Se não quiser atravessar uma ponte, escute. Eu confio nela.',
    'Ela carrega tanto, e ainda encontra tempo para encostar a cabeça no meu ombro. Não confunda força com falta de sentimentos.',
    'Minha companheira de passos tranquilos. Divida o peso, dê descanso e ela estará com você até o fim da estrada.',
  ],
};

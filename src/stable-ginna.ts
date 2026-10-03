export const ginnaGreeting =
  'Olha só, visita! Seja muito bem-vindo! Entre, entre! Se ganhar uma lambida, considere um abraço de boas-vindas. Vem conhecer meus queridinhos — só cuidado com o seu lanche, hihi!';

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
      'Consegui? Que palavra curiosa… Os animais vêm até mim. Às vezes atravessam a estrada; às vezes, caminhos que você não saberia encontrar. Eles sabem onde serão acolhidos. Eu apenas deixo a porteira aberta.',
  },
  { id: 'warning', question: 'E se alguém maltratar os animais?', answer: '' },
] as const;
export type GinnaTopic = (typeof ginnaQuestions)[number]['id'];

export const ginnaWarnings = [
  'Não maltrate nenhum deles. Enquanto estiverem sob meus cuidados, ninguém os machuca. E eu não esqueço quem tenta.',
  'Você ouviu a resposta. Eles confiam em mim. Eu não permito que essa confiança seja ferida.',
  'Está insistindo por curiosidade… ou para descobrir quanto vale a minha paciência? Escolha bem o que faz a seguir.',
  'Esta é a última vez que digo: deixe os animais em paz. Há coisas debaixo desta terra que não são tão gentis quanto eu.',
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

export function VttRollHelp() {
  const examples = [
    ['Lançamento', '2d6+3', 'Some dois dados de seis faces e acrescente 3.'],
    ['Conservar maiores', '4d6kh3', 'Conserve os três maiores resultados de quatro dados.'],
    ['Vantagem e desvantagem', '2d20kh1 / 2d20kl1', 'Conserve o maior ou o menor resultado.'],
    [
      'Descarte seletivo',
      '4d6dh1 / 4d6dl1',
      'Descarte o maior ou o menor resultado; k e d abreviam kh e dl.',
    ],
    ['Percentual', '1d100', 'Gere um resultado de 1 a 100.'],
    ['Lançamento extra', '3d6!', 'Cada resultado máximo gera outro lançamento.'],
    [
      'Gatilho extra',
      '3d6!3 / 3d6!>4',
      'Gere outro lançamento ao obter exatamente 3 ou pelo menos 4.',
    ],
    ['Cadeia somada', '5d6!!', 'Acumule cada cadeia de adicionais no mesmo dado.'],
    ['Extra com desconto', '5d6!p', 'Desconte 1 de cada lançamento adicional.'],
    [
      'Grupos de totais',
      '{4d6,2d8}kh1',
      'Compare os totais dos grupos e conserve o maior. Sem vírgula, {4d6+2d8}kh1 conserva o maior dado individual.',
    ],
    [
      'Contagem de acertos',
      '10d6=1 / 10d6>4 / 10d6<2',
      'Conte resultados iguais a 1, pelo menos 4 ou no máximo 2.',
    ],
    [
      'Contagem com contratempos',
      '10d6>4f1',
      'Conte acertos a partir de 4 e desconte cada resultado 1.',
    ],
    ['Relançamento', '2d6r<3', 'Substitua valores até 3 enquanto essa condição ocorrer.'],
    ['Segunda tentativa', '2d6ro<3', 'Substitua valores até 3 uma única vez por dado.'],
    [
      'Organizar resultados',
      '8d6sa / 8d6sd',
      'Apresente em ordem crescente ou decrescente; s usa crescente.',
    ],
    ['Dados de equilíbrio', '4dF', 'Lance quatro dados com valores −1, 0 ou +1.'],
    ['Cálculo agrupado', '(2d6+3)*2', 'Agrupe a soma antes de multiplicar.'],
    ['Dados calculados', '(2+1)d6 / 2d(4+2)', 'Calcule a quantidade ou as faces antes de lançar.'],
    [
      'Arredondamento e valor absoluto',
      'floor(9/2) / ceil(9/2) / round(4.5) / abs(-3)',
      'Arredonde para baixo, para cima, para o inteiro mais próximo ou remova o sinal.',
    ],
    ['Potência e resto', '2**3 / 7%3', 'Calcule potências e o resto de uma divisão.'],
    [
      'Valores repetidos',
      '4d6m / 4d6mt / 6d6mt3',
      'Destaque valores repetidos, conte grupos repetidos ou exija três iguais.',
    ],
    [
      'Resultado excepcional e contratempo',
      '1d20cs>18cf<2',
      'Destaque resultados sem alterar o total.',
    ],
    ['Anotações', '2d6[Chamas]+1d8[Frio]', 'Anote o propósito de cada parcela.'],
  ];
  return (
    <details className="vtt-roll-help">
      <summary>Rolagens personalizadas</summary>
      <p>Digite a fórmula e role. Você pode salvar a fórmula como macro para usar novamente.</p>
      <ul>
        {examples.map(([term, formula, text]) => (
          <li key={formula}>
            <strong>{term}</strong> · <code>{formula}</code> {text}
          </li>
        ))}
      </ul>
      <p>
        Nas condições dos dados, &gt; significa ≥ e &lt; significa ≤. Até 100 dados iniciais, 1000
        faces e 500 lançamentos por fórmula, com até 100 caracteres. O histórico mostra todos os
        dados lançados; o total considera os descartes e as substituições.
      </p>
      <h4>Como a fórmula é resolvida</h4>
      <ol>
        <li>Resolva os grupos e a quantidade/faces calculadas.</li>
        <li>Lance os dados e processe relançamentos e lançamentos adicionais.</li>
        <li>
          Conserve ou descarte valores; conte sucessos, contratempos e repetições; organize a
          exibição.
        </li>
        <li>
          Resolva funções e parênteses, potências, multiplicação/divisão/resto e finalmente
          soma/subtração.
        </li>
        <li>
          Registre os dados lançados e o total no chat. Uma macro salva reutiliza essa mesma
          fórmula.
        </li>
      </ol>
    </details>
  );
}

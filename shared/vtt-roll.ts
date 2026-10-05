type Throw = { sides: number; value: number };
type Pool = { values: number[]; total: number; dice?: boolean };
type Condition = { op: string; value: number };
type Modifier = { kind: string; count?: number; condition?: Condition };
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const matches = (n: number, c: Condition) =>
  c.op === '>' ? n >= c.value : c.op === '<' ? n <= c.value : n === c.value;
function arithmetic(p: Pool, q: Pool, op: string): Pool {
  const apply = (a: number, b: number) =>
    op === '+'
      ? a + b
      : op === '-'
        ? a - b
        : op === '*'
          ? a * b
          : op === '/'
            ? a / b
            : op === '%'
              ? a % b
              : a ** b;
  const total = apply(p.total, q.total);
  const values =
    p.dice && !q.dice
      ? p.values.map((n) => apply(n, q.total))
      : !p.dice && q.dice
        ? q.values.map((n) => apply(p.total, n))
        : p.dice && q.dice && (op === '+' || op === '-')
          ? [...p.values, ...q.values.map((n) => (op === '-' ? -n : n))]
          : [total];
  return { values, total, dice: !!p.dice || !!q.dice };
}
// Parses data only. No eval, property lookup, code execution or unbounded recursion.
export function rollFormula(
  formula: string,
  random: (min: number, maxExclusive: number) => number,
) {
  const source = formula
      .replace(/\[[^\[\]]*\]/g, '')
      .replace(/\s/g, '')
      .toLowerCase(),
    throws: Throw[] = [],
    displayed: number[] = [],
    highlights: { value: number; kind: 'surge' | 'mishap' | 'match' }[] = [];
  let at = 0,
    depth = 0,
    baseDice = 0;
  if (!source || source.length > 100) throw Error('Fórmula inválida ou muito longa.');
  const take = (pattern: RegExp) => {
    const m = source.slice(at).match(pattern);
    if (m) at += m[0].length;
    return m;
  };
  const condition = (fallback: number): Condition => {
    const m = take(/^([<>=])?(-?\d+)/);
    return m ? { op: m[1] || '=', value: Number(m[2]) } : { op: '=', value: fallback };
  };
  function modifiers(group = false) {
    const list: Modifier[] = [];
    while (at < source.length) {
      const kd = take(/^(kh|kl|dh|dl|k|d)(\d+)/);
      if (kd) {
        list.push({
          kind: kd[1] === 'k' ? 'kh' : kd[1] === 'd' ? 'dl' : kd[1],
          count: Number(kd[2]),
        });
        continue;
      }
      const critical = take(/^(cs|cf)/);
      if (critical) {
        list.push({ kind: critical[1], condition: condition(NaN) });
        continue;
      }
      const matching = take(/^(mt|m)(\d*)/);
      if (matching) {
        list.push({
          kind: matching[1],
          count: Number(matching[2] || 2),
          condition: condition(NaN),
        });
        continue;
      }
      const order = take(/^(sa|sd|s)(?![a-z])/);
      if (order) {
        list.push({ kind: order[1] === 's' ? 'sa' : order[1] });
        continue;
      }
      if (!group) {
        const ex = take(/^(!p|!!|!)/);
        if (ex) {
          list.push({ kind: ex[1], condition: condition(NaN) });
          continue;
        }
        const re = take(/^(ro|r)/);
        if (re) {
          list.push({ kind: re[1], condition: condition(1) });
          continue;
        }
      }
      const fail = take(/^f(?=[<>=\d-])/);
      if (fail) {
        list.push({ kind: 'fail', condition: condition(1) });
        continue;
      }
      if (/^[<>=]/.test(source.slice(at))) {
        list.push({ kind: 'success', condition: condition(0) });
        continue;
      }
      break;
    }
    if (list.length > 20 || list.filter((m) => m.kind.startsWith('!')).length > 1)
      throw Error('Modificadores incompatíveis.');
    if (list.some((m) => m.kind === 'fail') && !list.some((m) => m.kind === 'success'))
      throw Error('Combine falhas com uma condição de sucesso.');
    return list;
  }
  function finish(values: number[], mods: Modifier[]): Pool {
    let retained = [...values];
    for (const m of mods) {
      if (['kh', 'kl', 'dh', 'dl'].includes(m.kind)) {
        const descending = m.kind === 'kh' || m.kind === 'dh',
          sorted = retained
            .map((n, i) => ({ n, i }))
            .sort((a, b) => (descending ? b.n - a.n : a.n - b.n)),
          count = Math.min(retained.length, m.count!),
          ids = new Set(sorted.slice(0, count).map((r) => r.i)),
          keep = m.kind.startsWith('k');
        retained = retained.filter((_, i) => ids.has(i) === keep);
      }
    }
    const success = mods.find((m) => m.kind === 'success'),
      fail = mods.find((m) => m.kind === 'fail');
    let total = success
      ? retained.reduce(
          (n, v) =>
            n +
            (matches(v, success.condition!) ? 1 : 0) -
            (fail && matches(v, fail.condition!) ? 1 : 0),
          0,
        )
      : sum(retained);
    for (const m of mods) {
      if (m.kind === 'cs' || m.kind === 'cf')
        for (const value of retained)
          if (matches(value, m.condition!))
            highlights.push({ value, kind: m.kind === 'cs' ? 'surge' : 'mishap' });
      if (m.kind === 'm' || m.kind === 'mt') {
        const groups = new Map<number, number>();
        for (const value of retained) groups.set(value, (groups.get(value) || 0) + 1);
        const matched = [...groups].filter(
          ([value, count]) =>
            count >= m.count! && (Number.isNaN(m.condition!.value) || matches(value, m.condition!)),
        );
        for (const [value] of matched) highlights.push({ value, kind: 'match' });
        if (m.kind === 'mt') total = matched.length;
      }
    }
    const order = mods.find((m) => m.kind === 'sa' || m.kind === 'sd');
    if (order) values.sort((a, b) => (order.kind === 'sd' ? b - a : a - b));
    return { values: retained, total, dice: true };
  }
  function dice(count: number, sides: number, mods: Modifier[]): Pool {
    baseDice += count;
    if (
      !Number.isInteger(count) ||
      count < 0 ||
      baseDice > 100 ||
      !Number.isInteger(sides) ||
      (sides !== -1 && (sides < (count === 0 ? 0 : 1) || sides > 1000))
    )
      throw Error('Limite de 100 dados iniciais, com 1 a 1000 faces.');
    const minimum = sides === -1 ? -1 : 1,
      maximum = sides === -1 ? 1 : sides;
    const ex = mods.find((m) => m.kind.startsWith('!')),
      rerolls = mods.filter((m) => m.kind === 'r' || m.kind === 'ro');
    if (ex && Number.isNaN(ex.condition!.value)) ex.condition = { op: '=', value: maximum };
    for (const m of mods.filter((m) => m.kind === 'cs' || m.kind === 'cf'))
      if (Number.isNaN(m.condition!.value))
        m.condition = { op: '=', value: m.kind === 'cs' ? maximum : minimum };
    for (const m of [ex, ...rerolls].filter((m): m is Modifier => !!m)) {
      if (m.kind === 'ro') continue;
      if (
        Array.from({ length: maximum - minimum + 1 }, (_, i) => i + minimum).every((n) =>
          matches(n, m.condition!),
        )
      )
        throw Error('Esta condição faria a rolagem continuar para sempre.');
    }
    function draw() {
      if (throws.length >= 500)
        throw Error('Limite de 500 lançamentos atingido. Ajuste a fórmula.');
      const value = random(minimum, maximum + 1);
      if (!Number.isInteger(value) || value < minimum || value > maximum)
        throw Error('Resultado de dado inválido.');
      throws.push({ sides, value });
      return value;
    }
    const values: number[] = [];
    const first = throws.length;
    for (let i = 0; i < count; i++) {
      let chain = 0,
        extra = false;
      while (true) {
        const used = new Set<Modifier>();
        let n = draw();
        while (true) {
          const re = rerolls.find(
            (re) => matches(n, re.condition!) && (!used.has(re) || re.kind === 'r'),
          );
          if (!re) break;
          used.add(re);
          n = draw();
        }
        const explode = !!ex && matches(n, ex.condition!);
        const value = n - (extra && ex?.kind === '!p' ? 1 : 0);
        if (ex?.kind === '!!') chain += value;
        else values.push(value);
        if (!explode) {
          if (ex?.kind === '!!') values.push(chain);
          break;
        }
        extra = true;
      }
    }
    const result = finish(values, mods),
      order = mods.find((m) => m.kind === 'sa' || m.kind === 'sd'),
      actual = throws.slice(first).map((t) => t.value);
    if (order) actual.sort((a, b) => (order.kind === 'sd' ? b - a : a - b));
    displayed.push(...actual);
    return result;
  }
  function atom(): Pool {
    if (++depth > 10) throw Error('Agrupamento muito profundo.');
    try {
      const d = take(/^(\d*)d/);
      if (d) return dieExpression(Number(d[1] || 1));
      const func = take(/^(floor|ceil|round|abs)\(/);
      if (func) {
        const p = expression();
        if (source[at++] !== ')') throw Error('Feche a função.');
        const value = Math[func[1] as 'floor' | 'ceil' | 'round' | 'abs'](p.total);
        return { values: [value], total: value };
      }
      if (source[at] === '{') {
        at++;
        const first = displayed.length;
        const pools = [expression()];
        while (source[at] === ',') {
          at++;
          pools.push(expression());
          if (pools.length > 100) throw Error('Grupo muito grande.');
        }
        if (source[at++] !== '}') throw Error('Feche o grupo com }.');
        const mods = modifiers(true),
          single = pools.length === 1;
        const order = mods.find((m) => m.kind === 'sa' || m.kind === 'sd');
        if (order)
          displayed.splice(
            first,
            displayed.length - first,
            ...displayed.slice(first).sort((a, b) => (order.kind === 'sd' ? b - a : a - b)),
          );
        if (!mods.length)
          return {
            values: pools.flatMap((p) => p.values),
            total: sum(pools.map((p) => p.total)),
            dice: pools.some((p) => p.dice),
          };
        return finish(single ? pools[0].values : pools.map((p) => p.total), mods);
      }
      if (source[at] === '(') {
        at++;
        const result = expression();
        if (source[at++] !== ')') throw Error('Feche os parênteses.');
        if (source[at] === 'd') {
          at++;
          return dieExpression(Math.round(result.total));
        }
        return result;
      }
      const n = take(/^\d+(?:\.\d+)?/);
      if (n) return { values: [Number(n[0])], total: Number(n[0]) };
      throw Error('Fórmula inválida perto de ' + source.slice(at, at + 12) + '.');
    } finally {
      depth--;
    }
  }
  function dieExpression(count: number) {
    const sides = take(/^(\d+|f)/);
    if (sides) return dice(count, sides[1] === 'f' ? -1 : Number(sides[1]), modifiers());
    if (source[at] === '(') {
      at++;
      const p = expression();
      if (source[at++] !== ')') throw Error('Feche o número de faces.');
      return dice(count, p.total, modifiers());
    }
    throw Error('Informe o número de faces do dado.');
  }
  function power(): Pool {
    let p = atom();
    if (source.slice(at, at + 2) === '**') {
      at += 2;
      const q = unary();
      p = arithmetic(p, q, '**');
    }
    return p;
  }
  function unary(): Pool {
    if (source[at] === '+' || source[at] === '-') {
      const sign = source[at++],
        p = unary(),
        total = sign === '-' ? -p.total : p.total;
      return { values: p.values.map((n) => (sign === '-' ? -n : n)), total, dice: p.dice };
    }
    return power();
  }
  function product(): Pool {
    let p = unary();
    while (['*', '/', '%'].includes(source[at])) {
      const op = source[at++],
        q = unary();
      if (op !== '*' && q.total === 0) throw Error('Divisão por zero.');
      p = arithmetic(p, q, op);
    }
    return p;
  }
  function expression(): Pool {
    let p = product();
    while (source[at] === '+' || source[at] === '-') {
      const op = source[at++],
        q = product();
      p = arithmetic(p, q, op);
    }
    return p;
  }
  const result = expression();
  if (at !== source.length || !Number.isFinite(result.total) || Math.abs(result.total) > 1000000)
    throw Error('Fórmula inválida ou resultado fora dos limites.');
  return { formula, dice: displayed, total: result.total, throws, highlights };
}

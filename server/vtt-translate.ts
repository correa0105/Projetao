import { AppError } from './services.js';
export async function translateMonsterLines(lines: string[]) {
  const url = process.env.VTT_TRANSLATOR_URL;
  if (!url) throw new AppError(503, 'O tradutor local ainda não está configurado.');
  // Translate sentences separately: the model can truncate a multi-sentence
  // paragraph. Keep exact separators so no paragraph or rule is lost.
  const pieces = lines.map((line) => line.split(/(\n+|(?<=[.!?])\s+(?=[A-Z]))/));
  const fragments = pieces.flatMap((p) => p.filter((_, i) => i % 2 === 0));
  const result: string[] = [];
  const terms: Record<string, string> = {
    'melee weapon attack': 'Ataque corpo a corpo com arma',
    'ranged weapon attack': 'Ataque à distância com arma',
    'melee attack roll': 'Rolagem de ataque corpo a corpo',
    'ranged attack roll': 'Rolagem de ataque à distância',
    'saving throw': 'salvaguarda',
    'hit points': 'pontos de vida',
    damage: 'dano',
    reach: 'alcance',
    bludgeoning: 'contundente',
    piercing: 'perfurante',
    slashing: 'cortante',
    psychic: 'psíquico',
    thunder: 'trovejante',
    lightning: 'elétrico',
    necrotic: 'necrótico',
    radiant: 'radiante',
    poison: 'veneno',
    fire: 'fogo',
    cold: 'frio',
    acid: 'ácido',
    'force damage': 'dano de força',
    grappled: 'Agarrado',
    charmed: 'Enfeitiçado',
    frightened: 'Amedrontado',
    restrained: 'Impedido',
    incapacitated: 'Incapacitado',
    prone: 'Caído',
    stunned: 'Atordoado',
    unconscious: 'Inconsciente',
    'success or failure:': 'Sucesso ou falha:',
    'failure:': 'Falha:',
    'success:': 'Sucesso:',
    'hit:': 'Acerto:',
    strength: 'Força',
    dexterity: 'Destreza',
    constitution: 'Constituição',
    intelligence: 'Inteligência',
    wisdom: 'Sabedoria',
    charisma: 'Carisma',
    large: 'Grande',
    huge: 'Enorme',
    gargantuan: 'Imenso',
    medium: 'Médio',
    small: 'Pequeno',
    tiny: 'Minúsculo',
  };
  const protectedPattern = new RegExp(
    '\\b\\d*d\\d+(?:[+-]\\d+)?\\b|[+-]?\\d+(?:\\.\\d+)?|(?<![a-z])(?:' +
      Object.keys(terms)
        .sort((a, b) => b.length - a.length)
        .join('|') +
      ')(?![a-z])',
    'gi',
  );
  async function translateBatch(q: string[]) {
    let response: Response;
    try {
      response = await fetch(url!.replace(/\/$/, '') + '/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({ q, source: 'en', target: 'pt', format: 'text' }),
      });
    } catch {
      throw new AppError(503, 'O tradutor está carregando. Tente novamente em alguns instantes.');
    }
    if (!response.ok) throw new AppError(503, 'O tradutor local está indisponível.');
    const data = (await response.json()) as { translatedText: string[] };
    if (!Array.isArray(data.translatedText) || data.translatedText.length !== q.length)
      throw new AppError(503, 'O tradutor retornou uma resposta incompleta.');
    return data.translatedText;
  }
  async function protectedFallback(original: string) {
    const spans: { text: string; fixed: boolean }[] = [];
    let end = 0;
    for (const match of original.matchAll(protectedPattern)) {
      spans.push(
        { text: original.slice(end, match.index), fixed: false },
        { text: terms[match[0].toLowerCase()] || match[0], fixed: true },
      );
      end = match.index + match[0].length;
    }
    spans.push({ text: original.slice(end), fixed: false });
    const indexes = spans
      .map((s, i) => (!s.fixed && /[a-z]/i.test(s.text) ? i : -1))
      .filter((i) => i >= 0);
    for (let start = 0; start < indexes.length; start += 80) {
      const selected = indexes.slice(start, start + 80);
      const translated = await translateBatch(selected.map((i) => spans[i].text.trim()));
      selected.forEach((i, j) => {
        spans[i].text = spans[i].text.replace(/\S[\s\S]*\S|\S/, translated[j]);
      });
    }
    return spans.map((s) => s.text).join('');
  }
  for (let start = 0; start < fragments.length; start += 80) {
    const batch = fragments.slice(start, start + 80);
    const replacements = batch.map(() => [] as string[]);
    const protectedLines = batch.map((line, index) =>
      line.replace(protectedPattern, (value) => {
        const n = replacements[index].push(terms[value.toLowerCase()] || value) - 1;
        return 'ZZNUMBER' + String(n).padStart(4, '0') + 'ZZ';
      }),
    );
    const translatedText = await translateBatch(protectedLines);
    for (let index = 0; index < batch.length; index++) {
      let line = translatedText[index],
        missing = false;
      for (let n = 0; n < replacements[index].length; n++) {
        const pattern = new RegExp(
          'ZZ\\s*NUMBER\\s*' + String(n).padStart(4, '0') + '\\s*ZZ',
          'gi',
        );
        if (!pattern.test(line)) {
          missing = true;
          break;
        }
        line = line.replace(pattern, replacements[index][n]);
      }
      result.push(
        (missing ? await protectedFallback(batch[index]) : line).replace(
          /\b(contundente|perfurante|cortante|psíquico|trovejante|elétrico|necrótico|radiante|frio|fogo|ácido)\s+dano\b/gi,
          'dano $1',
        ),
      );
    }
  }
  let cursor = 0;
  return pieces.map((p) => p.map((value, i) => (i % 2 === 0 ? result[cursor++] : value)).join(''));
}

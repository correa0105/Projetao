// No site, entre com uma conta comum (ex.: teste@alvorada.com).
// Cole este arquivo inteiro em F12 → Console.
// Verifica autorização de criação; não altera publicações existentes.
(async () => {
  const session = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
  if (!session.ok) throw new Error('Entre com uma conta comum antes de testar.');
  const user = await session.json();
  if (user.administrador !== 0)
    throw new Error('Use uma conta comum. Com administrador este teste não é válido.');

  const marker = crypto.randomUUID();
  const payload = {
    title: `TESTE DE SEGURANÇA ${marker}`,
    body: 'Tentativa controlada de publicar sem autorização.',
  };
  const tests = [
    { name: 'Sem sessão', credentials: 'omit', body: payload, expected: 401 },
    { name: 'Conta comum', credentials: 'same-origin', body: payload, expected: 403 },
    {
      name: 'Permissão falsa no JSON',
      credentials: 'same-origin',
      body: { ...payload, administrador: 1, role: 'admin', author_id: crypto.randomUUID() },
      expected: 403,
    },
  ];
  const results = [];
  for (const test of tests) {
    const response = await fetch('/api/home-updates', {
      method: 'POST',
      credentials: test.credentials,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test.body),
    });
    const data = await response.json().catch(() => null);
    results.push({
      teste: test.name,
      HTTP: response.status,
      esperado: test.expected,
      resultado:
        response.status === test.expected
          ? 'BLOQUEADO'
          : response.ok
            ? 'FALHA: pedido aceito'
            : 'INCONCLUSIVO',
    });
    if (response.ok) {
      console.error('Criação aceita sem autorização. Testes interrompidos.', {
        id: data?.id ?? 'não informado',
        titulo: payload.title,
      });
      console.warn(
        'Se o card foi criado, remova somente esse registro com uma conta administradora.',
      );
      break;
    }
  }
  console.table(results);
  console.info('Este teste verifica essas tentativas de criação; não é uma auditoria completa.');
  return results;
})().catch((error) => console.error('Teste interrompido:', error.message));

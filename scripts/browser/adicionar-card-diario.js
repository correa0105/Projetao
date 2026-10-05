// Abra o site com uma conta administradora. Edite o card abaixo e cole
// todo este arquivo no console do navegador (F12 → Console).
(async () => {
  const card = {
    title: 'Título do novo card',
    body: `Escreva aqui o conteúdo do card.

Você pode usar **negrito**, *itálico* e [links](https://exemplo.com).`,
    kind: 'article', // article, image ou meeting (encontro com data).
    layout: 'landscape', // feature, landscape, portrait ou compact.
    image_path: '/alvorada-dawn-banner.png', // Use '' para ficar sem imagem.
    image_side: 'left', // left ou right.
    image_fit: 'cover', // cover preenche; contain mostra a imagem inteira.
    link: '', // Ex.: '#lore', '#events' ou 'https://exemplo.com'.
    starts_at: null, // Para meeting: '2026-10-10T19:00:00-03:00'.
    location: '',
    text_align: 'left', // left ou center.
    text_size: 'normal', // normal ou large.
    position: 0, // Menores valores aparecem primeiro.
  };

  // Outras imagens prontas: '/character-camp-v2.png',
  // '/notice-village-tavern-v3.png' ou '/atlas-world-v2.png'.
  // Imagens enviadas pelo editor usam '/api/home-images/ID-DA-IMAGEM'.
  // Cada execução publica um novo card.
  try {
    const response = await fetch('/api/home-updates', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new Error('Entre na sua conta e execute novamente.');
      if (response.status === 403)
        throw new Error('Sua conta precisa ser administradora para publicar no Diário.');
      throw new Error(data?.error || `Não foi possível publicar (HTTP ${response.status}).`);
    }
    console.log('Card publicado no Diário:', { id: data.id, title: data.title });
    console.info('Recarregue a página e abra Início → Diário para visualizar o card.');
  } catch (error) {
    console.error('Falha ao publicar o card:', error.message);
  }
})();

INSERT INTO special_shop_offers(id, currency, category, name, description, image_path, target_key, price, active)
VALUES
  ('14500000-0000-4000-8000-000000000001', 'crystals', 'tower_item',
   'Brasa de Vigília',
   'Parta a pedra com uma ação. Ela emite luz fraca num raio de 3 m por 10 minutos, sem dissipar escuridão mágica. Consumível da Torre.',
   '/shop/homebrew/brasa-de-vigilia.webp', NULL, 6, true),
  ('14500000-0000-4000-8000-000000000002', 'crystals', 'tower_item',
   'Esmeralda do Fôlego',
   'Use uma ação para estabilizar uma criatura viva a 0 PV que você tocar. A gema se desfaz e a criatura permanece com 0 PV. Consumível da Torre.',
   '/shop/homebrew/esmeralda-do-folego.webp', NULL, 9, true),
  ('14500000-0000-4000-8000-000000000003', 'prestige', 'weapon_skin',
   'Arco da Vigília Celeste',
   'Aparência para arco longo, com madeira azul-escura e ponteiras de ouro branco perfuradas em forma de estrelas. A arma mantém suas propriedades.',
   '/shop/homebrew/arco-vigilia-celeste.webp', 'longbow', 14, true),
  ('14500000-0000-4000-8000-000000000004', 'prestige', 'weapon_skin',
   'Adaga do Primeiro Broto',
   'Aparência para adaga, com lâmina em forma de folha e um botão entalhado no pomo. A arma mantém suas propriedades.',
   '/shop/homebrew/adaga-primeiro-broto.webp', 'dagger', 12, true),
  ('14500000-0000-4000-8000-000000000005', 'prestige', 'mount',
   'Cervo do Eclipse',
   'Trilha Entre Véus dá +2 em Sobrevivência para traçar rotas sob neblina ou pouca luz. O mestre ativa em cena. Um auxílio a cada 24 h por personagem.',
   '/stable/eclipse-stag-v1.webp', 'eclipse-stag', 24, true)
ON CONFLICT (id) DO NOTHING;

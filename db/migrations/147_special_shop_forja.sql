UPDATE special_shop_offers SET
  image_path='/shop/reliquias-forja/arco-vigilia-v2.webp',
  description='Aparência para arco longo com filigrana dourada, flores de opala e madrepérola. A arma mantém suas propriedades.',
  revision=revision+1
WHERE id='14500000-0000-4000-8000-000000000003' AND image_path='/shop/homebrew/arco-vigilia-celeste.webp';

UPDATE special_shop_offers SET
  image_path='/shop/reliquias-forja/adaga-broto-v2.webp',
  description='Aparência para adaga com lâmina de prata, guarda de folhas em bronze e flor de opala no pomo. A arma mantém suas propriedades.',
  revision=revision+1
WHERE id='14500000-0000-4000-8000-000000000004' AND image_path='/shop/homebrew/adaga-primeiro-broto.webp';

INSERT INTO special_shop_offers(id,currency,category,name,description,image_path,target_key,price,active)
VALUES
  ('14700000-0000-4000-8000-000000000001','prestige','prestige_weapon','Espada da Aurora Velada',
   'Espada longa evolutiva. Vai de +1 a +3 conforme o nível. O Clarão do Alvorecer fortalece os acertos críticos.',
   '/shop/reliquias-forja/aurora-velada.webp','prestige-espada-aurora-velada',42,true),
  ('14700000-0000-4000-8000-000000000002','prestige','prestige_weapon','Arco do Eclipse',
   'Arco longo evolutivo. Vai de +1 a +2 e recompensa o atirador que encontra espaço para lutar à distância.',
   '/shop/reliquias-forja/arco-do-eclipse.webp','prestige-arco-do-eclipse',36,true),
  ('14700000-0000-4000-8000-000000000003','prestige','prestige_weapon','Martelo da Sentinela',
   'Martelo de guerra raro +2. A Última Vigília fortalece o golpe do portador ferido.',
   '/shop/reliquias-forja/martelo-da-sentinela.webp','prestige-martelo-sentinela',38,true),
  ('14700000-0000-4000-8000-000000000004','prestige','prestige_weapon','Rapieira da Ressaca',
   'Rapieira incomum +1. A Corrente de Retorno fortalece o golpe contra alvos feridos.',
   '/shop/reliquias-forja/rapieira-da-ressaca.webp','prestige-rapieira-ressaca',28,true),
  ('14700000-0000-4000-8000-000000000005','prestige','weapon_skin','Machado da Asa de Geada',
   'Aparência para machado de batalha. Penas de bronze cercam a lâmina de prata e o espinélio azul.',
   '/shop/reliquias-forja/machado-geada.webp','battleaxe',16,true),
  ('14700000-0000-4000-8000-000000000006','prestige','weapon_skin','Lança do Céu de Cobre',
   'Aparência para lança. A ponta de prata tem filigrana em cobre e o cabo vinho recebe esmalte azul.',
   '/shop/reliquias-forja/lanca-cobre.webp','spear',15,true)
ON CONFLICT (id) DO NOTHING;

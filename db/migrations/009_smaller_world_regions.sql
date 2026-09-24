-- Smaller world destinations. Existing locations and mission ownership stay intact.
-- Each destination can receive its own explorable map in a later migration.
INSERT INTO world_regions(id,name,description,available) VALUES
 ('coroa-da-geada','Coroa da Geada','Cumes nevados e fortalezas silenciosas ao norte do Reino do Norte.',false),
 ('vale-dos-pinheiros','Vale dos Pinheiros','Bosques antigos e vales abrigados a leste do Reino do Norte.',false),
 ('falesias-de-sal','Falésias de Sal','Penhascos, salinas e enseadas ao sul da Costa Cinzenta.',false),
 ('altos-de-boreal','Altos de Boreal','Cordilheiras geladas e passos elevados no norte de Northundria.',false),
 ('campos-de-vesper','Campos de Vésper','Campinas frias e rotas de pastores a nordeste de Northundria.',false),
 ('terras-de-ambar','Terras de Âmbar','Colinas douradas e caminhos entre o Pomar Branco e as terras orientais.',false),
 ('peninsula-de-lume','Península de Lume','Uma estreita faixa de montanhas e promontórios no extremo sul.',false),
 ('escarpas-de-cinabrio','Escarpas de Cinábrio','Muralhas naturais e vales minerais além de Valdrakken.',false),
 ('vigias-do-gelo','Vigias do Gelo','Ilhas frias e torres costeiras ao norte de Skelliege.',false),
 ('vale-do-cervo','Vale do Cervo','Pastagens e bosques no interior das Marchas do Poente.',false),
 ('ermos-de-salvia','Ermos de Sálvia','Terras áridas e oásis dispersos a leste das Dunas de Auren.',false),
 ('portas-de-arenito','Portas de Arenito','Passagens rochosas e antigas rotas na entrada do grande deserto.',false)
ON CONFLICT (id) DO NOTHING;

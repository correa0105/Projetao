-- New world destinations; the existing kingdom and mission links are preserved.
INSERT INTO world_regions(id,name,description,available) VALUES
 ('valdrakken','Valdrakken','Cordilheiras orientais e cidadelas acima dos vales.',false),
 ('skelliege','Skelliege','Ilhas rochosas e enseadas no mar do poente.',false),
 ('marchas-do-poente','Marchas do Poente','Planícies e fronteiras das terras ocidentais.',false),
 ('dunas-de-auren','Dunas de Auren','Um vasto deserto cercado por escarpas e antigos caminhos.',false),
 ('costa-cinzenta','Costa Cinzenta','Terras baixas e portos ao sul do Reino do Norte.',false),
 ('olho-da-tormenta','Olho da Tormenta','Um vórtice marítimo cercado por nuvens em espiral.',false),
 ('fulkushima','Fulkushima','Uma ilha vulcânica de rocha escura e lava incandescente.',false)
ON CONFLICT (id) DO NOTHING;

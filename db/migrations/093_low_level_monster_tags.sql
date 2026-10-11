-- Nine classic low-challenge monsters join Goblin from migration 092.
-- Keep administrators' existing names, revisions, descriptions and archive state.
INSERT INTO mission_tags(id,name,canonical_name,description) VALUES
 ('d70910aa-47e5-4884-a261-100000000002','Kobold','kobold','Missões envolvendo kobolds.'),
 ('d70910aa-47e5-4884-a261-100000000003','Esqueleto','esqueleto','Missões envolvendo esqueletos.'),
 ('d70910aa-47e5-4884-a261-100000000004','Zumbi','zumbi','Missões envolvendo zumbis.'),
 ('d70910aa-47e5-4884-a261-100000000005','Orc','orc','Missões envolvendo orcs.'),
 ('d70910aa-47e5-4884-a261-100000000006','Hobgoblin','hobgoblin','Missões envolvendo hobgoblins.'),
 ('d70910aa-47e5-4884-a261-100000000007','Gnoll','gnoll','Missões envolvendo gnolls.'),
 ('d70910aa-47e5-4884-a261-100000000008','Bugurso','bugurso','Missões envolvendo bugursos.'),
 ('d70910aa-47e5-4884-a261-100000000009','Ogro','ogro','Missões envolvendo ogros.'),
 ('d70910aa-47e5-4884-a261-100000000010','Cubo gelatinoso','cubo gelatinoso','Missões envolvendo cubos gelatinosos.')
ON CONFLICT DO NOTHING;

ALTER TABLE character_pets ADD COLUMN appearance text NOT NULL DEFAULT 'original';
ALTER TABLE character_pets ADD CONSTRAINT character_pets_appearance_check CHECK (
  appearance='original' OR (pet_id,appearance) IN (
    ('dog','shepherd'),('cat','longhair'),('rabbit','runic'),('owl','horned'),
    ('raven','shadow'),('snake','emerald'),('rat','fluffy')
  )
);

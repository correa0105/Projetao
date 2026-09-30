ALTER TABLE character_mounts ADD COLUMN coat text NOT NULL DEFAULT 'original' CHECK (coat IN ('original','alternate'));

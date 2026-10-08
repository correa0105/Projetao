-- Cosmetic attack events preserve the existing rolls, damage and resources.
ALTER TABLE vtt_messages ADD COLUMN attack_visual jsonb;

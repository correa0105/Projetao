ALTER TABLE vtt_weapon_loadouts
  ADD COLUMN IF NOT EXISTS main_hand_two_handed boolean NOT NULL DEFAULT false;

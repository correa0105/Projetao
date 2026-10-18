CREATE TABLE IF NOT EXISTS player_guild_room_facilities (
  guild_id uuid NOT NULL REFERENCES player_guilds(id) ON DELETE CASCADE,
  room text NOT NULL CHECK (room IN ('main','forge','lounge','meeting','alchemy','training','library','leader')),
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(guild_id,room)
);

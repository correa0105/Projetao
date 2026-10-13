-- Membership follows the character; keep one representative per account in a guild.
-- Existing rows and all guild history remain intact.
ALTER TABLE player_guild_members DROP CONSTRAINT player_guild_members_pkey;
ALTER TABLE player_guild_members ADD PRIMARY KEY (guild_id,user_id);
ALTER TABLE player_guild_members ADD CONSTRAINT player_guild_character_unique UNIQUE (character_id);
CREATE INDEX player_guild_member_account ON player_guild_members(user_id,joined_at,guild_id);

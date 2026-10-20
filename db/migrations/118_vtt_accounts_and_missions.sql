-- One permanent sharing address per account; old tables and invitations are preserved.
CREATE TABLE vtt_personal_spaces (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES vtt_rooms(id) ON DELETE SET NULL
);
INSERT INTO vtt_personal_spaces(user_id,room_id)
  SELECT u.id,(SELECT r.id FROM vtt_rooms r WHERE r.owner_id=u.id ORDER BY r.updated_at DESC,r.created_at DESC,r.id LIMIT 1) FROM "user" u;

-- Only external image files consume this allowance. Built-in art, imported
-- character/companion art, audio and scene documents are not external uploads.
CREATE FUNCTION vtt_account_used_bytes(account_id text) RETURNS bigint
LANGUAGE sql VOLATILE AS $$
  SELECT COALESCE(sum(octet_length(a.bytes)),0)::bigint FROM vtt_assets a
    JOIN vtt_rooms r ON r.id=a.room_id WHERE r.owner_id=account_id
    AND a.kind='image' AND a.character_art_source IS NULL AND a.companion_art_source IS NULL
$$;
CREATE FUNCTION vtt_check_account_storage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_id text; added_bytes bigint;
BEGIN
  IF NEW.kind<>'image' OR NEW.character_art_source IS NOT NULL OR NEW.companion_art_source IS NOT NULL THEN RETURN NEW; END IF;
  SELECT owner_id INTO account_id FROM vtt_rooms WHERE id=NEW.room_id;
  added_bytes := octet_length(NEW.bytes);
  IF TG_OP='UPDATE' AND NEW.room_id=OLD.room_id AND OLD.kind='image'
    AND OLD.character_art_source IS NULL AND OLD.companion_art_source IS NULL THEN
    added_bytes := added_bytes - octet_length(OLD.bytes);
  END IF;
  -- Existing content is preserved; deleting or shrinking remains possible.
  IF added_bytes<=0 OR account_id IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('vtt-account-storage:' || account_id,0));
  IF vtt_account_used_bytes(account_id)+added_bytes>104857600 THEN
    RAISE EXCEPTION 'VTT_STORAGE_LIMIT' USING ERRCODE='23514', CONSTRAINT='vtt_account_storage_limit';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER vtt_assets_account_storage BEFORE INSERT OR UPDATE OF bytes,room_id,kind,character_art_source,companion_art_source ON vtt_assets
  FOR EACH ROW EXECUTE FUNCTION vtt_check_account_storage();

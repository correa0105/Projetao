CREATE TABLE character_cards(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid NOT NULL REFERENCES characters(id),
 card_id text NOT NULL CHECK(card_id IN ('vigil','raven','mirror','moon','roots','anchor','blade','throne')),
 level smallint NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 5),slot smallint CHECK(slot BETWEEN 1 AND 3),
 price_cp integer NOT NULL CHECK(price_cp>=0),idempotency_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(character_id,card_id),UNIQUE(character_id,idempotency_key)
);
CREATE UNIQUE INDEX character_cards_equipped_slot ON character_cards(character_id,slot)WHERE slot IS NOT NULL;

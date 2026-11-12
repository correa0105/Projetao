ALTER TABLE guild_special_contributions DROP CONSTRAINT guild_special_contributions_currency_check;
ALTER TABLE guild_special_contributions ADD CONSTRAINT guild_special_contributions_currency_check
  CHECK(currency IN ('prestige','crystals','gold'));

-- Keep the former rules in the audit before retiring their spending requirements.
INSERT INTO guild_bastion_audit(kind,reference,document)
SELECT 'resource_change',room,jsonb_build_object('previous',progression)
FROM guild_facility_definitions
WHERE progression IS NOT NULL AND (
  room IN ('forge','meeting') OR progression::text ~ '"(prestige_cost|crystal_cost|tower_crystals)"'
);

UPDATE guild_facility_definitions f SET progression=jsonb_build_object('levels',(
  SELECT jsonb_agg(
    jsonb_set(
      CASE WHEN (tier->>'level')::int > 1 THEN jsonb_set(tier,'{enabled}','false') ELSE tier END,
      '{requirements}',coalesce((SELECT jsonb_agg(requirement) FROM jsonb_array_elements(tier->'requirements') requirement
        WHERE requirement->>'kind' NOT IN ('prestige_cost','crystal_cost','tower_crystals')),'[]'::jsonb)
    ) ORDER BY ordinal
  ) FROM jsonb_array_elements(f.progression->'levels') WITH ORDINALITY AS levels(tier,ordinal)
)),revision=revision+1,updated_at=now()
WHERE progression IS NOT NULL AND (
  room IN ('forge','meeting') OR progression::text ~ '"(prestige_cost|crystal_cost|tower_crystals)"'
);

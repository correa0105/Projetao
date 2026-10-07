-- Mount barding is again one complete item. Keep the old split rows as an
-- audit snapshot; prices, purchase/grant history and complete item IDs remain.
CREATE TABLE mount_armor_consolidation_archive (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_table text NOT NULL,
  row_data jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
CREATE TEMP TABLE whole_mount_parents ON COMMIT DROP AS
SELECT id FROM catalog_items WHERE raw_data->>'barding'='true';
CREATE TEMP TABLE whole_mount_children ON COMMIT DROP AS
SELECT id,raw_data->>'armor_bundle_parent' AS parent FROM catalog_items
WHERE id<>raw_data->>'armor_bundle_parent'
AND raw_data->>'armor_bundle_parent' IN(SELECT id FROM whole_mount_parents);

INSERT INTO mount_armor_consolidation_archive(source_table,row_data)
SELECT 'inventory',to_jsonb(i) FROM inventory i
WHERE item_id IN(SELECT id FROM whole_mount_parents UNION SELECT id FROM whole_mount_children);
INSERT INTO mount_armor_consolidation_archive(source_table,row_data)
SELECT 'account_vault',to_jsonb(v) FROM account_vault v
WHERE item_id IN(SELECT id FROM whole_mount_parents UNION SELECT id FROM whole_mount_children);
INSERT INTO mount_armor_consolidation_archive(source_table,row_data)
SELECT 'companion_equipment',to_jsonb(e) FROM companion_equipment e JOIN companion_wardrobes w ON w.id=e.wardrobe_id
WHERE e.item_id IN(SELECT id FROM whole_mount_children)
OR (w.kind='mount' AND (e.item_id IN(SELECT id FROM whole_mount_parents) OR e.slot IN('shoulders','bracers','legs','feet')));
INSERT INTO mount_armor_consolidation_archive(source_table,row_data)
SELECT 'character_equipment',to_jsonb(e) FROM character_equipment e WHERE item_id IN(SELECT id FROM whole_mount_children);

-- Count components across every backpack and the shared vault of each owner.
-- Existing complete-item units stay where they are. Recover a missing torso
-- only when the other components represent more complete units than remain.
CREATE TEMP TABLE whole_mount_stock ON COMMIT DROP AS
SELECT ch.user_id,i.character_id,NULL::text AS vault_user,i.item_id,
       COALESCE(c.parent,i.item_id) AS parent,i.quantity
FROM inventory i JOIN characters ch ON ch.id=i.character_id
LEFT JOIN whole_mount_children c ON c.id=i.item_id
WHERE i.item_id IN(SELECT id FROM whole_mount_parents UNION SELECT id FROM whole_mount_children)
UNION ALL
SELECT v.user_id,NULL::uuid,v.user_id,v.item_id,COALESCE(c.parent,v.item_id),v.quantity
FROM account_vault v LEFT JOIN whole_mount_children c ON c.id=v.item_id
WHERE v.item_id IN(SELECT id FROM whole_mount_parents UNION SELECT id FROM whole_mount_children);
CREATE TEMP TABLE whole_mount_recovery ON COMMIT DROP AS
WITH totals AS (
 SELECT user_id,parent,item_id,sum(quantity)::integer AS quantity
 FROM whole_mount_stock GROUP BY user_id,parent,item_id
), missing AS (
 SELECT user_id,parent,max(quantity)-COALESCE(max(quantity) FILTER(WHERE item_id=parent),0) AS quantity
 FROM totals GROUP BY user_id,parent
)
SELECT m.*,location.character_id,location.vault_user FROM missing m
CROSS JOIN LATERAL (
 SELECT character_id,vault_user FROM whole_mount_stock s
 WHERE s.user_id=m.user_id AND s.parent=m.parent
 ORDER BY character_id NULLS LAST,item_id LIMIT 1
) location WHERE m.quantity>0;
INSERT INTO inventory(character_id,item_id,quantity)
SELECT character_id,parent,quantity FROM whole_mount_recovery WHERE character_id IS NOT NULL
ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity;
INSERT INTO account_vault(user_id,item_id,quantity)
SELECT vault_user,parent,quantity FROM whole_mount_recovery WHERE vault_user IS NOT NULL
ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=account_vault.quantity+EXCLUDED.quantity;

CREATE TEMP TABLE whole_mount_changed ON COMMIT DROP AS
SELECT DISTINCT w.id FROM companion_wardrobes w JOIN companion_equipment e ON e.wardrobe_id=w.id
WHERE w.kind='mount' AND (e.item_id IN(SELECT id FROM whole_mount_parents UNION SELECT id FROM whole_mount_children)
OR e.slot IN('shoulders','bracers','legs','feet'));
-- Horseshoes remain usable as accessories after removing the separate hoof box.
UPDATE companion_equipment e SET slot='belt'
FROM companion_wardrobes w WHERE w.id=e.wardrobe_id AND w.kind='mount' AND e.slot='feet'
AND e.item_id LIKE 'horseshoes-%'
AND NOT EXISTS(SELECT 1 FROM companion_equipment b WHERE b.wardrobe_id=e.wardrobe_id AND b.slot='belt');
DELETE FROM companion_equipment e USING companion_wardrobes w WHERE w.id=e.wardrobe_id
AND (e.item_id IN(SELECT id FROM whole_mount_children)
OR (w.kind='mount' AND e.slot IN('shoulders','bracers','legs','feet')));
DELETE FROM character_equipment WHERE item_id IN(SELECT id FROM whole_mount_children);
DELETE FROM inventory WHERE item_id IN(SELECT id FROM whole_mount_children);
DELETE FROM account_vault WHERE item_id IN(SELECT id FROM whole_mount_children);
UPDATE companion_wardrobes SET revision=revision+1 WHERE id IN(SELECT id FROM whole_mount_changed);
UPDATE catalog_items SET active=false WHERE id IN(SELECT id FROM whole_mount_children);

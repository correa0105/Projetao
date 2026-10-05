-- Retain edited titles and uploaded fallback art; update only the previous defaults.
UPDATE guild_calendar
SET document = jsonb_set(
  jsonb_set(document, '{title}', CASE WHEN document->>'title' = 'O tempo da Alvorada'
    THEN '"Calendário"'::jsonb ELSE document->'title' END),
  '{background}', CASE WHEN document->>'background' = '/notice-village-empty-v4.png'
    THEN '""'::jsonb ELSE document->'background' END),
  revision = revision + 1, updated_at = now()
WHERE document->>'title' = 'O tempo da Alvorada'
   OR document->>'background' = '/notice-village-empty-v4.png';

-- Legacy maps retained manual fog from before token vision was implemented.
-- Keep reveal strokes so masters can explicitly return to manual mode.
UPDATE vtt_rooms r SET document=jsonb_set(document,'{scenes}',(
  SELECT jsonb_agg(CASE WHEN scene->>'lighting'='false' AND scene->>'fog'='true'
    AND COALESCE(scene->>'fogMode','manual')='manual'
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(scene->'tokens') token WHERE COALESCE((token->>'vision')::numeric,0)>0)
    THEN scene || '{"lighting":true,"ambient":0,"fogMode":"vision"}'::jsonb
    ELSE scene END ORDER BY position)
  FROM jsonb_array_elements(r.document->'scenes') WITH ORDINALITY AS entries(scene,position)
)),revision=revision+1
WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(r.document->'scenes') scene
  WHERE scene->>'lighting'='false' AND scene->>'fog'='true'
  AND COALESCE(scene->>'fogMode','manual')='manual'
  AND EXISTS(SELECT 1 FROM jsonb_array_elements(scene->'tokens') token WHERE COALESCE((token->>'vision')::numeric,0)>0));

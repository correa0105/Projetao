-- Extend the bounded areas without promoting or assigning any account.
ALTER TABLE administrator_scopes DROP CONSTRAINT administrator_scopes_scope_check;
ALTER TABLE administrator_scopes ADD CONSTRAINT administrator_scopes_scope_check
 CHECK (scope IN ('lore','rules','home','world','board','events','tower','vtt'));

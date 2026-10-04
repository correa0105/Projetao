ALTER TABLE "user"
  ADD COLUMN administrador smallint NOT NULL DEFAULT 0
  CHECK (administrador IN (0, 1));

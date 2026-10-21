-- Enrollment is enabled explicitly by the beta deployment. Existing accounts,
-- grants and balances are not rewritten when the feature is installed.
ALTER TABLE beta_accounts ALTER COLUMN initial_gold_cp SET DEFAULT 600000;
CREATE TABLE beta_registration_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT false,
  initial_gold_cp integer NOT NULL DEFAULT 600000 CHECK(initial_gold_cp BETWEEN 0 AND 10000000)
);
INSERT INTO beta_registration_settings(singleton) VALUES(true);
CREATE FUNCTION enroll_open_beta_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO beta_accounts(user_id,cohort,initial_gold_cp)
  SELECT NEW.id,'open-beta-20261021',initial_gold_cp
  FROM beta_registration_settings WHERE singleton=true AND enabled=true
  ON CONFLICT(user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enroll_open_beta_account AFTER INSERT ON "user"
FOR EACH ROW EXECUTE FUNCTION enroll_open_beta_account();

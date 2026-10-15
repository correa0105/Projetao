CREATE TABLE beta_accounts (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  cohort text NOT NULL,
  initial_gold_cp integer NOT NULL DEFAULT 2000000 CHECK(initial_gold_cp BETWEEN 0 AND 10000000),
  granted_character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX beta_accounts_cohort_idx ON beta_accounts(cohort);

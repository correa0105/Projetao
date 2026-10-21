-- Only an authenticated administrator can replace the verified Gmail credential.
-- The application stores an AES-GCM envelope, never the app password in plaintext.
CREATE TABLE recovery_mail_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  credential text NOT NULL,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

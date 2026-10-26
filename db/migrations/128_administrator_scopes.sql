-- Content administration is separate from global administrator privileges.
-- No account is promoted or assigned permissions by this migration.
CREATE TABLE administrator_scopes (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 scope text NOT NULL CHECK(scope IN('lore','rules','home','world')),
 granted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,scope)
);
CREATE TABLE administrator_scope_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 operation text NOT NULL CHECK(operation IN('grant','revoke')),
 scopes text[] NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

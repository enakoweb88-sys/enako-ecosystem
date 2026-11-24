CREATE TABLE vault_access (
  "sessionId" TEXT PRIMARY KEY REFERENCES auth_sessions(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "codeHash" TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "tokenHash" TEXT,
  "unlockedUntil" TIMESTAMPTZ
);
CREATE INDEX vault_access_requested_idx ON vault_access ("requestedAt" DESC);
CREATE TABLE vault_platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE UNIQUE INDEX vault_platforms_name_idx ON vault_platforms (lower(name));
CREATE TABLE vault_configs (
  "platformId" TEXT NOT NULL REFERENCES vault_platforms(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('production', 'staging', 'development')),
  ciphertext TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY ("platformId", environment)
);
DO $$ DECLARE relation_name text; browser_role text; BEGIN
  FOREACH relation_name IN ARRAY ARRAY['vault_access','vault_platforms','vault_configs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', relation_name);
    FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', relation_name, browser_role);
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'enako_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO enako_runtime', relation_name);
      EXECUTE format('CREATE POLICY enako_backend_access ON public.%I FOR ALL TO enako_runtime USING (true) WITH CHECK (true)', relation_name);
    END IF;
  END LOOP;
END $$;

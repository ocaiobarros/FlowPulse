-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Supabase Self-Hosted — Bootstrap Roles                        ║
-- ║  Executado automaticamente no primeiro boot do container DB     ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Supabase requires these roles to exist
DO $$ BEGIN
  CREATE ROLE supabase_admin LOGIN SUPERUSER PASSWORD current_setting('app.settings.jwt_secret', true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD current_setting('app.settings.jwt_secret', true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE supabase_auth_admin NOINHERIT LOGIN PASSWORD current_setting('app.settings.jwt_secret', true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE supabase_storage_admin NOINHERIT LOGIN PASSWORD current_setting('app.settings.jwt_secret', true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_admin TO authenticator;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

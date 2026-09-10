-- Roles and grants: this is where FR-B3 stops being a convention.
--
-- docs/design/architecture-style.md section 8. A lint rule catches an import.
-- It cannot catch a module issuing SQL against another module's tables, because
-- that is a string. A role with no grant makes it impossible rather than
-- detected, which is the strongest mechanism available and therefore the one
-- FR-B6 asks for.
--
-- Written by hand because Prisma does not manage roles. Idempotent, so it is
-- safe to re-run.

-- ---------------------------------------------------------------------------
-- The roles. NOLOGIN: they are targets for SET ROLE and for production
-- credentials granted separately, never accounts with passwords in a repo.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'studens_platform') THEN
    CREATE ROLE studens_platform NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'studens_ref') THEN
    CREATE ROLE studens_ref NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'studens_ryc') THEN
    CREATE ROLE studens_ryc NOLOGIN;
  END IF;
END
$$;

-- Nobody gets anything by default, including through the public schema.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Each role sees its OWN schema and nothing else. The absence of a grant is
-- the control, so there is deliberately no GRANT of platform tables to
-- studens_ryc anywhere in this file.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA platform TO studens_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO studens_platform;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO studens_platform;

GRANT USAGE ON SCHEMA ref TO studens_ref;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ref TO studens_ref;
ALTER DEFAULT PRIVILEGES IN SCHEMA ref GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO studens_ref;

GRANT USAGE ON SCHEMA ryc TO studens_ryc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ryc TO studens_ryc;
ALTER DEFAULT PRIVILEGES IN SCHEMA ryc GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO studens_ryc;

-- ---------------------------------------------------------------------------
-- Feature modules READ the catalogue. FR-B9 and FR-B11: read only, because
-- only ingestion writes it.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA ref TO studens_ryc;
GRANT SELECT ON ALL TABLES IN SCHEMA ref TO studens_ryc;
ALTER DEFAULT PRIVILEGES IN SCHEMA ref GRANT SELECT ON TABLES TO studens_ryc;

-- ---------------------------------------------------------------------------
-- THE ANONYMITY KERNEL, enforced by the database.
--
-- architecture-style.md section 4 argues the critical property should live in a
-- small kernel that can be verified exhaustively, and section 8 left the exact
-- division open as OPEN-39. This is the answer, and it is narrower than a
-- general cross-schema grant:
--
--   Creating an anonymous contribution requires the FR-C13 quota check, which
--   lives on platform.MemberQuota. So the ONLY role that may INSERT into
--   ryc.ReviewAnonymous is studens_platform, which can perform both writes in
--   one transaction (the argument that excluded microservices in section 3).
--
--   studens_ryc may SELECT anonymous reviews in order to display them, and may
--   NOT insert them. So the module that owns the feature cannot bypass the
--   quota, and the exception is one grant rather than an open door.
--
--   UPDATE is the platform's too, because moderation removal (FR-C10) is
--   audited in platform.AuditLog.
--
-- DELETE is granted to nobody. FR-C9 makes anonymous contributions permanent,
-- and FR-C10's removal is a status change, not a delete.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA ryc TO studens_platform;
GRANT INSERT, UPDATE, SELECT ON ryc."ReviewAnonymous" TO studens_platform;
REVOKE INSERT, UPDATE, DELETE ON ryc."ReviewAnonymous" FROM studens_ryc;
REVOKE DELETE ON ryc."ReviewAnonymous" FROM studens_platform;
ALTER DEFAULT PRIVILEGES IN SCHEMA ryc REVOKE DELETE ON TABLES FROM studens_ryc;

-- The attributed path needs no kernel: it carries a member id openly (FR-C7),
-- it is editable by its author (FR-C14), and nothing about it is unlinkable.
-- studens_ryc keeps full control of it.

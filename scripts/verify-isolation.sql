-- Proves the grants in 20260910161500_roles_and_grants actually hold.
--
-- Every check is a SINGLE statement whose expected outcome is asserted, and a
-- surprise anywhere aborts with a non-zero exit. The first version of this
-- file was a false green: every SET ROLE was itself denied, so all nine
-- queries ran as the table owner with full access and the "must fail" cases
-- quietly succeeded. Hence the assertion on current_user at the top of each
-- block: a check that cannot confirm which role it is running as proves
-- nothing at all.

\set ON_ERROR_STOP on
\pset tuples_only on

CREATE OR REPLACE FUNCTION pg_temp.expect_denied(as_role text, stmt text, what text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  actual text;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', as_role);
  SELECT current_user INTO actual;
  IF actual <> as_role THEN
    RAISE EXCEPTION 'cannot assume role % (got %): the check would be vacuous', as_role, actual;
  END IF;
  BEGIN
    EXECUTE stmt;
    RESET ROLE;
    RAISE EXCEPTION 'SECURITY: % was PERMITTED as %, and must not be', what, as_role;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RETURN format('  denied, correct   %-52s [%s]', what, as_role);
  END;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_allowed(as_role text, stmt text, what text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  actual text;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', as_role);
  SELECT current_user INTO actual;
  IF actual <> as_role THEN
    RAISE EXCEPTION 'cannot assume role % (got %): the check would be vacuous', as_role, actual;
  END IF;
  EXECUTE stmt;
  RESET ROLE;
  RETURN format('  allowed, correct  %-52s [%s]', what, as_role);
END
$$;

BEGIN;

-- The boundary FR-B3 exists for: a feature module cannot see platform data.
SELECT pg_temp.expect_denied('studens_ryc', 'SELECT 1 FROM platform."Member"',
  'read platform.Member');
SELECT pg_temp.expect_denied('studens_ryc', 'SELECT 1 FROM platform."MemberQuota"',
  'read the quota counter');
SELECT pg_temp.expect_denied('studens_ryc', 'SELECT 1 FROM platform."Session"',
  'read sessions');
SELECT pg_temp.expect_denied('studens_ryc', 'SELECT 1 FROM platform."AuditLog"',
  'read the audit log');

-- And the reverse: the platform does not read a feature module's own data.
SELECT pg_temp.expect_denied('studens_platform', 'SELECT 1 FROM ryc."ReviewAttributed"',
  'read attributed reviews');

-- The catalogue is readable by feature modules and writable only by ingestion.
SELECT pg_temp.expect_allowed('studens_ryc', 'SELECT 1 FROM ref."Course" LIMIT 1',
  'read the catalogue');
SELECT pg_temp.expect_denied('studens_ryc',
  $$INSERT INTO ref."Course"(id,code) VALUES ('probe','zzzz9999')$$,
  'write the catalogue');
SELECT pg_temp.expect_allowed('studens_ref',
  $$INSERT INTO ref."Course"(id,code) VALUES ('probe','zzzz9999')$$,
  'ingest a course');

-- THE ANONYMITY KERNEL (OPEN-39). Only the platform may create an anonymous
-- contribution, because only the platform can perform the FR-C13 quota check
-- in the same transaction. The module that owns the feature cannot bypass it.
SELECT pg_temp.expect_allowed('studens_ryc', 'SELECT 1 FROM ryc."ReviewAnonymous" LIMIT 1',
  'read anonymous reviews');
SELECT pg_temp.expect_denied('studens_ryc',
  $$INSERT INTO ryc."ReviewAnonymous"(id,"courseId","academicYear",recommendation,"workloadVsEcts",difficulty,body,"createdAt")
    VALUES ('probe','probe',2025,4,3,3,'bypassing the quota','2026-09-10')$$,
  'insert an anonymous review');
SELECT pg_temp.expect_allowed('studens_platform',
  $$INSERT INTO ryc."ReviewAnonymous"(id,"courseId","academicYear",recommendation,"workloadVsEcts",difficulty,body,"createdAt")
    VALUES ('probe','probe',2025,4,3,3,'written through the kernel','2026-09-10')$$,
  'insert through the kernel');

-- FR-C9: permanent for everyone, so DELETE is granted to nobody.
SELECT pg_temp.expect_denied('studens_platform',
  $$DELETE FROM ryc."ReviewAnonymous" WHERE id='probe'$$,
  'delete an anonymous review');
SELECT pg_temp.expect_denied('studens_ryc',
  $$DELETE FROM ryc."ReviewAnonymous" WHERE id='probe'$$,
  'delete an anonymous review');

-- FR-C10: removal is a status change, and it is the platform's because it is
-- audited there.
SELECT pg_temp.expect_allowed('studens_platform',
  $$UPDATE ryc."ReviewAnonymous" SET status='removed' WHERE id='probe'$$,
  'moderate an anonymous review');

ROLLBACK;

\echo ''
\echo 'isolation verified: every grant and every absent grant behaves as intended'

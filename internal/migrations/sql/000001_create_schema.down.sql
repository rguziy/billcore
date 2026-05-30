BEGIN;

-- =============================================================
--  BillCore — rollback initial schema
--  Drops the entire billcore schema and all objects within it.
-- =============================================================

DROP SCHEMA IF EXISTS billcore CASCADE;

COMMIT;

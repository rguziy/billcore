-- --------------------------------------------------------------
-- Down migration: remove audit‑column triggers and function
-- --------------------------------------------------------------

/* 1️⃣ Drop the trigger from every table that has both audit columns in billcore schema */
DO $$
DECLARE
    rec RECORD;
    sql TEXT;
BEGIN
    FOR rec IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE column_name IN ('created_by', 'updated_by')
          AND table_schema = 'billcore'
        GROUP BY table_schema, table_name
        HAVING COUNT(DISTINCT column_name) = 2
    LOOP
        sql := format(
            'DROP TRIGGER IF EXISTS trg_audit_%I ON %I.%I;',
            rec.table_name, rec.table_schema, rec.table_name
        );
        EXECUTE sql;
    END LOOP;
END $$;

/* 2️⃣ Drop the trigger function */
DROP FUNCTION IF EXISTS set_created_updated_by();

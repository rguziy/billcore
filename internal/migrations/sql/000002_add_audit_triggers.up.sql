-- --------------------------------------------------------------
-- Up migration: create audit‑column triggers (Fixed for billcore schema)
-- --------------------------------------------------------------

/* 1️⃣ Safe trigger function – writes only when the GUC is set and valid */
CREATE OR REPLACE FUNCTION set_created_updated_by()
RETURNS TRIGGER AS $$
DECLARE
    user_setting TEXT;
    user_id BIGINT;
BEGIN
    -- Get setting as text first to handle empty strings or missing GUC safely
    user_setting := current_setting('app.billcore_user', true);

    -- Skip if GUC is not set, empty, or not a numeric value
    IF user_setting IS NULL OR user_setting = '' OR user_setting !~ '^[0-9]+$' THEN
        RETURN NEW;
    END IF;

    user_id := user_setting::BIGINT;

    IF TG_OP = 'INSERT' THEN
        -- Only set if not explicitly provided in the insert statement
        IF NEW.created_by IS NULL THEN
            NEW.created_by := user_id;
        END IF;
        IF NEW.updated_by IS NULL THEN
            NEW.updated_by := user_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.updated_by := user_id;
    END IF;

    RETURN NEW;
END;$$ LANGUAGE plpgsql;

/* 2️⃣ Attach the trigger to every table that has both audit columns in billcore schema */
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
        HAVING COUNT(DISTINCT column_name) = 2   -- Both columns must exist
    LOOP
        sql := format(
            $f$
            DROP TRIGGER IF EXISTS trg_audit_%I ON %I.%I;
            CREATE TRIGGER trg_audit_%I
                BEFORE INSERT OR UPDATE ON %I.%I
                FOR EACH ROW EXECUTE FUNCTION set_created_updated_by();
            $f$,
            rec.table_name, rec.table_schema, rec.table_name,
            rec.table_name, rec.table_schema, rec.table_name
        );
        EXECUTE sql;
        -- Log attached tables for visibility during migration run
        RAISE NOTICE 'Attached audit trigger to table: %.%', rec.table_schema, rec.table_name;
    END LOOP;
END $$;

BEGIN;

ALTER TABLE billcore.periods       DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by;
ALTER TABLE billcore.calculations  DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by;
ALTER TABLE billcore.subscriptions DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by;
ALTER TABLE billcore.tariffs       DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by;
ALTER TABLE billcore.services      DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by;
ALTER TABLE billcore.locations     DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by;
ALTER TABLE billcore.clients       DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by;

DROP TABLE IF EXISTS billcore.users;
DROP TYPE  IF EXISTS billcore.user_role;

COMMIT;

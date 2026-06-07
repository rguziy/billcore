BEGIN;

DELETE FROM billcore.users WHERE username = 'manager' AND email = 'manager@billcore.local';

-- Note: PostgreSQL does not support removing enum values.
-- To fully remove 'manager' role, recreate the enum type manually.

COMMIT;

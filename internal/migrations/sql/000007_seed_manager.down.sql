BEGIN;

DELETE FROM billcore.users WHERE username = 'manager' AND email = 'manager@billcore.local';

COMMIT;

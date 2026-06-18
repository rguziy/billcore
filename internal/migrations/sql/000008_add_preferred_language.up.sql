BEGIN;

ALTER TABLE billcore.users
    ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'en';

COMMIT;

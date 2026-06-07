BEGIN;

ALTER TYPE billcore.user_role ADD VALUE IF NOT EXISTS 'manager';

COMMIT;

BEGIN;

-- Seed manager user (password: manager)
INSERT INTO billcore.users (username, email, password_hash, role)
VALUES (
    'manager',
    'manager@billcore.local',
    '$2b$12$cw40UuNtsx3fRQrZH/2mOO4qEZ/cs6hdeTfsIN4VBt5b83wtYgrrS',
    'manager'
) ON CONFLICT (username) DO NOTHING;

COMMIT;

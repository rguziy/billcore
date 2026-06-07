BEGIN;

INSERT INTO billcore.users (username, email, password_hash, role)
VALUES (
    'manager',
    'manager@billcore.local',
    '$2a$10$iublAYO7bVD1nTpaSbwpkuXOtpGrARnrky9PkqmXO6Nl.b0i8IoFa',
    'manager'
) ON CONFLICT (username) DO NOTHING;

COMMIT;

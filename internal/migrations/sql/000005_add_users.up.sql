BEGIN;

-- -----------------------------------------------------------
-- User roles enum
-- -----------------------------------------------------------
CREATE TYPE billcore.user_role AS ENUM ('admin', 'operator');

-- -----------------------------------------------------------
-- users
-- -----------------------------------------------------------
CREATE TABLE billcore.users (
    id            SERIAL                  PRIMARY KEY,
    username      TEXT                    NOT NULL UNIQUE,
    email         TEXT                    UNIQUE,
    password_hash TEXT                    NOT NULL,
    role          billcore.user_role      NOT NULL DEFAULT 'operator',
    is_active     BOOLEAN                 NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON billcore.users
    FOR EACH ROW EXECUTE FUNCTION billcore.set_updated_at();

-- -----------------------------------------------------------
-- Seed: admin user (password: admin)
-- bcrypt hash of 'admin' with cost 12
-- -----------------------------------------------------------
INSERT INTO billcore.users (username, email, password_hash, role)
VALUES (
    'admin',
    'admin@billcore.local',
    '$2b$12$cw40UuNtsx3fRQrZH/2mOO4qEZ/cs6hdeTfsIN4VBt5b83wtYgrrS',
    'admin'
);

-- -----------------------------------------------------------
-- Add created_by / updated_by to all main tables
-- Nullable — existing rows have no author
-- -----------------------------------------------------------

ALTER TABLE billcore.clients
    ADD COLUMN created_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL,
    ADD COLUMN updated_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL;

ALTER TABLE billcore.locations
    ADD COLUMN created_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL,
    ADD COLUMN updated_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL;

ALTER TABLE billcore.services
    ADD COLUMN created_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL,
    ADD COLUMN updated_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL;

ALTER TABLE billcore.tariffs
    ADD COLUMN created_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL,
    ADD COLUMN updated_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL;

ALTER TABLE billcore.subscriptions
    ADD COLUMN created_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL,
    ADD COLUMN updated_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL;

ALTER TABLE billcore.calculations
    ADD COLUMN created_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL,
    ADD COLUMN updated_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL;

ALTER TABLE billcore.periods
    ADD COLUMN created_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL,
    ADD COLUMN updated_by INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL;

COMMIT;

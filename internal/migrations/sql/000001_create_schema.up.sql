BEGIN;

-- =============================================================
--  BillCore — initial schema  (v1.0.0)
--  https://github.com/rguziy/billcore
--  License: MIT
-- =============================================================


-- -----------------------------------------------------------
-- Schema
-- -----------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS billcore;


-- -----------------------------------------------------------
-- Enums
-- -----------------------------------------------------------

CREATE TYPE billcore.calculation_status AS ENUM (
    'pending',    -- accrued, not yet paid
    'paid',       -- fully paid
    'cancelled'   -- cancelled / written off
);

CREATE TYPE billcore.period_status AS ENUM ('open', 'closed');

CREATE TYPE billcore.user_role AS ENUM ('admin', 'operator', 'manager');


-- -----------------------------------------------------------
-- users
-- -----------------------------------------------------------

CREATE TABLE billcore.users (
    id                 SERIAL              PRIMARY KEY,
    username           TEXT                NOT NULL UNIQUE,
    email              TEXT                UNIQUE,
    password_hash      TEXT                NOT NULL,
    role               billcore.user_role  NOT NULL DEFAULT 'operator',
    is_active          BOOLEAN             NOT NULL DEFAULT TRUE,
    preferred_language TEXT                NOT NULL DEFAULT 'en',
    created_at         TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------
-- clients
-- -----------------------------------------------------------

CREATE TABLE billcore.clients (
    id             SERIAL       PRIMARY KEY,
    full_name      TEXT         NOT NULL,
    phone          TEXT,
    email          TEXT,
    account_number TEXT         NOT NULL UNIQUE,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by     INTEGER      REFERENCES billcore.users(id) ON DELETE SET NULL,
    updated_by     INTEGER      REFERENCES billcore.users(id) ON DELETE SET NULL
);


-- -----------------------------------------------------------
-- locations
-- -----------------------------------------------------------

CREATE TABLE billcore.locations (
    id         SERIAL       PRIMARY KEY,
    client_id  INTEGER      NOT NULL REFERENCES billcore.clients(id) ON DELETE CASCADE,
    name       TEXT         NOT NULL,
    address    TEXT,
    is_default BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by INTEGER      REFERENCES billcore.users(id) ON DELETE SET NULL,
    updated_by INTEGER      REFERENCES billcore.users(id) ON DELETE SET NULL
);

-- Only one default location per client
CREATE UNIQUE INDEX idx_locations_one_default
    ON billcore.locations(client_id)
    WHERE is_default = TRUE;


-- -----------------------------------------------------------
-- services
-- -----------------------------------------------------------

CREATE TABLE billcore.services (
    id         SERIAL   PRIMARY KEY,
    name       TEXT     NOT NULL UNIQUE,
    unit       TEXT     NOT NULL,
    has_meter  BOOLEAN  NOT NULL DEFAULT FALSE,
    created_by INTEGER  REFERENCES billcore.users(id) ON DELETE SET NULL,
    updated_by INTEGER  REFERENCES billcore.users(id) ON DELETE SET NULL
);


-- -----------------------------------------------------------
-- tariffs
-- -----------------------------------------------------------

CREATE TABLE billcore.tariffs (
    id             SERIAL        PRIMARY KEY,
    service_id     INTEGER       NOT NULL REFERENCES billcore.services(id) ON DELETE RESTRICT,
    price_per_unit NUMERIC(12,4) NOT NULL CHECK (price_per_unit >= 0),
    valid_from     DATE          NOT NULL,
    valid_to       DATE,
    note           TEXT,
    created_by     INTEGER       REFERENCES billcore.users(id) ON DELETE SET NULL,
    updated_by     INTEGER       REFERENCES billcore.users(id) ON DELETE SET NULL,
    CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- Only one active tariff per service at a time
CREATE UNIQUE INDEX idx_tariffs_one_active
    ON billcore.tariffs(service_id)
    WHERE valid_to IS NULL;

CREATE INDEX idx_tariffs_service_period
    ON billcore.tariffs(service_id, valid_from);


-- -----------------------------------------------------------
-- subscriptions
-- -----------------------------------------------------------

CREATE TABLE billcore.subscriptions (
    id              SERIAL  PRIMARY KEY,
    location_id     INTEGER NOT NULL REFERENCES billcore.locations(id) ON DELETE RESTRICT,
    service_id      INTEGER NOT NULL REFERENCES billcore.services(id)  ON DELETE RESTRICT,
    meter_number    TEXT,
    connected_at    DATE    NOT NULL DEFAULT CURRENT_DATE,
    disconnected_at DATE,
    note            TEXT,
    created_by      INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL,
    updated_by      INTEGER REFERENCES billcore.users(id) ON DELETE SET NULL,
    CHECK (disconnected_at IS NULL OR disconnected_at > connected_at),
    UNIQUE (location_id, service_id, connected_at)
);

CREATE INDEX idx_subscriptions_location ON billcore.subscriptions(location_id);
CREATE INDEX idx_subscriptions_service  ON billcore.subscriptions(service_id);


-- -----------------------------------------------------------
-- periods
-- -----------------------------------------------------------

CREATE TABLE billcore.periods (
    id           SERIAL                  PRIMARY KEY,
    period_start DATE                    NOT NULL UNIQUE
                 CHECK (date_part('day', period_start) = 1),
    period_end   DATE                    NOT NULL,
    status       billcore.period_status  NOT NULL DEFAULT 'open',
    created_at   TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    created_by   INTEGER                 REFERENCES billcore.users(id) ON DELETE SET NULL,
    updated_by   INTEGER                 REFERENCES billcore.users(id) ON DELETE SET NULL,
    CHECK (period_end > period_start)
);

CREATE INDEX idx_periods_status ON billcore.periods(status);


-- -----------------------------------------------------------
-- calculations
-- -----------------------------------------------------------

CREATE TABLE billcore.calculations (
    id              SERIAL                       PRIMARY KEY,
    subscription_id INTEGER                      NOT NULL REFERENCES billcore.subscriptions(id) ON DELETE RESTRICT,
    tariff_id       INTEGER                      NOT NULL REFERENCES billcore.tariffs(id)        ON DELETE RESTRICT,
    period_id       INTEGER                      NOT NULL REFERENCES billcore.periods(id)         ON DELETE RESTRICT,
    reading_prev    NUMERIC(20,6),
    reading_curr    NUMERIC(20,6),
    quantity        NUMERIC(20,6)                NOT NULL CHECK (quantity >= 0),
    amount          NUMERIC(12,2)                NOT NULL CHECK (amount >= 0),
    status          billcore.calculation_status  NOT NULL DEFAULT 'pending',
    note            TEXT,
    created_at      TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    created_by      INTEGER                      REFERENCES billcore.users(id) ON DELETE SET NULL,
    updated_by      INTEGER                      REFERENCES billcore.users(id) ON DELETE SET NULL,
    UNIQUE (subscription_id, period_id)
);

CREATE INDEX idx_calculations_subscription_period
    ON billcore.calculations(subscription_id, period_id DESC);

CREATE INDEX idx_calculations_pending
    ON billcore.calculations(status)
    WHERE status = 'pending';


-- -----------------------------------------------------------
-- Trigger: keep updated_at current on every UPDATE
-- -----------------------------------------------------------

CREATE OR REPLACE FUNCTION billcore.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON billcore.clients
    FOR EACH ROW EXECUTE FUNCTION billcore.set_updated_at();

CREATE TRIGGER trg_calculations_updated_at
    BEFORE UPDATE ON billcore.calculations
    FOR EACH ROW EXECUTE FUNCTION billcore.set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON billcore.users
    FOR EACH ROW EXECUTE FUNCTION billcore.set_updated_at();


-- -----------------------------------------------------------
-- View: current balance per client
-- -----------------------------------------------------------

CREATE VIEW billcore.v_client_balance AS
SELECT
    cl.id                                                                AS client_id,
    cl.full_name,
    cl.account_number,
    COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'pending'),  0)     AS debt,
    COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'paid'),     0)     AS paid_total,
    COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'pending'),  0)
        - COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'paid'), 0)   AS balance
FROM billcore.clients cl
LEFT JOIN billcore.locations     l   ON l.client_id       = cl.id
LEFT JOIN billcore.subscriptions s   ON s.location_id     = l.id
LEFT JOIN billcore.calculations  c   ON c.subscription_id = s.id
GROUP BY cl.id, cl.full_name, cl.account_number;


-- -----------------------------------------------------------
-- View: latest meter reading per subscription
-- -----------------------------------------------------------

CREATE VIEW billcore.v_latest_readings AS
SELECT DISTINCT ON (c.subscription_id)
    s.id            AS subscription_id,
    s.meter_number,
    sv.name         AS service_name,
    sv.unit,
    per.period_start,
    c.reading_prev,
    c.reading_curr,
    c.quantity,
    c.amount,
    c.status
FROM billcore.calculations  c
JOIN billcore.subscriptions s   ON s.id   = c.subscription_id
JOIN billcore.services      sv  ON sv.id  = s.service_id
JOIN billcore.periods       per ON per.id = c.period_id
WHERE sv.has_meter = TRUE
ORDER BY c.subscription_id, per.period_start DESC;


-- -----------------------------------------------------------
-- Seed: default users
-- -----------------------------------------------------------

INSERT INTO billcore.users (username, email, password_hash, role) VALUES
    ('admin',   'admin@billcore.local',   '$2b$12$cw40UuNtsx3fRQrZH/2mOO4qEZ/cs6hdeTfsIN4VBt5b83wtYgrrS', 'admin'),
    ('manager', 'manager@billcore.local', '$2a$10$iublAYO7bVD1nTpaSbwpkuXOtpGrARnrky9PkqmXO6Nl.b0i8IoFa', 'manager')
ON CONFLICT (username) DO NOTHING;


COMMIT;
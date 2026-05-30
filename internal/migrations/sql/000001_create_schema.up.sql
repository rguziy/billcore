BEGIN;

-- =============================================================
--  BillCore — initial schema
--  https://github.com/rguziy/billcore
--  License: MIT
-- =============================================================

CREATE SCHEMA IF NOT EXISTS billcore;

-- -----------------------------------------------------------
-- Enum: calculation lifecycle status
-- -----------------------------------------------------------

CREATE TYPE billcore.calculation_status AS ENUM (
    'pending',    -- accrued, not yet paid
    'paid',       -- fully paid
    'cancelled'   -- cancelled / written off
);

-- -----------------------------------------------------------
-- Enum: payment method
-- -----------------------------------------------------------

CREATE TYPE billcore.payment_method AS ENUM (
    'cash',
    'card',
    'bank_transfer',
    'online'
);

-- -----------------------------------------------------------
-- clients
-- A natural person or legal entity (subscriber).
-- -----------------------------------------------------------

CREATE TABLE billcore.clients (
    id             SERIAL        PRIMARY KEY,
    full_name      TEXT          NOT NULL,
    phone          TEXT,
    email          TEXT,
    account_number TEXT          NOT NULL UNIQUE,  -- personal account number
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- locations
-- A physical object belonging to a client:
-- apartment, cottage, office, etc.
-- -----------------------------------------------------------

CREATE TABLE billcore.locations (
    id         SERIAL       PRIMARY KEY,
    client_id  INTEGER      NOT NULL REFERENCES billcore.clients(id) ON DELETE CASCADE,
    name       TEXT         NOT NULL,  -- e.g. "Apartment", "Cottage", "Office #3"
    address    TEXT,
    is_default BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Only one default location per client
CREATE UNIQUE INDEX idx_locations_one_default
    ON billcore.locations(client_id)
    WHERE is_default = TRUE;

-- -----------------------------------------------------------
-- services
-- Service catalogue: cold water, electricity, internet, etc.
-- -----------------------------------------------------------

CREATE TABLE billcore.services (
    id        SERIAL   PRIMARY KEY,
    name      TEXT     NOT NULL UNIQUE,
    unit      TEXT     NOT NULL,           -- "m³", "kWh", "month", "pcs"
    has_meter BOOLEAN  NOT NULL DEFAULT FALSE  -- whether a meter reading is required
);

-- -----------------------------------------------------------
-- tariffs
-- Pricing history for a service.
-- valid_to = NULL means the tariff is currently active.
-- -----------------------------------------------------------

CREATE TABLE billcore.tariffs (
    id             SERIAL        PRIMARY KEY,
    service_id     INTEGER       NOT NULL REFERENCES billcore.services(id) ON DELETE RESTRICT,
    price_per_unit NUMERIC(12,4) NOT NULL CHECK (price_per_unit >= 0),
    valid_from     DATE          NOT NULL,
    valid_to       DATE,
    note           TEXT,
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
-- A service connected to a client's location.
-- disconnected_at = NULL means the subscription is active.
-- -----------------------------------------------------------

CREATE TABLE billcore.subscriptions (
    id              SERIAL  PRIMARY KEY,
    location_id     INTEGER NOT NULL REFERENCES billcore.locations(id) ON DELETE RESTRICT,
    service_id      INTEGER NOT NULL REFERENCES billcore.services(id)  ON DELETE RESTRICT,
    meter_number    TEXT,               -- meter serial number (when has_meter = true)
    connected_at    DATE    NOT NULL DEFAULT CURRENT_DATE,
    disconnected_at DATE,
    note            TEXT,
    CHECK (disconnected_at IS NULL OR disconnected_at > connected_at),
    UNIQUE (location_id, service_id, connected_at)
);

CREATE INDEX idx_subscriptions_location ON billcore.subscriptions(location_id);
CREATE INDEX idx_subscriptions_service  ON billcore.subscriptions(service_id);

-- -----------------------------------------------------------
-- calculations
-- Monthly accrual for a subscription.
-- period_start is always the 1st day of the month.
-- Partition by period_start when row count exceeds ~1M.
-- -----------------------------------------------------------

CREATE TABLE billcore.calculations (
    id              SERIAL                       PRIMARY KEY,
    subscription_id INTEGER                      NOT NULL REFERENCES billcore.subscriptions(id) ON DELETE RESTRICT,
    tariff_id       INTEGER                      NOT NULL REFERENCES billcore.tariffs(id)        ON DELETE RESTRICT,
    period_start    DATE                         NOT NULL CHECK (date_part('day', period_start) = 1),
    reading_prev    NUMERIC(20,6),               -- previous meter reading (NULL when has_meter = false)
    reading_curr    NUMERIC(20,6),               -- current meter reading
    quantity        NUMERIC(20,6)                NOT NULL CHECK (quantity >= 0),
    amount          NUMERIC(12,2)                NOT NULL CHECK (amount >= 0),
    status          billcore.calculation_status  NOT NULL DEFAULT 'pending',
    note            TEXT,                        -- e.g. "paid until 2026-09-01", "prepaid Q2"
    created_at      TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, period_start)
);

CREATE INDEX idx_calculations_subscription_period
    ON billcore.calculations(subscription_id, period_start DESC);

-- Partial index: fast lookup of unpaid accruals
CREATE INDEX idx_calculations_pending
    ON billcore.calculations(status)
    WHERE status = 'pending';

-- -----------------------------------------------------------
-- payments
-- A payment from a client.
-- calculation_id = NULL allows advance (prepaid) payments.
-- -----------------------------------------------------------

CREATE TABLE billcore.payments (
    id             SERIAL                   PRIMARY KEY,
    client_id      INTEGER                  NOT NULL REFERENCES billcore.clients(id)       ON DELETE RESTRICT,
    calculation_id INTEGER                  REFERENCES billcore.calculations(id) ON DELETE SET NULL,
    amount         NUMERIC(12,2)            NOT NULL CHECK (amount > 0),
    method         billcore.payment_method  NOT NULL DEFAULT 'cash',
    paid_at        TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
    note           TEXT
);

CREATE INDEX idx_payments_client      ON billcore.payments(client_id);
CREATE INDEX idx_payments_calculation ON billcore.payments(calculation_id);

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

-- -----------------------------------------------------------
-- View: current balance per client
-- balance > 0 means the client owes money
-- -----------------------------------------------------------

CREATE VIEW billcore.v_client_balance AS
SELECT
    c.id                                                                        AS client_id,
    c.full_name,
    c.account_number,
    COALESCE(SUM(calc.amount) FILTER (WHERE calc.status = 'pending'), 0)        AS debt,
    COALESCE(SUM(p.amount), 0)                                                  AS paid_total,
    COALESCE(SUM(calc.amount) FILTER (WHERE calc.status = 'pending'), 0)
        - COALESCE(SUM(p.amount), 0)                                            AS balance
FROM billcore.clients c
LEFT JOIN billcore.payments      p    ON p.client_id      = c.id
LEFT JOIN billcore.locations     l    ON l.client_id      = c.id
LEFT JOIN billcore.subscriptions s    ON s.location_id    = l.id
LEFT JOIN billcore.calculations  calc ON calc.subscription_id = s.id
GROUP BY c.id, c.full_name, c.account_number;

-- -----------------------------------------------------------
-- View: latest meter reading per subscription
-- -----------------------------------------------------------

CREATE VIEW billcore.v_latest_readings AS
SELECT DISTINCT ON (c.subscription_id)
    s.id            AS subscription_id,
    s.meter_number,
    sv.name         AS service_name,
    sv.unit,
    c.period_start,
    c.reading_prev,
    c.reading_curr,
    c.quantity,
    c.amount,
    c.status
FROM billcore.calculations  c
JOIN billcore.subscriptions s  ON s.id  = c.subscription_id
JOIN billcore.services      sv ON sv.id = s.service_id
WHERE sv.has_meter = TRUE
ORDER BY c.subscription_id, c.period_start DESC;

COMMIT;

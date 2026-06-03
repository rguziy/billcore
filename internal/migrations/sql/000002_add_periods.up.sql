BEGIN;

-- -----------------------------------------------------------
-- periods
-- Billing period. status: open = editable, closed = locked.
-- -----------------------------------------------------------

CREATE TYPE billcore.period_status AS ENUM ('open', 'closed');

CREATE TABLE billcore.periods (
    id           SERIAL                     PRIMARY KEY,
    period_start DATE                       NOT NULL UNIQUE
                 CHECK (date_part('day', period_start) = 1),
    period_end   DATE                       NOT NULL,
    status       billcore.period_status     NOT NULL DEFAULT 'open',
    created_at   TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    CHECK (period_end > period_start)
);

CREATE INDEX idx_periods_status ON billcore.periods(status);

-- -----------------------------------------------------------
-- calculations: replace period_start with period_id FK
-- Existing rows: create a period for each distinct period_start
-- -----------------------------------------------------------

-- Step 1: insert a period row for every existing period_start
INSERT INTO billcore.periods (period_start, period_end, status)
SELECT DISTINCT
    period_start,
    (period_start + INTERVAL '1 month - 1 day')::DATE,
    'closed'::billcore.period_status
FROM billcore.calculations
ON CONFLICT (period_start) DO NOTHING;

-- Step 2: add nullable period_id column
ALTER TABLE billcore.calculations
    ADD COLUMN period_id INTEGER REFERENCES billcore.periods(id) ON DELETE RESTRICT;

-- Step 3: fill period_id from existing period_start values
UPDATE billcore.calculations c
SET period_id = p.id
FROM billcore.periods p
WHERE p.period_start = c.period_start;

-- Step 4: make period_id NOT NULL and drop old column
ALTER TABLE billcore.calculations
    ALTER COLUMN period_id SET NOT NULL;

ALTER TABLE billcore.calculations
    DROP COLUMN period_start CASCADE;

-- Step 5: unique constraint now uses period_id
ALTER TABLE billcore.calculations
    DROP CONSTRAINT IF EXISTS calculations_subscription_id_period_start_key;

ALTER TABLE billcore.calculations
    ADD CONSTRAINT calculations_subscription_id_period_id_key
    UNIQUE (subscription_id, period_id);

-- Step 6: update index
DROP INDEX IF EXISTS billcore.idx_calculations_subscription_period;

CREATE INDEX idx_calculations_subscription_period
    ON billcore.calculations(subscription_id, period_id DESC);

COMMIT;

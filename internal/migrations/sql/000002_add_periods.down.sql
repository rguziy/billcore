BEGIN;

-- Restore period_start column from periods table
ALTER TABLE billcore.calculations
    ADD COLUMN period_start DATE;

UPDATE billcore.calculations c
SET period_start = p.period_start
FROM billcore.periods p
WHERE p.id = c.period_id;

ALTER TABLE billcore.calculations
    ALTER COLUMN period_start SET NOT NULL;

ALTER TABLE billcore.calculations
    DROP CONSTRAINT IF EXISTS calculations_subscription_id_period_id_key;

ALTER TABLE billcore.calculations
    ADD CONSTRAINT calculations_subscription_id_period_start_key
    UNIQUE (subscription_id, period_start);

DROP INDEX IF EXISTS billcore.idx_calculations_subscription_period;

CREATE INDEX idx_calculations_subscription_period
    ON billcore.calculations(subscription_id, period_start DESC);

ALTER TABLE billcore.calculations
    DROP COLUMN period_id;

DROP TABLE IF EXISTS billcore.periods;

DROP TYPE IF EXISTS billcore.period_status;

COMMIT;

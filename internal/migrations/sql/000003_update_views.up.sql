BEGIN;

-- Update v_client_balance: calculations no longer have period_start
DROP VIEW IF EXISTS billcore.v_latest_readings;
DROP VIEW IF EXISTS billcore.v_client_balance;

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

-- Update v_latest_readings: join periods to get period_start
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
JOIN billcore.subscriptions s   ON s.id    = c.subscription_id
JOIN billcore.services      sv  ON sv.id   = s.service_id
JOIN billcore.periods       per ON per.id  = c.period_id
WHERE sv.has_meter = TRUE
ORDER BY c.subscription_id, per.period_start DESC;

COMMIT;

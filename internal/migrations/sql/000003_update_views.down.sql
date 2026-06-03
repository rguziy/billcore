BEGIN;

-- Restore original views (period_start on calculations)
CREATE OR REPLACE VIEW billcore.v_client_balance AS
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

CREATE OR REPLACE VIEW billcore.v_latest_readings AS
SELECT DISTINCT ON (subscription_id)
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
ORDER BY subscription_id, period_start DESC;

COMMIT;

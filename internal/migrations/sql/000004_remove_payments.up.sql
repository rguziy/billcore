BEGIN;

DROP TABLE IF EXISTS billcore.payments CASCADE;

-- Rebuild v_client_balance based on calculation status only
DROP VIEW IF EXISTS billcore.v_client_balance;

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
LEFT JOIN billcore.locations     l   ON l.client_id      = cl.id
LEFT JOIN billcore.subscriptions s   ON s.location_id    = l.id
LEFT JOIN billcore.calculations  c   ON c.subscription_id = s.id
GROUP BY cl.id, cl.full_name, cl.account_number;

COMMIT;

BEGIN;

CREATE TABLE billcore.payments (
    id             SERIAL                   PRIMARY KEY,
    client_id      INTEGER                  NOT NULL REFERENCES billcore.clients(id) ON DELETE RESTRICT,
    calculation_id INTEGER                  REFERENCES billcore.calculations(id) ON DELETE SET NULL,
    amount         NUMERIC(12,2)            NOT NULL CHECK (amount > 0),
    method         billcore.payment_method  NOT NULL DEFAULT 'cash',
    paid_at        TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
    note           TEXT
);

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

COMMIT;

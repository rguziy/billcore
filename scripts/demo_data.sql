-- =============================================================
--  BillCore — demo data
--  Run with: make demo-data
--  Creates: 5 clients, 10 services, locations, subscriptions,
--           3 billing periods with partial payments
-- =============================================================

BEGIN;

-- -----------------------------------------------------------
-- Services & Tariffs
-- -----------------------------------------------------------

INSERT INTO billcore.services (name, unit, has_meter) VALUES
    ('Cold Water',          'm³',    true),
    ('Hot Water',           'm³',    true),
    ('Electricity',         'kWh',   true),
    ('Natural Gas',         'm³',    true),
    ('Heating',             'Gcal',  true),
    ('Hot Water Drainage',  'month', false),
    ('Building Maintenance','month', false),
    ('Internet',            'month', false),
    ('Intercom',            'month', false),
    ('Garbage Collection',  'month', false)
ON CONFLICT (name) DO NOTHING;

-- Tariffs for metered services
INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 28.50,  '2024-01-01' FROM billcore.services WHERE name = 'Cold Water'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 89.20,  '2024-01-01' FROM billcore.services WHERE name = 'Hot Water'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 4.32,   '2024-01-01' FROM billcore.services WHERE name = 'Electricity'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 7.99,   '2024-01-01' FROM billcore.services WHERE name = 'Natural Gas'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 1654.41,'2024-01-01' FROM billcore.services WHERE name = 'Heating'
ON CONFLICT DO NOTHING;

-- Tariffs for flat-rate services
INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 6.93,   '2024-01-01' FROM billcore.services WHERE name = 'Hot Water Drainage'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 12.35,  '2024-01-01' FROM billcore.services WHERE name = 'Building Maintenance'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 245.00, '2024-01-01' FROM billcore.services WHERE name = 'Internet'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 55.00,  '2024-01-01' FROM billcore.services WHERE name = 'Intercom'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from)
SELECT id, 38.00,  '2024-01-01' FROM billcore.services WHERE name = 'Garbage Collection'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------
-- Clients
-- -----------------------------------------------------------

INSERT INTO billcore.clients (full_name, phone, email, account_number) VALUES
    ('Alice Johnson',   '+1-555-0101', 'alice@example.com',   'BC-10000001'),
    ('Bob Martinez',    '+1-555-0102', 'bob@example.com',     'BC-10000002'),
    ('Carol Williams',  '+1-555-0103', 'carol@example.com',   'BC-10000003'),
    ('David Chen',      '+1-555-0104', 'david@example.com',   'BC-10000004'),
    ('Emma Thompson',   '+1-555-0105', 'emma@example.com',    'BC-10000005')
ON CONFLICT (account_number) DO NOTHING;

-- -----------------------------------------------------------
-- Locations
-- -----------------------------------------------------------

INSERT INTO billcore.locations (client_id, name, address, is_default)
SELECT id, 'Apartment', '12 Oak Street, Apt 4B', true
FROM billcore.clients WHERE account_number = 'BC-10000001'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.locations (client_id, name, address, is_default)
SELECT id, 'Apartment', '7 Maple Avenue, Apt 2A', true
FROM billcore.clients WHERE account_number = 'BC-10000002'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.locations (client_id, name, address, is_default)
SELECT id, 'Apartment', '33 Pine Road, Apt 7C', true
FROM billcore.clients WHERE account_number = 'BC-10000003'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.locations (client_id, name, address, is_default)
SELECT id, 'Apartment', '8 Birch Lane, Apt 1D', true
FROM billcore.clients WHERE account_number = 'BC-10000004'
ON CONFLICT DO NOTHING;

INSERT INTO billcore.locations (client_id, name, address, is_default)
SELECT id, 'Apartment', '21 Cedar Blvd, Apt 5A', true
FROM billcore.clients WHERE account_number = 'BC-10000005'
ON CONFLICT DO NOTHING;

-- Second location (cottage) for Alice
INSERT INTO billcore.locations (client_id, name, address, is_default)
SELECT id, 'Cottage', '45 Forest Drive', false
FROM billcore.clients WHERE account_number = 'BC-10000001'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------
-- Subscriptions
-- -----------------------------------------------------------

DO $$
DECLARE
    v_loc_id    INTEGER;
    v_svc_id    INTEGER;
    v_meter     INTEGER := 1000;
BEGIN
    -- Alice apartment — all services
    SELECT l.id INTO v_loc_id FROM billcore.locations l
    JOIN billcore.clients c ON c.id = l.client_id
    WHERE c.account_number = 'BC-10000001' AND l.name = 'Apartment';

    FOR v_svc_id IN
        SELECT id FROM billcore.services ORDER BY id
    LOOP
        INSERT INTO billcore.subscriptions (location_id, service_id, meter_number, connected_at)
        VALUES (
            v_loc_id, v_svc_id,
            CASE WHEN (SELECT has_meter FROM billcore.services WHERE id = v_svc_id)
                 THEN 'MTR-A' || lpad(v_svc_id::text, 3, '0')
                 ELSE NULL END,
            '2024-01-01'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Bob — cold water, electricity, internet, building maintenance
    SELECT l.id INTO v_loc_id FROM billcore.locations l
    JOIN billcore.clients c ON c.id = l.client_id
    WHERE c.account_number = 'BC-10000002' AND l.name = 'Apartment';

    FOR v_svc_id IN
        SELECT id FROM billcore.services
        WHERE name IN ('Cold Water','Electricity','Internet','Building Maintenance')
    LOOP
        INSERT INTO billcore.subscriptions (location_id, service_id, meter_number, connected_at)
        VALUES (
            v_loc_id, v_svc_id,
            CASE WHEN (SELECT has_meter FROM billcore.services WHERE id = v_svc_id)
                 THEN 'MTR-B' || lpad(v_svc_id::text, 3, '0')
                 ELSE NULL END,
            '2024-01-01'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Carol — cold water, hot water, electricity, heating, internet
    SELECT l.id INTO v_loc_id FROM billcore.locations l
    JOIN billcore.clients c ON c.id = l.client_id
    WHERE c.account_number = 'BC-10000003' AND l.name = 'Apartment';

    FOR v_svc_id IN
        SELECT id FROM billcore.services
        WHERE name IN ('Cold Water','Hot Water','Electricity','Heating','Internet','Building Maintenance')
    LOOP
        INSERT INTO billcore.subscriptions (location_id, service_id, meter_number, connected_at)
        VALUES (
            v_loc_id, v_svc_id,
            CASE WHEN (SELECT has_meter FROM billcore.services WHERE id = v_svc_id)
                 THEN 'MTR-C' || lpad(v_svc_id::text, 3, '0')
                 ELSE NULL END,
            '2024-01-01'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- David — cold water, electricity, natural gas, internet
    SELECT l.id INTO v_loc_id FROM billcore.locations l
    JOIN billcore.clients c ON c.id = l.client_id
    WHERE c.account_number = 'BC-10000004' AND l.name = 'Apartment';

    FOR v_svc_id IN
        SELECT id FROM billcore.services
        WHERE name IN ('Cold Water','Electricity','Natural Gas','Internet','Building Maintenance','Garbage Collection')
    LOOP
        INSERT INTO billcore.subscriptions (location_id, service_id, meter_number, connected_at)
        VALUES (
            v_loc_id, v_svc_id,
            CASE WHEN (SELECT has_meter FROM billcore.services WHERE id = v_svc_id)
                 THEN 'MTR-D' || lpad(v_svc_id::text, 3, '0')
                 ELSE NULL END,
            '2024-01-01'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Emma — all services
    SELECT l.id INTO v_loc_id FROM billcore.locations l
    JOIN billcore.clients c ON c.id = l.client_id
    WHERE c.account_number = 'BC-10000005' AND l.name = 'Apartment';

    FOR v_svc_id IN
        SELECT id FROM billcore.services ORDER BY id
    LOOP
        INSERT INTO billcore.subscriptions (location_id, service_id, meter_number, connected_at)
        VALUES (
            v_loc_id, v_svc_id,
            CASE WHEN (SELECT has_meter FROM billcore.services WHERE id = v_svc_id)
                 THEN 'MTR-E' || lpad(v_svc_id::text, 3, '0')
                 ELSE NULL END,
            '2024-01-01'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

END $$;

-- -----------------------------------------------------------
-- Periods & Calculations
-- Period 1: January 2025 — fully paid
-- Period 2: February 2025 — partially paid
-- Period 3: March 2025 — open, pending
-- -----------------------------------------------------------

DO $$
DECLARE
    v_period_id  INTEGER;
    v_sub        RECORD;
    v_tariff_id  INTEGER;
    v_price      NUMERIC;
    v_prev       NUMERIC;
    v_curr       NUMERIC;
    v_qty        NUMERIC;
    v_amount     NUMERIC;
    v_status     billcore.calculation_status;
    v_count      INTEGER;
BEGIN

    -- ── Period 1: January 2025 (closed, all paid) ──────────────────
    INSERT INTO billcore.periods (period_start, period_end, status)
    VALUES ('2025-01-01', '2025-01-31', 'closed')
    ON CONFLICT (period_start) DO NOTHING
    RETURNING id INTO v_period_id;

    IF v_period_id IS NULL THEN
        SELECT id INTO v_period_id FROM billcore.periods WHERE period_start = '2025-01-01';
    END IF;

    FOR v_sub IN
        SELECT s.id AS sub_id, s.service_id, sv.has_meter, sv.name AS svc_name
        FROM billcore.subscriptions s
        JOIN billcore.services sv ON sv.id = s.service_id
        WHERE s.disconnected_at IS NULL
    LOOP
        SELECT t.id, t.price_per_unit INTO v_tariff_id, v_price
        FROM billcore.tariffs t
        WHERE t.service_id = v_sub.service_id AND t.valid_to IS NULL
        LIMIT 1;

        IF v_tariff_id IS NULL THEN CONTINUE; END IF;

        IF v_sub.has_meter THEN
            v_prev   := (v_sub.sub_id * 137 + 500)::NUMERIC;
            v_curr   := v_prev + (v_sub.sub_id * 3 + 5)::NUMERIC;
            v_qty    := v_curr - v_prev;
        ELSE
            v_prev   := NULL;
            v_curr   := NULL;
            v_qty    := 1;
        END IF;
        v_amount := ROUND(v_qty * v_price, 2);

        INSERT INTO billcore.calculations
            (subscription_id, period_id, tariff_id, reading_prev, reading_curr, quantity, amount, status)
        VALUES (v_sub.sub_id, v_period_id, v_tariff_id, v_prev, v_curr, v_qty, v_amount, 'paid')
        ON CONFLICT (subscription_id, period_id) DO NOTHING;
    END LOOP;

    -- ── Period 2: February 2025 (closed, partially paid) ────────────
    INSERT INTO billcore.periods (period_start, period_end, status)
    VALUES ('2025-02-01', '2025-02-28', 'closed')
    ON CONFLICT (period_start) DO NOTHING
    RETURNING id INTO v_period_id;

    IF v_period_id IS NULL THEN
        SELECT id INTO v_period_id FROM billcore.periods WHERE period_start = '2025-02-01';
    END IF;

    v_count := 0;
    FOR v_sub IN
        SELECT s.id AS sub_id, s.service_id, sv.has_meter
        FROM billcore.subscriptions s
        JOIN billcore.services sv ON sv.id = s.service_id
        WHERE s.disconnected_at IS NULL
        ORDER BY s.id
    LOOP
        SELECT t.id, t.price_per_unit INTO v_tariff_id, v_price
        FROM billcore.tariffs t
        WHERE t.service_id = v_sub.service_id AND t.valid_to IS NULL
        LIMIT 1;

        IF v_tariff_id IS NULL THEN CONTINUE; END IF;

        IF v_sub.has_meter THEN
            v_prev   := (v_sub.sub_id * 137 + 500)::NUMERIC + (v_sub.sub_id * 3 + 5)::NUMERIC;
            v_curr   := v_prev + (v_sub.sub_id * 3 + 7)::NUMERIC;
            v_qty    := v_curr - v_prev;
        ELSE
            v_prev   := NULL;
            v_curr   := NULL;
            v_qty    := 1;
        END IF;
        v_amount := ROUND(v_qty * v_price, 2);

        -- First half paid, second half pending
        IF v_count % 2 = 0 THEN
            v_status := 'paid';
        ELSE
            v_status := 'pending';
        END IF;
        v_count := v_count + 1;

        INSERT INTO billcore.calculations
            (subscription_id, period_id, tariff_id, reading_prev, reading_curr, quantity, amount, status)
        VALUES (v_sub.sub_id, v_period_id, v_tariff_id, v_prev, v_curr, v_qty, v_amount, v_status)
        ON CONFLICT (subscription_id, period_id) DO NOTHING;
    END LOOP;

    -- ── Period 3: March 2025 (open, all pending, no meter readings) ──
    INSERT INTO billcore.periods (period_start, period_end, status)
    VALUES ('2025-03-01', '2025-03-31', 'open')
    ON CONFLICT (period_start) DO NOTHING
    RETURNING id INTO v_period_id;

    IF v_period_id IS NULL THEN
        SELECT id INTO v_period_id FROM billcore.periods WHERE period_start = '2025-03-01';
    END IF;

    FOR v_sub IN
        SELECT s.id AS sub_id, s.service_id, sv.has_meter
        FROM billcore.subscriptions s
        JOIN billcore.services sv ON sv.id = s.service_id
        WHERE s.disconnected_at IS NULL
    LOOP
        SELECT t.id, t.price_per_unit INTO v_tariff_id, v_price
        FROM billcore.tariffs t
        WHERE t.service_id = v_sub.service_id AND t.valid_to IS NULL
        LIMIT 1;

        IF v_tariff_id IS NULL THEN CONTINUE; END IF;

        IF v_sub.has_meter THEN
            -- Previous reading set, current not yet entered
            v_prev   := (v_sub.sub_id * 137 + 500)::NUMERIC
                      + (v_sub.sub_id * 3 + 5)::NUMERIC
                      + (v_sub.sub_id * 3 + 7)::NUMERIC;
            v_curr   := NULL;
            v_qty    := 0;
            v_amount := 0;
        ELSE
            v_prev   := NULL;
            v_curr   := NULL;
            v_qty    := 1;
            v_amount := ROUND(v_price, 2);
        END IF;

        INSERT INTO billcore.calculations
            (subscription_id, period_id, tariff_id, reading_prev, reading_curr, quantity, amount, status)
        VALUES (v_sub.sub_id, v_period_id, v_tariff_id, v_prev, v_curr, v_qty, v_amount, 'pending')
        ON CONFLICT (subscription_id, period_id) DO NOTHING;
    END LOOP;

END $$;

COMMIT;

-- Summary
SELECT
    'Clients'       AS entity, COUNT(*) AS count FROM billcore.clients
UNION ALL SELECT 'Services',    COUNT(*) FROM billcore.services
UNION ALL SELECT 'Tariffs',     COUNT(*) FROM billcore.tariffs
UNION ALL SELECT 'Locations',   COUNT(*) FROM billcore.locations
UNION ALL SELECT 'Subscriptions',COUNT(*) FROM billcore.subscriptions
UNION ALL SELECT 'Periods',     COUNT(*) FROM billcore.periods
UNION ALL SELECT 'Calculations',COUNT(*) FROM billcore.calculations;

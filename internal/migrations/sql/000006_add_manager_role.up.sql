-- Step 1: add enum value outside transaction (PostgreSQL requirement)
ALTER TYPE billcore.user_role ADD VALUE IF NOT EXISTS 'manager';

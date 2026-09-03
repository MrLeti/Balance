-- ═══════════════════════════════════════════════════════════════════
-- 🏛️ Vesta Personal Finance — Supabase PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════════════

-- 1. Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Transacciones / Movimientos Generales
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Ingreso', 'Egreso', 'Inversión', 'Ahorro')),
    category TEXT NOT NULL,
    sub_category TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    comment TEXT DEFAULT '',
    cuota_ref TEXT DEFAULT NULL,
    investment_ref TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la tabla ya existe, actualizar el constraint:
-- ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
-- ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('Ingreso', 'Egreso', 'Inversión', 'Ahorro'));

-- Indexes for lightning-fast queries by date, category and references
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_investment_ref ON transactions (investment_ref);

-- 2.b. Objetivos y Metas de Ahorro
CREATE TABLE IF NOT EXISTS savings_goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'ARS' NOT NULL,
    deadline DATE DEFAULT NULL,
    icon TEXT DEFAULT '🎯',
    color TEXT DEFAULT '#8b5cf6',
    is_emergency BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Cuotas / Compras Financiadas
CREATE TABLE IF NOT EXISTS instalments (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    concept TEXT NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    instalments_count INTEGER NOT NULL CHECK (instalments_count > 0),
    start_month TEXT NOT NULL, -- Format: 'MM/YYYY'
    tarjeta TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instalments_date ON instalments (date DESC);

-- 4. Inversiones (Operaciones de Compra / Venta / Split)
CREATE TABLE IF NOT EXISTS investments (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('Compra', 'Venta', 'Split')),
    asset TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- 'Cedears', 'Acciones', 'ETFs', 'Cripto', 'Bonos', etc.
    quantity NUMERIC(18, 8) NOT NULL,
    unit_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    commission NUMERIC(18, 4) NOT NULL DEFAULT 0,
    cartera TEXT NOT NULL,
    comment TEXT DEFAULT '',
    currency TEXT DEFAULT 'ARS' NOT NULL,
    fx_rate NUMERIC(18, 4) DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_date ON investments (date DESC);
CREATE INDEX IF NOT EXISTS idx_investments_asset ON investments (asset);

-- 4b. Precios y Cotizaciones en Caché / Manuales
CREATE TABLE IF NOT EXISTS asset_prices (
    asset TEXT PRIMARY KEY,
    price_ars NUMERIC(18, 4) NOT NULL DEFAULT 0,
    price_usd NUMERIC(18, 4) NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Pagos de Tarjetas de Crédito
CREATE TABLE IF NOT EXISTS card_payments (
    id TEXT PRIMARY KEY,
    closing_date DATE NOT NULL,
    tarjeta TEXT NOT NULL,
    period TEXT NOT NULL, -- Format: 'MM/YYYY'
    amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_payments_period ON card_payments (period);

-- 6. Tarjetas de Crédito y Configuración de Fechas / Colores
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    dia_cierre INTEGER DEFAULT 20,
    dia_vencimiento INTEGER DEFAULT 5,
    proximo_cierre DATE DEFAULT NULL,
    proximo_vencimiento DATE DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.b. Categorías y Subcategorías Personalizables
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('Ingreso', 'Egreso')),
    name TEXT NOT NULL,
    subcategories JSONB NOT NULL DEFAULT '[]'::jsonb,
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Row Level Security (RLS) - Prepared for simple access or user auth
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instalments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Allow full access to service_role (backend Next.js API with SUPABASE_SERVICE_ROLE_KEY)
-- Or anon read/write if using API keys in single-user environment:
CREATE POLICY "Allow all access to authenticated/service role" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated/service role" ON instalments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated/service role" ON investments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated/service role" ON card_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated/service role" ON cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated/service role" ON categories FOR ALL USING (true) WITH CHECK (true);


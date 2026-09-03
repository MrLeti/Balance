-- ═══════════════════════════════════════════════════════════════════
-- 🏛️ Vesta Migration: Multi-User Architecture & Row Level Security
-- ═══════════════════════════════════════════════════════════════════

-- 0. Asegurar que todas las tablas base existan (sin alterar datos preexistentes)
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

CREATE TABLE IF NOT EXISTS instalments (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    concept TEXT NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    instalments_count INTEGER NOT NULL CHECK (instalments_count > 0),
    start_month TEXT NOT NULL,
    tarjeta TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investments (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('Compra', 'Venta', 'Split')),
    asset TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    quantity NUMERIC(18, 8) NOT NULL,
    unit_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    commission NUMERIC(18, 4) NOT NULL DEFAULT 0,
    cartera TEXT NOT NULL,
    comment TEXT DEFAULT '',
    currency TEXT DEFAULT 'ARS' NOT NULL,
    fx_rate NUMERIC(18, 4) DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_prices (
    asset TEXT PRIMARY KEY,
    price_ars NUMERIC(18, 4) NOT NULL DEFAULT 0,
    price_usd NUMERIC(18, 4) NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_payments (
    id TEXT PRIMARY KEY,
    closing_date DATE NOT NULL,
    tarjeta TEXT NOT NULL,
    period TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('Ingreso', 'Egreso')),
    name TEXT NOT NULL,
    subcategories JSONB NOT NULL DEFAULT '[]'::jsonb,
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Agregar columna user_id a todas las tablas de finanzas del usuario
ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE savings_goals 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE instalments 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE investments 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS commission NUMERIC(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE card_payments 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE cards 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE categories 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Índices de rendimiento por usuario
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals (user_id);
CREATE INDEX IF NOT EXISTS idx_instalments_user_id ON instalments (user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments (user_id);
CREATE INDEX IF NOT EXISTS idx_card_payments_user_id ON card_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories (user_id);

-- 3. Asignación automática de datos existentes al primer usuario registrado (si ya existe)
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    IF first_user_id IS NOT NULL THEN
        UPDATE transactions SET user_id = first_user_id WHERE user_id IS NULL;
        UPDATE savings_goals SET user_id = first_user_id WHERE user_id IS NULL;
        UPDATE instalments SET user_id = first_user_id WHERE user_id IS NULL;
        UPDATE investments SET user_id = first_user_id WHERE user_id IS NULL;
        UPDATE card_payments SET user_id = first_user_id WHERE user_id IS NULL;
        UPDATE cards SET user_id = first_user_id WHERE user_id IS NULL;
        UPDATE categories SET user_id = first_user_id WHERE user_id IS NULL;
    END IF;
END $$;

-- 4. Activar Row Level Security (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE instalments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_prices ENABLE ROW LEVEL SECURITY;

-- 5. Eliminar políticas antiguas no restrictivas
DROP POLICY IF EXISTS "Allow all access to authenticated/service role" ON transactions;
DROP POLICY IF EXISTS "Allow all access to authenticated/service role" ON instalments;
DROP POLICY IF EXISTS "Allow all access to authenticated/service role" ON investments;
DROP POLICY IF EXISTS "Allow all access to authenticated/service role" ON card_payments;
DROP POLICY IF EXISTS "Allow all access to authenticated/service role" ON cards;
DROP POLICY IF EXISTS "Allow all access to authenticated/service role" ON categories;
DROP POLICY IF EXISTS "Allow all access to authenticated/service role" ON savings_goals;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage their own savings_goals" ON savings_goals;
DROP POLICY IF EXISTS "Users can manage their own instalments" ON instalments;
DROP POLICY IF EXISTS "Users can manage their own investments" ON investments;
DROP POLICY IF EXISTS "Users can manage their own card_payments" ON card_payments;
DROP POLICY IF EXISTS "Users can manage their own cards" ON cards;
DROP POLICY IF EXISTS "Users can manage their own categories" ON categories;

-- 6. Políticas de aislamiento de datos (Cada usuario solo ve y modifica sus datos)
CREATE POLICY "Users can manage their own transactions" ON transactions
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own savings_goals" ON savings_goals
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own instalments" ON instalments
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own investments" ON investments
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own card_payments" ON card_payments
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own cards" ON cards
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own categories" ON categories
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Caché global de precios de activos (Lectura para autenticados)
DROP POLICY IF EXISTS "Allow read asset_prices for authenticated users" ON asset_prices;
CREATE POLICY "Allow read asset_prices for authenticated users" ON asset_prices
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow manage asset_prices for authenticated users" ON asset_prices;
CREATE POLICY "Allow manage asset_prices for authenticated users" ON asset_prices
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Trigger de Onboarding: Crear automáticamente categorías por defecto al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.categories (id, user_id, type, name, subcategories, color)
  VALUES
    (gen_random_uuid()::text, NEW.id, 'Ingreso', 'Salario', '["Sueldo", "Aguinaldo", "Vacaciones"]'::jsonb, '#22c55e'),
    (gen_random_uuid()::text, NEW.id, 'Ingreso', 'Extras', '["Intereses", "Otros ingresos", "Dividendos", "Trabajos"]'::jsonb, '#14b8a6'),
    (gen_random_uuid()::text, NEW.id, 'Egreso', 'Comunes', '["Mercadería", "Limpieza", "Cuidado personal", "Delivery", "Otros comunes"]'::jsonb, '#f59e0b'),
    (gen_random_uuid()::text, NEW.id, 'Egreso', 'Habitacionales', '["Alquiler", "Expensas", "Impuestos", "Energía", "Gas", "Internet", "Teléfono", "Suscripciones", "Otros habit."]'::jsonb, '#e0726b'),
    (gen_random_uuid()::text, NEW.id, 'Egreso', 'Puntuales', '["Equip. Para el hogar", "Transporte", "Ropa", "Bicicleta", "Otros puntuales"]'::jsonb, '#ec4899'),
    (gen_random_uuid()::text, NEW.id, 'Egreso', 'Ocio', '["Juegos", "Libros", "Salida", "Otros ocio"]'::jsonb, '#0ea5e9');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

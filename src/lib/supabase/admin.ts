import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ ADMIN CLIENT — Bypasea Row Level Security (RLS) de Supabase.
 * Solo usar en operaciones de servidor donde se necesite acceso privilegiado
 * y se haya verificado la identidad del usuario por otros medios.
 * NUNCA importar desde componentes cliente (Client Components).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

export const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

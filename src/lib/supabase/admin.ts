import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ ADMIN CLIENT — Bypasea Row Level Security (RLS) de Supabase.
 * Solo usar en operaciones de servidor donde se necesite acceso privilegiado
 * y se haya verificado la identidad del usuario por otros medios.
 * NUNCA importar desde componentes cliente (Client Components).
 */
export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

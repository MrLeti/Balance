import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase estándar — usa la anon key y respeta las políticas RLS.
 * Para operaciones privilegiadas de servidor, usar `@/lib/supabase/admin`.
 */
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

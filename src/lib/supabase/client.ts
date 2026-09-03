import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase estándar — usa la anon key y respeta las políticas RLS.
 * Para operaciones privilegiadas de servidor, usar `@/lib/supabase/admin`.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

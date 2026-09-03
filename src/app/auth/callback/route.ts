import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";
    const type = searchParams.get("type");

    // Limpiar cookies viejas de next-auth
    try {
        const cookieStore = await cookies();
        cookieStore.getAll().forEach((c) => {
            if (c.name.startsWith("next-auth")) {
                cookieStore.delete(c.name);
            }
        });
    } catch {
        // Fallback silencioso
    }

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            if (type === "recovery") {
                return NextResponse.redirect(`${origin}/reset-password`);
            }
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return supabaseResponse;
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Limpiar cookies residuales de next-auth para evitar exceso de tamaño en encabezados HTTP
    request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.startsWith("next-auth")) {
            supabaseResponse.cookies.delete(cookie.name);
        }
    });

    // Refrescar sesión
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    const isPublic =
        pathname === "/login" ||
        pathname === "/reset-password" ||
        pathname.startsWith("/auth/") ||
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/api/auth/") ||
        pathname.includes(".") ||
        pathname === "/manifest.json";

    if (!user && !isPublic) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        const redirectRes = NextResponse.redirect(url);
        // Preservar cookies de Supabase en la redirección
        supabaseResponse.cookies.getAll().forEach((cookie) => {
            redirectRes.cookies.set(cookie.name, cookie.value);
        });
        return redirectRes;
    }

    if (user && pathname === "/login") {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        const redirectRes = NextResponse.redirect(url);
        // Preservar cookies de Supabase en la redirección
        supabaseResponse.cookies.getAll().forEach((cookie) => {
            redirectRes.cookies.set(cookie.name, cookie.value);
        });
        return redirectRes;
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};

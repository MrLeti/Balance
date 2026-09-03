import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_INITIAL_CATEGORIES, CategoryItem } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        // 1. Fetch from Supabase for current user
        const { data: sbData, error } = await supabase
            .from("categories")
            .select("id, type, name, subcategories, color, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error consultando categorías en Supabase:", error);
        }

        // 2. If categories exist in database, return them
        if (sbData && sbData.length > 0) {
            const categories: CategoryItem[] = sbData.map((c) => ({
                id: c.id,
                type: c.type,
                name: c.name,
                subcategories: Array.isArray(c.subcategories)
                    ? c.subcategories
                    : typeof c.subcategories === "string"
                    ? JSON.parse(c.subcategories)
                    : [],
                color: c.color || "#3b82f6",
                createdAt: c.created_at,
            }));
            return NextResponse.json({ data: categories, initialized: false });
        }

        // 3. First time entering and no categories exist: Seed defaults for this user
        const seededCategories = DEFAULT_INITIAL_CATEGORIES.map((item) => ({
            id: crypto.randomUUID(),
            user_id: user.id,
            type: item.type,
            name: item.name,
            subcategories: item.subcategories,
            color: item.color,
        }));

        const { error: seedError } = await supabase.from("categories").insert(seededCategories);
        if (seedError) {
            console.error("Aviso: Error sembrando categorías en Supabase:", seedError);
        }

        return NextResponse.json({ data: seededCategories, initialized: true });
    } catch (error: unknown) {
        console.error("Error al obtener categorías:", error);
        return NextResponse.json({ error: "Error de servidor al obtener categorías" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = await req.json();
        const { type, name, subcategories, color } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: "El nombre de la categoría es obligatorio." }, { status: 400 });
        }

        if (type !== "Ingreso" && type !== "Egreso") {
            return NextResponse.json({ error: "Tipo de categoría inválido (debe ser Ingreso o Egreso)." }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const cleanSubcats: string[] = Array.isArray(subcategories)
            ? subcategories.map((s: string) => String(s).trim()).filter(Boolean)
            : [];

        const newCategory = {
            id,
            user_id: user.id,
            type,
            name: String(name).trim(),
            subcategories: cleanSubcats,
            color: color || "#3b82f6",
        };

        const { error: insertError } = await supabase.from("categories").insert(newCategory);
        if (insertError) {
            console.error("Error insertando categoría en Supabase:", insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: newCategory });
    } catch (error: unknown) {
        console.error("Error creando categoría:", error);
        return NextResponse.json({ error: "Error al crear la categoría" }, { status: 500 });
    }
}

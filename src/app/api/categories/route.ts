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
            .select("id, type, name, subcategories, subscription_subcategories, color, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error consultando categorías en Supabase:", error);
        }

        // 2. If categories exist in database, return consolidated & deduplicated
        if (sbData && sbData.length > 0) {
            const consolidatedMap = new Map<string, CategoryItem>();
            for (const c of sbData) {
                const type = c.type;
                const name = String(c.name || "").trim();
                const key = `${type}::${name.toLowerCase()}`;
                const subcats: string[] = Array.isArray(c.subcategories)
                    ? c.subcategories
                    : typeof c.subcategories === "string"
                    ? JSON.parse(c.subcategories)
                    : [];
                const subSubcats: string[] = Array.isArray(c.subscription_subcategories)
                    ? c.subscription_subcategories
                    : [];

                if (!consolidatedMap.has(key)) {
                    consolidatedMap.set(key, {
                        id: c.id,
                        type,
                        name,
                        subcategories: Array.from(new Set(subcats.map((s) => String(s).trim()).filter(Boolean))),
                        subscriptionSubcategories: Array.from(new Set(subSubcats.map((s) => String(s).trim()).filter(Boolean))),
                        color: c.color || "#3b82f6",
                        createdAt: c.created_at,
                    });
                } else {
                    const existing = consolidatedMap.get(key)!;
                    existing.subcategories = Array.from(new Set([
                        ...existing.subcategories,
                        ...subcats.map((s) => String(s).trim()).filter(Boolean)
                    ]));
                    existing.subscriptionSubcategories = Array.from(new Set([
                        ...(existing.subscriptionSubcategories || []),
                        ...subSubcats.map((s) => String(s).trim()).filter(Boolean)
                    ]));
                }
            }
            const categories = Array.from(consolidatedMap.values());
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

        const cleanName = String(name).trim();

        // Validar que no exista ya una categoría con el mismo nombre y tipo para este usuario
        const { data: existingCat } = await supabase
            .from("categories")
            .select("id, name")
            .eq("user_id", user.id)
            .eq("type", type)
            .ilike("name", cleanName)
            .maybeSingle();

        if (existingCat) {
            return NextResponse.json(
                { error: `Ya existe una categoría "${cleanName}" para ${type}.` },
                { status: 400 }
            );
        }

        const id = crypto.randomUUID();
        const cleanSubcats: string[] = Array.isArray(subcategories)
            ? subcategories.map((s: string) => String(s).trim()).filter(Boolean)
            : [];

        const newCategory = {
            id,
            user_id: user.id,
            type,
            name: cleanName,
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

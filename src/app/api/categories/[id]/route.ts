import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const params = await context.params;
        const id = params.id;
        if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

        const body = await req.json();
        const { name, color, subcategories } = body;

        const updatePayload: Record<string, any> = {};
        if (name !== undefined) updatePayload.name = String(name).trim();
        if (color !== undefined) updatePayload.color = color;
        if (subcategories !== undefined && Array.isArray(subcategories)) {
            updatePayload.subcategories = subcategories.map((s: string) => String(s).trim()).filter(Boolean);
        }

        if (Object.keys(updatePayload).length === 0) {
            return NextResponse.json({ success: true, updated: {} });
        }

        const { error: sbError } = await supabase
            .from("categories")
            .update(updatePayload)
            .eq("id", id)
            .eq("user_id", user.id);

        if (sbError) {
            console.error("Error actualizando categoría en Supabase:", sbError);
            return NextResponse.json({ error: sbError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, updated: updatePayload });
    } catch (error: unknown) {
        console.error("Error actualizando categoría:", error);
        return NextResponse.json({ error: "Error de servidor al actualizar categoría" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const params = await context.params;
        const id = params.id;
        if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

        const { searchParams } = new URL(req.url);
        const cascade = searchParams.get("cascade") === "true";
        const subCategoryToDelete = searchParams.get("subCategory");

        // 1. Fetch category
        const { data: cat, error: catError } = await supabase
            .from("categories")
            .select("id, type, name, subcategories")
            .eq("id", id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (catError || !cat) {
            return NextResponse.json({ error: "Categoría no encontrada." }, { status: 404 });
        }

        if (subCategoryToDelete) {
            if (cascade) {
                await supabase
                    .from("transactions")
                    .delete()
                    .eq("category", cat.name)
                    .eq("sub_category", subCategoryToDelete)
                    .eq("user_id", user.id);
            }

            const currentSubcats: string[] = Array.isArray(cat.subcategories) ? cat.subcategories : [];
            const updatedSubcats = currentSubcats.filter((s) => s !== subCategoryToDelete);

            const { error: updError } = await supabase
                .from("categories")
                .update({ subcategories: updatedSubcats })
                .eq("id", id)
                .eq("user_id", user.id);

            if (updError) {
                return NextResponse.json({ error: updError.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, deletedSubCategory: subCategoryToDelete });
        }

        if (cascade) {
            await supabase
                .from("transactions")
                .delete()
                .eq("category", cat.name)
                .eq("user_id", user.id);
        }

        const { error: delError } = await supabase
            .from("categories")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (delError) {
            return NextResponse.json({ error: delError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, deletedId: id });
    } catch (error: unknown) {
        console.error("Error borrando categoría:", error);
        return NextResponse.json({ error: "Error de servidor al borrar categoría" }, { status: 500 });
    }
}

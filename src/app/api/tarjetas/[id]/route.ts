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
        const rawId = params.id;
        if (!rawId) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
        const id = decodeURIComponent(rawId).trim();

        const body = await req.json();
        const { nombre, color, diaCierre, diaVencimiento, proximoCierre, proximoVencimiento } = body;

        const toISODate = (d?: string | null) => {
            if (!d || typeof d !== "string" || d.trim() === "") return null;
            const trimmed = d.trim();
            if (trimmed.includes("/")) {
                const parts = trimmed.split("/");
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, "0");
                    const month = parts[1].padStart(2, "0");
                    let year = parts[2];
                    if (year.length === 2) year = `20${year}`;
                    return `${year}-${month}-${day}`;
                }
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return trimmed;
            }
            return null;
        };

        const updatePayload: Record<string, any> = {};
        if (nombre !== undefined) updatePayload.nombre = String(nombre).trim();
        if (color !== undefined) updatePayload.color = color;
        if (diaCierre !== undefined) updatePayload.dia_cierre = parseInt(diaCierre, 10) || 20;
        if (diaVencimiento !== undefined) updatePayload.dia_vencimiento = parseInt(diaVencimiento, 10) || 5;
        if (proximoCierre !== undefined) updatePayload.proximo_cierre = toISODate(proximoCierre);
        if (proximoVencimiento !== undefined) updatePayload.proximo_vencimiento = toISODate(proximoVencimiento);

        if (Object.keys(updatePayload).length === 0) {
            return NextResponse.json({ success: true, updated: {} });
        }

        const { error: sbError } = await supabase
            .from("cards")
            .update(updatePayload)
            .eq("id", id)
            .eq("user_id", user.id);

        if (sbError) {
            console.error("Error actualizando tarjeta en Supabase:", sbError);
            return NextResponse.json({ error: sbError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, updated: updatePayload });
    } catch (error: any) {
        console.error("Error actualizando tarjeta:", error);
        return NextResponse.json({ error: error?.message || "Error de base de datos" }, { status: 500 });
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

        if (!id || typeof id !== "string") {
            return NextResponse.json({ error: "ID inválido." }, { status: 400 });
        }

        const { error: sbError } = await supabase
            .from("cards")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (sbError) {
            console.error("Aviso: Error borrando tarjeta en Supabase:", sbError);
            return NextResponse.json({ error: sbError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error borrando tarjeta:", error);
        return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }
}

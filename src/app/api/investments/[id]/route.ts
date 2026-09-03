import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSafeAmount } from "@/lib/utils/format";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const { id } = await params;
        if (!id || typeof id !== "string") return NextResponse.json({ error: "ID de transacción inválido." }, { status: 400 });

        const body = await req.json();
        const { field, value } = body as { field: string; value: unknown };
        if (!field) return NextResponse.json({ error: "Campo requerido." }, { status: 400 });

        const updateObj: Record<string, unknown> = {};

        if (field === "date") {
            const dateStr = String(value || "");
            if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                if (parts.length === 3) updateObj.date = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            } else {
                updateObj.date = dateStr;
            }
        } else if (field === "quantity") {
            const qty = Math.round((parseFloat(String(value).replace(/,/g, ".")) || 0) * 1e8) / 1e8;
            if (qty <= 0) {
                return NextResponse.json({ error: "La cantidad debe ser mayor a cero." }, { status: 400 });
            }
            updateObj.quantity = qty;
        } else if (field === "unit_price") {
            const price = parseSafeAmount(value);
            if (price < 0) {
                return NextResponse.json({ error: "El precio unitario no puede ser negativo." }, { status: 400 });
            }
            updateObj.unit_price = Math.round(price * 10000) / 10000;
        } else if (field === "commission") {
            const comm = parseSafeAmount(value);
            if (comm < 0) {
                return NextResponse.json({ error: "La comisión no puede ser negativa." }, { status: 400 });
            }
            updateObj.commission = Math.round(comm * 10000) / 10000;
        } else if (field === "fx_rate") {
            const fx = parseSafeAmount(value);
            if (fx < 0) {
                return NextResponse.json({ error: "El tipo de cambio no puede ser negativo." }, { status: 400 });
            }
            updateObj.fx_rate = Math.round(fx * 10000) / 10000;
        } else {
            updateObj[field] = value;
        }

        const { error: sbError } = await supabase
            .from("investments")
            .update(updateObj)
            .eq("id", id)
            .eq("user_id", user.id);

        if (sbError) throw new Error(`Fallo actualización en Supabase: ${sbError.message}`);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json(safeErrorResponse(error, "Error al actualizar la inversión."), { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const { id } = await params;
        if (!id || typeof id !== "string") return NextResponse.json({ error: "ID de transacción inválido." }, { status: 400 });

        // 1. Borrar contraparte en transactions (si existe investment_ref)
        const { error: delTxError } = await supabase
            .from("transactions")
            .delete()
            .eq("investment_ref", id)
            .eq("user_id", user.id);

        if (delTxError) {
            console.warn(`Aviso: Error borrando contraparte de inversión ${id}:`, delTxError.message);
        }

        // 2. Borrar en Supabase investments
        const { error: sbError } = await supabase
            .from("investments")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (sbError) {
            console.error("Error borrando inversión en Supabase:", sbError);
            throw new Error(`No se pudo eliminar la inversión: ${sbError.message}`);
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json(safeErrorResponse(error, "Error al borrar la inversión."), { status: 500 });
    }
}


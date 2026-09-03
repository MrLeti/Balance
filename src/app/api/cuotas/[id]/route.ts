import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSafeAmount, roundMoney } from "@/lib/utils/format";
import { safeErrorResponse } from "@/lib/utils/api-error";

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
        const { field, value } = body as { field: string; value: unknown };
        if (!field) return NextResponse.json({ error: "Falta el campo field." }, { status: 400 });

        const updateObj: Record<string, unknown> = {};

        if (field === "date") {
            const dateStr = String(value || "");
            if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                if (parts.length === 3) updateObj.date = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            } else {
                updateObj.date = dateStr;
            }
        } else if (field === "total_amount") {
            const num = roundMoney(parseSafeAmount(value));
            if (num <= 0) {
                return NextResponse.json({ error: "El monto total de la cuota debe ser mayor a cero." }, { status: 400 });
            }
            updateObj.total_amount = num;
        } else if (field === "instalments_count") {
            const n = parseInt(String(value), 10);
            if (isNaN(n) || n < 1) {
                return NextResponse.json({ error: "La cantidad de cuotas debe ser al menos 1." }, { status: 400 });
            }
            updateObj.instalments_count = n;
        } else {
            updateObj[field] = value;
        }

        const { error: sbError } = await supabase
            .from("instalments")
            .update(updateObj)
            .eq("id", id)
            .eq("user_id", user.id);

        if (sbError) throw new Error(`Fallo al actualizar en Supabase: ${sbError.message}`);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json(safeErrorResponse(error, "Error al actualizar la cuota."), { status: 500 });
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
        if (!id || typeof id !== "string") return NextResponse.json({ error: "ID de cuota inválido." }, { status: 400 });

        const { error: sbError } = await supabase
            .from("instalments")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (sbError) {
            console.error("Error borrando cuota en Supabase:", sbError);
            throw new Error(`No se pudo eliminar la cuota: ${sbError.message}`);
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json(safeErrorResponse(error, "Error al borrar la cuota."), { status: 500 });
    }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSafeAmount, roundMoney } from "@/lib/utils/format";
import { safeErrorResponse } from "@/lib/utils/api-error";

// VULN-04: Allowlist de campos editables — previene mass assignment
const UPDATABLE_FIELDS = new Set([
    "date", "type", "category", "sub_category", "amount", "comment",
]);
// Campos NO permitidos: id, user_id, cuota_ref, investment_ref, created_at

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = await req.json();
        const { items } = body as { items: (string | number)[][] };

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "Debe enviar al menos un movimiento para registrar." },
                { status: 400 }
            );
        }

        const supabaseRecords: any[] = [];
        const cleanItems: any[] = [];

        for (const row of items) {
            const transactionId = crypto.randomUUID();
            const dateStr = String(row[0] || "");
            let isoDate = dateStr;
            if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                if (parts.length === 3) isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }

            const type = String(row[1] || "Egreso");
            const rawAmount = parseSafeAmount(row[4]);

            if (rawAmount === 0 || isNaN(rawAmount) || !isFinite(rawAmount)) {
                return NextResponse.json(
                    { error: "El importe debe ser un número válido distinto de cero." },
                    { status: 400 }
                );
            }

            // Ingresos e Inversiones deben ser positivos; Egresos permite negativos (descuentos) y Ahorros (retiros)
            if ((type === "Ingreso" || type === "Inversión") && rawAmount < 0) {
                return NextResponse.json(
                    { error: `Los movimientos de tipo '${type}' no pueden tener un importe negativo.` },
                    { status: 400 }
                );
            }

            const cleanAmount = roundMoney(rawAmount);

            supabaseRecords.push({
                id: transactionId,
                user_id: user.id,
                date: isoDate,
                type,
                category: String(row[2] || ""),
                sub_category: String(row[3] || ""),
                amount: cleanAmount,
                comment: String(row[5] || ""),
                cuota_ref: row[6] ? String(row[6]) : null,
                investment_ref: row[7] ? String(row[7]) : null,
            });

            cleanItems.push([transactionId, ...row]);
        }

        const insertedIds = cleanItems.map((row) => row[0]);

        const { error: sbError } = await supabase.from("transactions").insert(supabaseRecords);
        if (sbError) throw new Error(`No se pudo guardar en Supabase: ${sbError.message}`);

        return NextResponse.json({
            success: true,
            count: cleanItems.length,
            ids: insertedIds,
            type: "transactions",
        });
    } catch (error: unknown) {
        return NextResponse.json(safeErrorResponse(error, "Error al guardar el movimiento."), { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = await req.json();
        const { id, field, value } = body as { id: string; field: string; value: unknown };

        // VULN-04: Validar que el campo esté en la allowlist antes de usarlo
        if (!id || !field || !UPDATABLE_FIELDS.has(field)) {
            return NextResponse.json(
                { error: "Campo no permitido o parámetros inválidos." },
                { status: 400 }
            );
        }


        const updateObj: Record<string, unknown> = {};

        if (field === "date") {
            const dateStr = String(value || "");
            if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                if (parts.length === 3) updateObj.date = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            } else {
                updateObj.date = dateStr;
            }
        } else if (field === "amount") {
            const rawAmount = parseSafeAmount(value);
            if (rawAmount === 0 || isNaN(rawAmount) || !isFinite(rawAmount)) {
                return NextResponse.json(
                    { error: "El importe debe ser un número válido distinto de cero." },
                    { status: 400 }
                );
            }

            // Consultar tipo actual para validar que Ingreso e Inversión no sean negativos
            const { data: currentTx } = await supabase
                .from("transactions")
                .select("type")
                .eq("id", id)
                .eq("user_id", user.id)
                .single();

            if (currentTx && (currentTx.type === "Ingreso" || currentTx.type === "Inversión") && rawAmount < 0) {
                return NextResponse.json(
                    { error: `Los movimientos de tipo '${currentTx.type}' no pueden tener un importe negativo.` },
                    { status: 400 }
                );
            }

            updateObj.amount = roundMoney(rawAmount);
        } else {
            updateObj[field] = value;
        }

        const { error: sbError } = await supabase
            .from("transactions")
            .update(updateObj)
            .eq("id", id)
            .eq("user_id", user.id);

        if (sbError) throw new Error(`Fallo actualización en Supabase: ${sbError.message}`);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json(safeErrorResponse(error, "Error al actualizar."), { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = await req.json();
        const { id } = body as { id: string };
        if (!id || typeof id !== "string") return NextResponse.json({ error: "ID inválido." }, { status: 400 });

        const { data: txData } = await supabase
            .from("transactions")
            .select("cuota_ref, investment_ref")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        const cuotaRef = txData?.cuota_ref || null;

        const { error: delTxError } = await supabase
            .from("transactions")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (delTxError) throw new Error(`No se pudo eliminar el movimiento: ${delTxError.message}`);

        if (cuotaRef) {
            const { error: delCuotaError } = await supabase
                .from("instalments")
                .delete()
                .eq("id", cuotaRef)
                .eq("user_id", user.id);
            if (delCuotaError) {
                console.warn(`Aviso: No se pudo eliminar la cuota vinculada ${cuotaRef}:`, delCuotaError.message);
            }
        }

        return NextResponse.json({ success: true, cascadeDeleted: !!cuotaRef });
    } catch (error: unknown) {
        return NextResponse.json(safeErrorResponse(error, "Error al borrar el movimiento."), { status: 500 });
    }
}


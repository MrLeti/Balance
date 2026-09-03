import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSafeAmount, roundMoney } from "@/lib/utils/format";
import { parseStartMonth } from "@/lib/utils/cuotas";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { data: sbData, error } = await supabase
            .from("instalments")
            .select("id, date, concept, total_amount, instalments_count, start_month, tarjeta")
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .limit(10000);

        if (error) {
            console.error("Error consultando cuotas:", error);
            throw error;
        }

        const data = (sbData || []).map((inst) => {
            let formattedDate = inst.date;
            if (inst.date && inst.date.includes("-")) {
                const [y, m, d] = inst.date.split("-");
                formattedDate = `${d}/${m}/${y}`;
            }
            const parsedMonth = parseStartMonth(inst.start_month, formattedDate);
            return {
                id: inst.id,
                date: formattedDate,
                concept: inst.concept,
                totalAmount: Number(inst.total_amount) || 0,
                instalmentsCount: Number(inst.instalments_count) || 1,
                startMonth: parsedMonth.monthKey,
                tarjeta: inst.tarjeta || "",
            };
        });

        return NextResponse.json({ data, source: "supabase" });
    } catch (error: unknown) {
        console.error("Error consultando cuotas:", error);
        return NextResponse.json(
            { error: "Error al visualizar la base de datos de cuotas." },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { date, concept, totalAmount, instalmentsCount, startMonth, tarjeta } = body;

        const cleanConcept = String(concept || "").trim();
        if (!cleanConcept) {
            return NextResponse.json(
                { error: "El concepto de la compra en cuotas es obligatorio." },
                { status: 400 }
            );
        }

        const numTotalAmount = roundMoney(parseSafeAmount(totalAmount));
        if (numTotalAmount <= 0) {
            return NextResponse.json(
                { error: "El monto total a financiar debe ser un número mayor a cero." },
                { status: 400 }
            );
        }

        const count = parseInt(String(instalmentsCount), 10);
        if (isNaN(count) || count < 1) {
            return NextResponse.json(
                { error: "La cantidad de cuotas debe ser un número entero mayor o igual a 1." },
                { status: 400 }
            );
        }

        const instalmentId = crypto.randomUUID();

        // Format date to ISO for Postgres
        let isoDate = date;
        if (date && date.includes("/")) {
            const parts = date.split("/");
            if (parts.length === 3) {
                isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }
        }

        const { error: sbError } = await supabase.from("instalments").insert({
            id: instalmentId,
            user_id: user.id,
            date: isoDate,
            concept: cleanConcept,
            total_amount: numTotalAmount,
            instalments_count: count,
            start_month: String(startMonth || ""),
            tarjeta: tarjeta ? String(tarjeta).trim() : null,
        });

        if (sbError) {
            console.error("Error insertando cuota en Supabase:", sbError);
            throw new Error(`No se pudo guardar la cuota en Supabase: ${sbError.message}`);
        }

        return NextResponse.json({
            success: true,
            id: instalmentId,
            type: "instalments",
        });
    } catch (error: unknown) {
        console.error("Error guardando cuota:", error);
        return NextResponse.json(
            safeErrorResponse(error, "Error al guardar en la base de datos de cuotas."),
            { status: 500 }
        );
    }
}

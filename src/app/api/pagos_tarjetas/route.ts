import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSafeAmount, roundMoney } from "@/lib/utils/format";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const { data: sbData, error } = await supabase
            .from("card_payments")
            .select("id, closing_date, tarjeta, period, amount")
            .eq("user_id", user.id)
            .order("closing_date", { ascending: false });

        if (error) {
            console.error("Error consultando pagos de tarjetas:", error);
            throw error;
        }

        const data = (sbData || []).map((p) => {
            let formattedDate = p.closing_date;
            if (p.closing_date && p.closing_date.includes("-")) {
                const [y, m, d] = p.closing_date.split("-");
                formattedDate = `${d}/${m}/${y}`;
            }
            return {
                id: p.id,
                closingDate: formattedDate,
                tarjeta: p.tarjeta,
                period: p.period,
                amount: Number(p.amount) || 0,
            };
        });

        return NextResponse.json({ data, source: "supabase" });
    } catch (error: unknown) {
        console.error("Error consultando pagos de tarjetas:", error);
        return NextResponse.json(safeErrorResponse(error, "Error consultando pagos de tarjetas."), { status: 500 });
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
        const { closingDate, tarjeta, period, amount } = body;

        const cleanTarjeta = String(tarjeta || "").trim();
        if (!cleanTarjeta) {
            return NextResponse.json({ error: "Debe seleccionar una tarjeta." }, { status: 400 });
        }

        const cleanPeriod = String(period || "").trim();
        if (!cleanPeriod) {
            return NextResponse.json({ error: "Debe especificar el período a liquidar (MM/YYYY)." }, { status: 400 });
        }

        const numAmount = roundMoney(parseSafeAmount(amount));
        if (numAmount <= 0) {
            return NextResponse.json({ error: "El importe pagado debe ser mayor a cero." }, { status: 400 });
        }

        const id = crypto.randomUUID();

        let isoDate = closingDate;
        if (closingDate && closingDate.includes("/")) {
            const parts = closingDate.split("/");
            if (parts.length === 3) {
                isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }
        }

        const { error: sbError } = await supabase.from("card_payments").insert({
            id,
            user_id: user.id,
            closing_date: isoDate,
            tarjeta: cleanTarjeta,
            period: cleanPeriod,
            amount: numAmount,
        });

        if (sbError) {
            console.error("Error guardando pago de tarjeta en Supabase:", sbError);
            throw new Error(`Error en base de datos: ${sbError.message}`);
        }

        return NextResponse.json({ success: true, id });
    } catch (error: unknown) {
        console.error("Error guardando pago de tarjeta:", error);
        return NextResponse.json(safeErrorResponse(error, "Error al registrar el pago de la tarjeta."), { status: 500 });
    }
}


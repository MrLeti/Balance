import { NextRequest, NextResponse } from "next/server";
import { appendPagoTarjeta, getPagosTarjetas } from "@/lib/google/pagos_tarjetas";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const rows = await getPagosTarjetas();
        const data = rows.map((row: any[]) => ({
            id: row[0],
            closingDate: row[1],
            tarjeta: row[2],
            period: row[3],
            amount: parseFloat(String(row[4]).replace(/[^0-9,-]/g, '').replace(',', '.')) || 0,
        }));

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error consultando pagos de tarjetas:", error);
        return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = await req.json();
        const { closingDate, tarjeta, period, amount } = body;

        const id = crypto.randomUUID();
        const sanitize = (val: string) => /^[=+\-@]/.test(val) ? `'${val}` : val;

        // [ID, Fecha Cierre, Tarjeta, Periodo / Mes Liquidado (MM/YYYY), Monto Confirmado]
        const row = [id, sanitize(closingDate), sanitize(tarjeta), sanitize(period), amount];
        await appendPagoTarjeta([row]);

        return NextResponse.json({ success: true, id });
    } catch (error: unknown) {
        console.error("Error guardando pago de tarjeta:", error);
        return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { appendInstalment, getInstalments } from "@/lib/google/instalments";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const rows = await getInstalments();

        // Mapear rows a un formato de objeto para el frontend
        const data = rows.map((row: any[]) => ({
            id: row[0],
            date: row[1],
            concept: row[2],
            totalAmount: parseFloat(String(row[3]).replace(/[^0-9,-]/g, '').replace(',', '.')) || 0,
            instalmentsCount: parseInt(String(row[4])) || 1,
            startMonth: row[5],
            tarjeta: row[6] || "",
        }));

        return NextResponse.json({ data });
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
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { date, concept, totalAmount, instalmentsCount, startMonth, tarjeta } = body;

        const instalmentId = crypto.randomUUID();

        // Evitar inyección de fórmulas de Sheets
        const sanitize = (val: string) => /^[=+\-@]/.test(val) ? `'${val}` : val;

        const row = [
            instalmentId,
            sanitize(date),
            sanitize(concept),
            totalAmount,
            instalmentsCount,
            sanitize(startMonth),
            sanitize(tarjeta || "")
        ];

        await appendInstalment([row]);

        return NextResponse.json({ success: true, id: instalmentId });
    } catch (error: unknown) {
        console.error("Error guardando cuota:", error);
        return NextResponse.json(
            { error: "Error al guardar en la base de datos de cuotas." },
            { status: 500 }
        );
    }
}

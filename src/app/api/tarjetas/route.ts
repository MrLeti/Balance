import { NextRequest, NextResponse } from "next/server";
import { appendTarjeta, getTarjetas } from "@/lib/google/tarjetas";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const rows = await getTarjetas();
        const data = rows.map((row: any[]) => ({
            id: row[0],
            nombre: row[1],
        }));

        return NextResponse.json({ data });
    } catch (error: unknown) {
        console.error("Error consultando tarjetas:", error);
        return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = await req.json();
        const { nombre } = body;

        const id = crypto.randomUUID();
        const sanitize = (val: string) => /^[=+\-@]/.test(val) ? `'${val}` : val;

        const row = [id, sanitize(nombre)];
        await appendTarjeta([row]);

        return NextResponse.json({ success: true, id });
    } catch (error: unknown) {
        console.error("Error guardando tarjeta:", error);
        return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }
}

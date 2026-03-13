import { NextRequest, NextResponse } from "next/server";
import { appendInvestmentTransaction, getInvestmentTransactions } from "@/lib/google/investments";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const rows = await getInvestmentTransactions();

        return NextResponse.json({ data: rows });
    } catch (error: unknown) {
        console.error("Error consultando inversiones:", error);
        return NextResponse.json(
            { error: "Error al obtener las inversiones." },
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
        const { items } = body as { items: (string | number)[][] };

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "El cuerpo de la solicitud debe contener un array 'items' con al menos un elemento." },
                { status: 400 }
            );
        }

        const cleanItems = items.map((row: (string | number)[]) => {
            const transactionId = crypto.randomUUID();

            const sanitizedRow = row.map(cellValue => {
                if (typeof cellValue === 'string') {
                    if (/^[=+\-@]/.test(cellValue)) {
                        return `'` + cellValue;
                    }
                }
                return cellValue;
            });

            return [transactionId, ...sanitizedRow];
        });

        const insertedIds = cleanItems.map(row => row[0]);

        await appendInvestmentTransaction(cleanItems);

        return NextResponse.json({ success: true, count: cleanItems.length, ids: insertedIds });
    } catch (error: unknown) {
        console.error("Error guardando inversión:", error);
        return NextResponse.json(
            { error: "Error al guardar la inversión." },
            { status: 500 }
        );
    }
}

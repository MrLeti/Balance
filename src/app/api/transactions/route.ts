import { NextRequest, NextResponse } from "next/server";
import { appendMultipleRowsToSheet, deleteRowFromSheetById } from "@/lib/google/sheets";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { items } = body as { items: (string | number)[][] };
        const cleanItems = items.map((row: (string | number)[]) => {
            const transactionId = crypto.randomUUID();

            const sanitizedRow = row.map(cellValue => {
                if (typeof cellValue === 'string') {
                    // Evitar que Sheets lo interprete como fórmula inyectada
                    if (/^[=+\-@]/.test(cellValue)) {
                        return `'` + cellValue;
                    }
                }
                return cellValue;
            });

            // Retornamos el ID al principio (Columna A)
            return [transactionId, ...sanitizedRow];
        });

        await appendMultipleRowsToSheet(cleanItems);

        return NextResponse.json({ success: true, count: cleanItems.length });
    } catch (error: unknown) {
        console.error("Error escribiendo transacciones:", error);
        return NextResponse.json(
            { error: "Error al guardar en la base de datos." },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { id } = body as { id: string };

        if (!id || typeof id !== 'string') {
            return NextResponse.json(
                { error: "ID de transacción inválido." },
                { status: 400 }
            );
        }

        await deleteRowFromSheetById(id);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error borrando la transacción:", error);
        return NextResponse.json(
            { error: "Error al borrar en la base de datos." },
            { status: 500 }
        );
    }
}

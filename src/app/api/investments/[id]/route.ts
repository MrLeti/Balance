import { NextRequest, NextResponse } from "next/server";
import { deleteInvestmentTransactionById } from "@/lib/google/investments";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;

        if (!id || typeof id !== 'string') {
            return NextResponse.json(
                { error: "ID de transacción inválido." },
                { status: 400 }
            );
        }

        await deleteInvestmentTransactionById(id);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error borrando inversión:", error);
        return NextResponse.json(
            { error: "Error al borrar la inversión." },
            { status: 500 }
        );
    }
}

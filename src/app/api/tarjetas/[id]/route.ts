import { NextRequest, NextResponse } from "next/server";
import { deleteTarjetaById } from "@/lib/google/tarjetas";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const params = await context.params;
        const id = params.id;

        if (!id || typeof id !== 'string') {
            return NextResponse.json({ error: "ID inválido." }, { status: 400 });
        }

        await deleteTarjetaById(id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error borrando tarjeta:", error);
        return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }
}

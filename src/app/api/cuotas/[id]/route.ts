import { NextRequest, NextResponse } from "next/server";
import { deleteInstalmentById } from "@/lib/google/instalments";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Await the params since Next.js 15+ may require returning a Promise for params
        // Even though it's Next.js 16, typically they encourage awaiting context.params 
        // We'll safely await it or use it. In next 15+ context.params is a promise.
        const params = await context.params;
        const id = params.id;

        if (!id || typeof id !== 'string') {
            return NextResponse.json(
                { error: "ID de cuota inválido." },
                { status: 400 }
            );
        }

        await deleteInstalmentById(id);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error borrando cuota:", error);
        return NextResponse.json(
            { error: "Error al borrar la cuota en la base de datos." },
            { status: 500 }
        );
    }
}

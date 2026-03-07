import { NextRequest, NextResponse } from "next/server";
import { getRecentRowsConfig } from "@/lib/google/sheets";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const rows = await getRecentRowsConfig();

        return NextResponse.json({ data: rows });
    } catch (error: unknown) {
        console.error("Error consultando balance:", error);
        return NextResponse.json(
            { error: "Error al visualizar la base de datos." },
            { status: 500 }
        );
    }
}

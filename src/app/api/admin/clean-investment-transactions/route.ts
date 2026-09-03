import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // 1. Borrar todas las inversiones del portafolio en Supabase
        const { data: deletedInv, error: invError } = await supabase
            .from("investments")
            .delete()
            .eq("user_id", user.id)
            .select("id");

        if (invError) {
            console.error("Error al borrar inversiones en Supabase:", invError);
            throw new Error(`Error en tabla investments: ${invError.message}`);
        }

        // 2. Borrar todos los movimientos de inversión en el Balance General (transactions)
        const { data: deletedTrx, error: trxError } = await supabase
            .from("transactions")
            .delete()
            .eq("user_id", user.id)
            .eq("type", "Inversión")
            .select("id");

        if (trxError) {
            console.error("Error al borrar transacciones de inversión:", trxError);
            throw new Error(`Error en tabla transactions: ${trxError.message}`);
        }

        const invCount = deletedInv ? deletedInv.length : 0;
        const trxCount = deletedTrx ? deletedTrx.length : 0;

        return NextResponse.json({
            success: true,
            investmentsDeleted: invCount,
            transactionsDeleted: trxCount,
            message: `¡Limpieza completada! Se eliminaron ${invCount} operaciones del portafolio de inversiones y ${trxCount} movimientos del Balance General.`
        });
    } catch (error: unknown) {
        console.error("Error en limpieza de inversiones:", error);
        return NextResponse.json(
            safeErrorResponse(error, "Error al realizar la limpieza."),
            { status: 500 }
        );
    }
}

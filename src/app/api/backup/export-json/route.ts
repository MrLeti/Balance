import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VestaBackupPayload } from "@/lib/backup/format";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Fetch all tables for the current user
        const [
            { data: transactions = [] },
            { data: instalments = [] },
            { data: investments = [] },
            { data: cards = [] },
            { data: card_payments = [] },
            { data: savings_goals = [] },
            { data: categories = [] },
        ] = await Promise.all([
            supabase.from("transactions").select("*").eq("user_id", user.id),
            supabase.from("instalments").select("*").eq("user_id", user.id),
            supabase.from("investments").select("*").eq("user_id", user.id),
            supabase.from("cards").select("*").eq("user_id", user.id),
            supabase.from("card_payments").select("*").eq("user_id", user.id),
            supabase.from("savings_goals").select("*").eq("user_id", user.id),
            supabase.from("categories").select("*").eq("user_id", user.id),
        ]);

        const dateStr = new Date().toISOString().split("T")[0];

        const payload: VestaBackupPayload = {
            metadata: {
                app: "Vesta Finance",
                version: "1.0",
                exportedAt: new Date().toISOString(),
                userEmail: user.email || undefined,
            },
            data: {
                transactions: transactions || [],
                instalments: instalments || [],
                investments: investments || [],
                cards: cards || [],
                card_payments: card_payments || [],
                savings_goals: savings_goals || [],
                categories: categories || [],
            },
        };

        const isDownload = req.nextUrl.searchParams.get("download") === "true";

        if (isDownload) {
            return new NextResponse(JSON.stringify(payload, null, 2), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="vesta_backup_${dateStr}.json"`,
                },
            });
        }

        return NextResponse.json(payload);
    } catch (error: unknown) {
        console.error("Error exporting backup JSON:", error);
        return NextResponse.json(
            safeErrorResponse(error, "Error al exportar la copia de seguridad."),
            { status: 500 }
        );
    }
}

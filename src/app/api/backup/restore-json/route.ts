import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateBackupPayload, VestaBackupPayload } from "@/lib/backup/format";
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

        const body = (await req.json()) as VestaBackupPayload;
        const validation = validateBackupPayload(body);

        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const isPreview = req.nextUrl.searchParams.get("preview") === "true";
        if (isPreview) {
            return NextResponse.json({
                preview: true,
                summary: validation.summary,
            });
        }

        const {
            transactions = [],
            instalments = [],
            investments = [],
            cards = [],
            card_payments = [],
            savings_goals = [],
            categories = [],
        } = body.data;

        // 1. Clean current user's records
        await Promise.all([
            supabase.from("transactions").delete().eq("user_id", user.id),
            supabase.from("instalments").delete().eq("user_id", user.id),
            supabase.from("investments").delete().eq("user_id", user.id),
            supabase.from("card_payments").delete().eq("user_id", user.id),
            supabase.from("cards").delete().eq("user_id", user.id),
            supabase.from("savings_goals").delete().eq("user_id", user.id),
            supabase.from("categories").delete().eq("user_id", user.id),
        ]);

        // Helper to attach current user_id to all rows
        const withUserId = (items: any[]) =>
            items.map((item) => ({
                ...item,
                user_id: user.id,
            }));

        // 2. Insert restoring items preserving IDs
        if (categories.length > 0) {
            const { error } = await supabase.from("categories").insert(withUserId(categories));
            if (error) throw new Error(`Error restaurando categorías: ${error.message}`);
        }

        if (cards.length > 0) {
            const { error } = await supabase.from("cards").insert(withUserId(cards));
            if (error) throw new Error(`Error restaurando tarjetas: ${error.message}`);
        }

        if (savings_goals.length > 0) {
            const { error } = await supabase.from("savings_goals").insert(withUserId(savings_goals));
            if (error) throw new Error(`Error restaurando metas de ahorro: ${error.message}`);
        }

        if (instalments.length > 0) {
            const { error } = await supabase.from("instalments").insert(withUserId(instalments));
            if (error) throw new Error(`Error restaurando cuotas: ${error.message}`);
        }

        if (investments.length > 0) {
            const { error } = await supabase.from("investments").insert(withUserId(investments));
            if (error) throw new Error(`Error restaurando inversiones: ${error.message}`);
        }

        if (transactions.length > 0) {
            // Batch in chunks of 500 for high volume
            const batchSize = 500;
            const txRecords = withUserId(transactions);
            for (let i = 0; i < txRecords.length; i += batchSize) {
                const chunk = txRecords.slice(i, i + batchSize);
                const { error } = await supabase.from("transactions").insert(chunk);
                if (error) throw new Error(`Error restaurando transacciones: ${error.message}`);
            }
        }

        if (card_payments.length > 0) {
            const { error } = await supabase.from("card_payments").insert(withUserId(card_payments));
            if (error) throw new Error(`Error restaurando pagos de tarjeta: ${error.message}`);
        }

        return NextResponse.json({
            success: true,
            message: "Copia de seguridad restaurada con éxito.",
            summary: validation.summary,
        });
    } catch (error: unknown) {
        console.error("Error restoring backup:", error);
        return NextResponse.json(
            safeErrorResponse(error, "Error al restaurar la copia de seguridad."),
            { status: 500 }
        );
    }
}

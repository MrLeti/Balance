import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // 1. Obtener transacciones desde Supabase (con paginación para superar el límite de 1000)
        let allTransactions: any[] = [];
        let from = 0;
        const step = 1000;

        while (true) {
            const { data, error } = await supabase
                .from("transactions")
                .select("id, date, type, category, sub_category, amount, comment, cuota_ref, investment_ref")
                .eq("user_id", user.id)
                .order("date", { ascending: true })
                .range(from, from + step - 1);

            if (error) {
                console.error("Error fetching transactions from Supabase:", error);
                throw error;
            }

            if (!data || data.length === 0) break;
            allTransactions = allTransactions.concat(data);

            if (data.length < step) break; // Reached the end
            from += step;
        }

        const rows = allTransactions.map((t) => {
            let formattedDate = t.date;
            if (t.date && t.date.includes("-")) {
                const [y, m, d] = t.date.split("-");
                formattedDate = `${d}/${m}/${y}`;
            }
            return [
                t.id,
                formattedDate,
                t.type,
                t.category,
                t.sub_category,
                t.amount,
                t.comment || "",
                t.cuota_ref || "",
                t.investment_ref || "",
            ];
        });

        return NextResponse.json({ data: rows, source: "supabase", count: rows.length });
    } catch (error) {
        console.error("Error consultando transacciones:", error);
        return NextResponse.json(
            { error: "Error al obtener las transacciones." },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_INITIAL_CATEGORIES, CategoryItem } from "@/lib/constants";
import { parseStartMonth } from "@/lib/utils/cuotas";
import { calculateCleanMonthlyExpense } from "@/lib/utils/savings";
import { parseSafeAmount, roundMoney } from "@/lib/utils/format";

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

        // 1. Fetch transactions, categories, cuotas, and savings goals in parallel
        let allTransactions: any[] = [];
        let from = 0;
        const step = 1000;

        // Paginación de transacciones si supera 1000
        while (true) {
            const { data, error } = await supabase
                .from("transactions")
                .select("id, date, type, category, sub_category, amount, comment, cuota_ref, investment_ref")
                .eq("user_id", user.id)
                .order("date", { ascending: true })
                .range(from, from + step - 1);

            if (error) {
                console.error("Error fetching transactions in /api/init:", error);
                throw error;
            }

            if (!data || data.length === 0) break;
            allTransactions = allTransactions.concat(data);

            if (data.length < step) break;
            from += step;
        }

        // Consultas concurrentes para categorías, cuotas y metas de ahorro
        const [categoriesRes, instalmentsRes, goalsRes] = await Promise.all([
            supabase
                .from("categories")
                .select("id, type, name, subcategories, subscription_subcategories, color, created_at")
                .eq("user_id", user.id)
                .order("created_at", { ascending: true }),
            supabase
                .from("instalments")
                .select("id, date, concept, total_amount, instalments_count, start_month, tarjeta")
                .eq("user_id", user.id)
                .order("date", { ascending: false })
                .limit(10000),
            supabase
                .from("savings_goals")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: true }),
        ]);

        // Manejo de categorías
        let categories: CategoryItem[] = [];
        const sbCategories = categoriesRes.data || [];
        if (sbCategories.length > 0) {
            categories = sbCategories.map((c) => ({
                id: c.id,
                type: c.type,
                name: c.name,
                subcategories: Array.isArray(c.subcategories)
                    ? c.subcategories
                    : typeof c.subcategories === "string"
                    ? JSON.parse(c.subcategories)
                    : [],
                subscriptionSubcategories: Array.isArray(c.subscription_subcategories)
                    ? c.subscription_subcategories
                    : [],
                color: c.color || "#3b82f6",
                createdAt: c.created_at,
            }));
        } else {
            // Sembrar categorías por defecto si es usuario nuevo
            const seededCategories = DEFAULT_INITIAL_CATEGORIES.map((item) => ({
                id: crypto.randomUUID(),
                user_id: user.id,
                type: item.type,
                name: item.name,
                subcategories: item.subcategories,
                color: item.color,
            }));
            await supabase.from("categories").insert(seededCategories);
            categories = seededCategories;
        }

        // Manejo de cuotas
        const cuotas = (instalmentsRes.data || []).map((inst) => {
            let formattedDate = inst.date;
            if (inst.date && inst.date.includes("-")) {
                const [y, m, d] = inst.date.split("-");
                formattedDate = `${d}/${m}/${y}`;
            }
            const parsedMonth = parseStartMonth(inst.start_month, formattedDate);
            return {
                id: inst.id,
                date: formattedDate,
                concept: inst.concept,
                totalAmount: Number(inst.total_amount) || 0,
                instalmentsCount: Number(inst.instalments_count) || 1,
                startMonth: parsedMonth.monthKey,
                tarjeta: inst.tarjeta || "",
            };
        });

        // Formateo de transacciones
        const transactionRows = allTransactions.map((t) => {
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

        // Metas de ahorro y cálculo de saldo acumulado de metas usando las transacciones ya cargadas
        const savingsBalances: Record<string, number> = {};
        for (const t of allTransactions) {
            if (t.type === "Ahorro") {
                const cat = t.category || "";
                const goalName = t.sub_category || "";
                const amount = parseSafeAmount(t.amount);
                const factor = cat === "Retiro" || amount < 0 ? -1 : 1;
                const netAmount = Math.abs(amount) * factor;
                savingsBalances[goalName] = (savingsBalances[goalName] || 0) + netAmount;
            }
        }

        const goals = (goalsRes.data || []).map((g) => ({
            id: g.id,
            name: g.name,
            targetAmount: Number(g.target_amount) || 0,
            currentSaved: roundMoney(savingsBalances[g.name] || 0),
            currency: (g.currency as "ARS" | "USD") || "ARS",
            deadline: g.deadline || undefined,
            icon: g.icon || "🎯",
            isEmergency: Boolean(g.is_emergency),
            targetMonths: g.is_emergency ? 6 : undefined,
        }));

        // Gasto promedio mensual para fondo de emergencia (calculado con las mismas transacciones)
        const { avgMonthlyExpense } = calculateCleanMonthlyExpense(transactionRows);

        return NextResponse.json({
            transactions: transactionRows,
            categories,
            cuotas,
            savingsGoals: goals,
            avgMonthlyExpense,
            source: "supabase",
        });
    } catch (error) {
        console.error("Error en /api/init:", error);
        return NextResponse.json(
            { error: "Error al inicializar los datos del panel." },
            { status: 500 }
        );
    }
}

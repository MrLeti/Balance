import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSafeAmount, roundMoney } from "@/lib/utils/format";
import { calculateCleanMonthlyExpense } from "@/lib/utils/savings";
import { safeErrorResponse } from "@/lib/utils/api-error";

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

        // 1. Fetch configured goals from Supabase
        const { data: sbGoals = [], error: goalsErr } = await supabase
            .from("savings_goals")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

        if (goalsErr) {
            console.error("Error fetching savings goals:", goalsErr);
        }

        const goals = (sbGoals || []).map((g) => ({
            id: g.id,
            name: g.name,
            targetAmount: Number(g.target_amount) || 0,
            currency: (g.currency as "ARS" | "USD") || "ARS",
            deadline: g.deadline || undefined,
            icon: g.icon || "🎯",
            isEmergency: Boolean(g.is_emergency),
            targetMonths: g.is_emergency ? 6 : undefined,
        }));

        // 2. Fetch transactions from Supabase
        const { data: sbTransactions = [] } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("date", { ascending: false });

        // Map to rows format for calculateCleanMonthlyExpense:
        // [id(0), date(1), type(2), category(3), sub_category(4), amount(5), comment(6)]
        const rows = (sbTransactions || []).map((t) => [
            t.id,
            t.date,
            t.type,
            t.category,
            t.sub_category,
            t.amount,
            t.comment || "",
        ]);

        const balances: Record<string, number> = {};
        const movements: any[] = [];

        for (const t of sbTransactions || []) {
            if (t.type === "Ahorro") {
                const category = t.category || "";
                const goalName = t.sub_category || "";
                const amount = parseSafeAmount(t.amount);
                const factor = category === "Retiro" || amount < 0 ? -1 : 1;
                const netAmount = Math.abs(amount) * factor;

                balances[goalName] = (balances[goalName] || 0) + netAmount;

                movements.push({
                    id: t.id,
                    date: t.date,
                    type: t.type,
                    category,
                    goalName,
                    amount: netAmount,
                    comment: t.comment || "",
                });
            }
        }

        const cleanStats = calculateCleanMonthlyExpense(rows);
        const avgMonthlyExpense = cleanStats.avgMonthlyExpense;

        const enrichedGoals = goals.map((g) => {
            const currentSaved = Math.round((balances[g.name] || 0) * 100) / 100;
            const targetMonths = g.targetMonths || 6;
            const target = g.isEmergency
                ? (g.targetAmount > 0 ? g.targetAmount : avgMonthlyExpense * targetMonths)
                : g.targetAmount;

            const progress = target > 0 ? Math.min(100, Math.round((currentSaved / target) * 100)) : 0;

            return {
                ...g,
                currentSaved,
                targetMonths: g.isEmergency ? targetMonths : undefined,
                effectiveTarget: target,
                progress,
                monthsCovered:
                    avgMonthlyExpense > 0 && g.isEmergency
                        ? Number((currentSaved / avgMonthlyExpense).toFixed(1))
                        : undefined,
            };
        });

        // Default emergency goal if none exists
        if (enrichedGoals.length === 0) {
            const emSaved = Math.round((balances["Fondo de Emergencia"] || 0) * 100) / 100;
            const emTarget = avgMonthlyExpense * 6;
            enrichedGoals.unshift({
                id: "goal_emergencia",
                name: "Fondo de Emergencia",
                targetAmount: 0,
                targetMonths: 6,
                effectiveTarget: emTarget,
                currency: "ARS",
                deadline: undefined,
                icon: "🛡️",
                isEmergency: true,
                currentSaved: emSaved,
                progress: emTarget > 0 ? Math.min(100, Math.round((emSaved / emTarget) * 100)) : 0,
                monthsCovered: avgMonthlyExpense > 0 ? Number((emSaved / avgMonthlyExpense).toFixed(1)) : 0,
            });
        }

        return NextResponse.json({
            goals: enrichedGoals,
            movements: movements.slice(-50).reverse(),
            avgMonthlyExpense,
            rawMonthlyAvg: cleanStats.rawMonthlyAvg,
            outliersFilteredCount: cleanStats.outliersFilteredCount,
        });
    } catch (error: unknown) {
        console.error("Error fetching savings goals:", error);
        return NextResponse.json(safeErrorResponse(error, "Error al obtener metas de ahorro"), { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { name, targetAmount, targetMonths, currency = "ARS", deadline, icon = "🎯", isEmergency = false } = body;

        const cleanName = String(name || "").trim();
        if (!cleanName) {
            return NextResponse.json({ error: "El nombre de la meta es obligatorio." }, { status: 400 });
        }

        const isEm = Boolean(isEmergency);
        let finalTargetAmount = 0;

        if (isEm) {
            const months = parseInt(String(targetMonths), 10) || 6;
            if (months < 1 || months > 60) {
                return NextResponse.json({ error: "Los meses de cobertura deben ser al menos 1." }, { status: 400 });
            }
            finalTargetAmount = months;
        } else {
            const amt = roundMoney(parseSafeAmount(targetAmount));
            if (amt < 0) {
                return NextResponse.json({ error: "El monto objetivo no puede ser negativo." }, { status: 400 });
            }
            finalTargetAmount = amt;
        }

        const goalId = `goal_${Date.now()}`;

        const newGoal = {
            id: goalId,
            user_id: user.id,
            name: cleanName,
            target_amount: finalTargetAmount,
            currency: currency === "USD" ? "USD" : "ARS",
            deadline: deadline || null,
            icon: icon || "🎯",
            is_emergency: isEm,
            created_at: new Date().toISOString(),
        };

        const { error: insertErr } = await supabase.from("savings_goals").insert(newGoal);
        if (insertErr) throw new Error(insertErr.message);

        return NextResponse.json({ success: true, goal: newGoal });
    } catch (error: unknown) {
        console.error("Error creating savings goal:", error);
        return NextResponse.json(safeErrorResponse(error, "Error al crear meta de ahorro"), { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const goalId = searchParams.get("id");

        if (!goalId) {
            return NextResponse.json({ error: "Falta el ID de la meta." }, { status: 400 });
        }

        const { error: delErr } = await supabase
            .from("savings_goals")
            .delete()
            .eq("id", goalId)
            .eq("user_id", user.id);

        if (delErr) throw new Error(delErr.message);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting savings goal:", error);
        return NextResponse.json(safeErrorResponse(error, "Error al eliminar meta de ahorro"), { status: 500 });
    }
}

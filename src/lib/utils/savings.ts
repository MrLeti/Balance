import { parseSafeAmount } from "./format";

export interface SavingsGoal {
    id: string;
    name: string;
    targetAmount: number;
    targetMonths?: number;
    currency: "ARS" | "USD";
    deadline?: string;
    icon?: string;
    color?: string;
    isEmergency?: boolean;
}

/**
 * Calculates a representative monthly expense from historical transactions.
 * Applies statistical outlier detection to filter out one-off large purchases (e.g. appliances)
 * and focuses on recent months (last 3-6 months) for real living costs.
 */
export function calculateCleanMonthlyExpense(rows: any[][]): {
    avgMonthlyExpense: number;
    rawMonthlyAvg: number;
    analyzedMonths: number;
    outliersFilteredCount: number;
} {
    // 1. Collect all individual expense transactions grouped by month (YYYY-MM)
    const monthExpensesMap: Record<string, number[]> = {};
    const allExpenses: number[] = [];

    for (const r of rows) {
        const type = String(r[2] || "").trim();
        if (type === "Egreso") {
            const dateStr = String(r[1] || "").trim();
            const parts = dateStr.split("/");
            if (parts.length === 3) {
                // date format DD/MM/YYYY
                const yyyy = parts[2].padStart(4, "20");
                const mm = parts[1].padStart(2, "0");
                const monthKey = `${yyyy}-${mm}`;

                const amount = Math.abs(parseSafeAmount(r[5]));
                if (amount > 0) {
                    if (!monthExpensesMap[monthKey]) {
                        monthExpensesMap[monthKey] = [];
                    }
                    monthExpensesMap[monthKey].push(amount);
                    allExpenses.push(amount);
                }
            }
        }
    }

    const availableMonths = Object.keys(monthExpensesMap).sort();
    if (availableMonths.length === 0 || allExpenses.length === 0) {
        return {
            avgMonthlyExpense: 500000,
            rawMonthlyAvg: 500000,
            analyzedMonths: 0,
            outliersFilteredCount: 0,
        };
    }

    // 2. Select recent window: up to the last 6 months
    const recentMonths = availableMonths.slice(-6);

    // 3. Compute overall median expense per transaction to detect single-item anomalies
    allExpenses.sort((a, b) => a - b);
    const medianItemExpense = allExpenses[Math.floor(allExpenses.length / 2)] || 0;

    // Outlier threshold: an expense is considered a one-off extraordinary purchase if:
    // It exceeds 3.5x the median item expense AND is at least $250,000 ARS (to avoid capping normal small variations)
    const outlierThreshold = Math.max(medianItemExpense * 3.5, 300000);

    let outliersFilteredCount = 0;
    const cleanMonthlyTotals: number[] = [];
    const rawMonthlyTotals: number[] = [];

    for (const mKey of recentMonths) {
        const expenses = monthExpensesMap[mKey] || [];
        let cleanSum = 0;
        let rawSum = 0;

        for (const exp of expenses) {
            rawSum += exp;
            if (exp > outlierThreshold && expenses.length > 2) {
                // One-off spike detected: exclude or cap at median level
                outliersFilteredCount++;
            } else {
                cleanSum += exp;
            }
        }

        if (rawSum > 0) rawMonthlyTotals.push(rawSum);
        if (cleanSum > 0) cleanMonthlyTotals.push(cleanSum);
    }

    // 4. Calculate average of clean monthly totals
    const effectiveTotals = cleanMonthlyTotals.length > 0 ? cleanMonthlyTotals : rawMonthlyTotals;
    const avgMonthlyExpense = effectiveTotals.length > 0
        ? Math.round(effectiveTotals.reduce((s, v) => s + v, 0) / effectiveTotals.length)
        : 500000;

    const rawMonthlyAvg = rawMonthlyTotals.length > 0
        ? Math.round(rawMonthlyTotals.reduce((s, v) => s + v, 0) / rawMonthlyTotals.length)
        : avgMonthlyExpense;

    return {
        avgMonthlyExpense,
        rawMonthlyAvg,
        analyzedMonths: recentMonths.length,
        outliersFilteredCount,
    };
}

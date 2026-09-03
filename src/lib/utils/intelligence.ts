import { parseSafeAmount, fmt } from "./format";
import { parseStartMonth } from "./cuotas";

// ─────────────────────────────────────────────────────────
// Intelligence & Proactive Insights System
// ─────────────────────────────────────────────────────────

export interface IntelligenceAlert {
    id: string;
    type: "warning" | "info" | "success" | "danger";
    title: string;
    message: string;
    tag?: string;
}

export interface Subscription {
    concept: string;
    averageAmount: number;
    count: number;
    lastDate: string;
}

export interface EmergencyFundMetrics {
    avgMonthlyExpense: number;
    emergencyBalance: number;
    targetAmount: number;
    targetMonths: number;
    monthsCovered: number;
    progressPct: number;
    isExplicit: boolean;
}

export interface InstalmentPlan {
    id: string;
    concept: string;
    totalAmount: number;
    instalmentsCount: number;
    startMonth: string;
    date: string;
}

/**
 * Detects recurring expenses that look like subscriptions.
 */
export function detectSubscriptions(data: any[]): Subscription[] {
    const candidates: Record<string, { count: number; total: number; lastDate: string; amounts: number[] }> = {};

    for (const row of data) {
        if (!row || row.length < 6) continue;
        const type = row[2];
        const category = String(row[3] || "");
        const subCategory = String(row[4] || "");
        const comment = String(row[6] || "");
        const dateStr = String(row[1] || "");

        if (type !== "Egreso") continue;
        if (category.toLowerCase() === "transferencias" || category.toLowerCase() === "ahorro" || category.toLowerCase() === "inversión") continue;
        
        let key = "";
        if (subCategory.toLowerCase().includes("suscrip") || subCategory.toLowerCase().includes("servicios")) {
             key = comment ? comment.trim() : subCategory.trim();
        } else if (comment.length > 3) {
             key = comment.trim();
        } else {
             continue;
        }
        
        key = key.toLowerCase();
        if (key.includes("ajuste") || key.includes("varios")) continue;

        const amount = parseSafeAmount(row[5]);
        
        if (!candidates[key]) {
            candidates[key] = { count: 0, total: 0, lastDate: "", amounts: [] };
        }
        
        candidates[key].count++;
        candidates[key].total += amount;
        candidates[key].amounts.push(amount);
        
        if (!candidates[key].lastDate) {
            candidates[key].lastDate = dateStr;
        } else {
            const currentParts = candidates[key].lastDate.split("/");
            const newParts = dateStr.split("/");
            if (currentParts.length === 3 && newParts.length === 3) {
                const d1 = new Date(Number(currentParts[2]), Number(currentParts[1]) - 1, Number(currentParts[0]));
                const d2 = new Date(Number(newParts[2]), Number(newParts[1]) - 1, Number(newParts[0]));
                if (d2 > d1) candidates[key].lastDate = dateStr;
            }
        }
    }
    
    const subscriptions: Subscription[] = [];
    for (const [key, d] of Object.entries(candidates)) {
        if (d.count >= 2) {
            const max = Math.max(...d.amounts);
            const min = Math.min(...d.amounts);
            if (max > 0 && min / max >= 0.8) {
                subscriptions.push({
                    concept: key.charAt(0).toUpperCase() + key.slice(1),
                    averageAmount: d.total / d.count,
                    count: d.count,
                    lastDate: d.lastDate,
                });
            }
        }
    }
    
    return subscriptions.sort((a, b) => b.averageAmount - a.averageAmount);
}

import { calculateCleanMonthlyExpense } from "./savings";

/**
 * Evaluates Emergency Fund progress and coverage in months.
 * Fully synchronized with the Ahorros module methodology (outlier filtering & goals).
 */
export function evaluateEmergencyFund(
    data: any[],
    availableMonths: string[],
    balanceTotal: number,
    targetMonths: number = 6,
    knownEmergencySaved?: number
): EmergencyFundMetrics {
    const { avgMonthlyExpense } = calculateCleanMonthlyExpense(data);

    let explicitEmergencySavings = 0;
    if (knownEmergencySaved !== undefined) {
        explicitEmergencySavings = knownEmergencySaved;
    } else {
        data.forEach(row => {
            if (!row || row.length < 6) return;
            const type = row[2];
            const category = String(row[3] || "").trim().toLowerCase();
            const subCategory = String(row[4] || "").trim().toLowerCase();
            const comment = String(row[6] || "").trim().toLowerCase();
            const amount = parseSafeAmount(row[5]);

            const isAhorro = type === "Ahorro" || category === "ahorro" || category === "ahorros";
            const isEmergencia = subCategory.includes("emergencia") || comment.includes("emergencia");

            if (isAhorro && isEmergencia) {
                if (category === "retiro" || subCategory.includes("retiro")) {
                    explicitEmergencySavings -= amount;
                } else {
                    explicitEmergencySavings += amount;
                }
            }
        });
    }

    let emergencyBalance = 0;
    let isExplicit = false;

    if (explicitEmergencySavings > 0) {
        emergencyBalance = explicitEmergencySavings;
        isExplicit = true;
    } else {
        // Fallback: use positive consolidated net liquidity
        emergencyBalance = Math.max(0, balanceTotal);
    }

    const targetAmount = Math.round(avgMonthlyExpense * targetMonths);
    const monthsCovered = avgMonthlyExpense > 0 ? Number((emergencyBalance / avgMonthlyExpense).toFixed(1)) : 0;
    const progressPct = targetAmount > 0 ? Math.min(100, Math.round((emergencyBalance / targetAmount) * 100)) : 0;

    return {
        avgMonthlyExpense,
        emergencyBalance,
        targetAmount,
        targetMonths,
        monthsCovered,
        progressPct,
        isExplicit
    };
}

/**
 * Detects category-specific spending spikes compared to 3-month rolling average.
 */
export function detectCategorySpikes(
    data: any[],
    balanceMonth: string
): IntelligenceAlert | null {
    if (balanceMonth === "Total" || !balanceMonth.includes("/")) return null;

    const currentRows = data.filter(row => {
        if (!row || row.length < 6 || row[2] !== "Egreso") return false;
        const dateStr = String(row[1] || "");
        const parts = dateStr.split("/");
        return parts.length >= 3 && `${parts[1]}/${parts[2]}` === balanceMonth;
    });

    if (currentRows.length === 0) return null;

    const currentCatTotals: Record<string, number> = {};
    currentRows.forEach(row => {
        const cat = String(row[3] || "Otros").trim();
        const catLower = cat.toLowerCase();
        if (catLower === "ahorro" || catLower === "transferencias") return;
        const amt = parseSafeAmount(row[5]);
        currentCatTotals[cat] = (currentCatTotals[cat] || 0) + amt;
    });

    const parts = balanceMonth.split("/");
    const curM = parseInt(parts[0], 10);
    const curY = parseInt(parts[1], 10);

    const prevMonthKeys: string[] = [];
    for (let offset = 1; offset <= 3; offset++) {
        let m = curM - offset;
        let y = curY;
        while (m <= 0) {
            m += 12;
            y -= 1;
        }
        prevMonthKeys.push(`${String(m).padStart(2, "0")}/${y}`);
    }

    const prevCatTotals: Record<string, number> = {};
    data.forEach(row => {
        if (!row || row.length < 6 || row[2] !== "Egreso") return;
        const dateStr = String(row[1] || "");
        const dParts = dateStr.split("/");
        if (dParts.length >= 3) {
            const mKey = `${dParts[1]}/${dParts[2]}`;
            if (prevMonthKeys.includes(mKey)) {
                const cat = String(row[3] || "Otros").trim();
                const amt = parseSafeAmount(row[5]);
                prevCatTotals[cat] = (prevCatTotals[cat] || 0) + amt;
            }
        }
    });

    const monthsCount = Math.max(1, prevMonthKeys.length);
    let maxSpikeCat = "";
    let maxSpikeDiff = 0;
    let maxSpikePct = 0;
    let maxSpikeAvg = 0;
    let maxSpikeCurr = 0;

    for (const [cat, currTotal] of Object.entries(currentCatTotals)) {
        const avg = (prevCatTotals[cat] || 0) / monthsCount;
        if (avg > 0 && currTotal > avg * 1.35 && (currTotal - avg) > 15000) {
            const diff = currTotal - avg;
            if (diff > maxSpikeDiff) {
                maxSpikeDiff = diff;
                maxSpikeCat = cat;
                maxSpikePct = Math.round(((currTotal / avg) - 1) * 100);
                maxSpikeAvg = avg;
                maxSpikeCurr = currTotal;
            }
        }
    }

    if (maxSpikeCat) {
        return {
            id: `spike-${maxSpikeCat}`,
            type: "warning",
            tag: "Pico de Gasto",
            title: `Pico inusual en ${maxSpikeCat}`,
            message: `Llevas gastado ${fmt(maxSpikeCurr)} (+${maxSpikePct}% respecto a tu promedio de ${fmt(maxSpikeAvg)} en los meses anteriores).`,
        };
    }

    return null;
}

/**
 * Tracks micro-spending accumulation.
 */
export function detectMicroSpending(
    filteredData: any[],
    totalEgresos: number
): IntelligenceAlert | null {
    if (totalEgresos <= 0) return null;

    const microThreshold = 8000;
    let microCount = 0;
    let microTotal = 0;

    filteredData.forEach(row => {
        if (!row || row.length < 6 || row[2] !== "Egreso") return;
        const cat = String(row[3] || "").toLowerCase();
        if (cat === "ahorro" || cat === "transferencias") return;
        const amt = parseSafeAmount(row[5]);
        if (amt > 0 && amt <= microThreshold) {
            microCount++;
            microTotal += amt;
        }
    });

    const microRatio = microTotal / totalEgresos;
    if (microCount >= 4 && microTotal >= 20000 && microRatio >= 0.07) {
        const pct = Math.round(microRatio * 100);
        return {
            id: "micro-spending",
            type: "info",
            tag: "Gastos Hormiga",
            title: "Control de Gastos Hormiga",
            message: `${microCount} microcompras menores a ${fmt(microThreshold)} suman ${fmt(microTotal)} este mes (representan el ${pct}% de tus gastos totales).`,
        };
    }

    return null;
}

/**
 * Diagnoses 50/30/20 budget balance rule.
 */
export function evaluateBudget503020(
    filteredData: any[],
    ingresos: number,
    egresos: number
): IntelligenceAlert | null {
    if (ingresos <= 0 || egresos <= 0) return null;

    let needs = 0;
    let wants = 0;

    filteredData.forEach(row => {
        if (!row || row.length < 6 || row[2] !== "Egreso") return;
        const cat = String(row[3] || "").toLowerCase();
        const sub = String(row[4] || "").toLowerCase();
        const amt = parseSafeAmount(row[5]);

        if (cat === "ahorro" || cat === "transferencias" || cat === "inversión") return;

        if (cat === "habitacionales" && !sub.includes("suscrip")) {
            needs += amt;
        } else if (cat === "comunes" && !sub.includes("delivery")) {
            needs += amt;
        } else if (sub.includes("transporte") || sub.includes("salud") || sub.includes("farmacia") || sub.includes("educación")) {
            needs += amt;
        } else {
            wants += amt;
        }
    });

    const needsPct = Math.round((needs / ingresos) * 100);
    const wantsPct = Math.round((wants / ingresos) * 100);

    if (needsPct > 60) {
        return {
            id: "budget-503020-needs",
            type: "warning",
            tag: "Diagnóstico 50/30/20",
            title: "Gastos Fijos / Necesidades Elevados",
            message: `Tus necesidades y gastos fijos ocupan el ${needsPct}% de tus ingresos este mes (recomendado: hasta 50%). Deseos y Ocio: ${wantsPct}%.`,
        };
    } else if (wantsPct > 40) {
        return {
            id: "budget-503020-wants",
            type: "warning",
            tag: "Diagnóstico 50/30/20",
            title: "Alto Consumo en Ocio y Deseos",
            message: `Tus gastos en ocio, salidas y compras discrecionales representan el ${wantsPct}% del ingreso (recomendado: hasta 30%).`,
        };
    }

    return null;
}

/**
 * Detects final instalments due this month.
 */
export function detectEndingInstalments(instalments: InstalmentPlan[]): IntelligenceAlert[] {
    if (!instalments || instalments.length === 0) return [];
    const now = new Date();
    const nowIdx = now.getFullYear() * 12 + now.getMonth();
    const alerts: IntelligenceAlert[] = [];

    instalments.forEach(inst => {
        const count = Number(inst.instalmentsCount) || 1;
        const total = Number(inst.totalAmount) || 0;
        if (count <= 1 || total <= 0) return;

        const monthly = Math.round(total / count);
        const { month: sm, year: sy } = parseStartMonth(inst.startMonth, inst.date);
        const startIdx = sy * 12 + (sm - 1);
        const endIdx = startIdx + count - 1;

        if (nowIdx === endIdx) {
            alerts.push({
                id: `end-cuota-${inst.id}`,
                type: "success",
                tag: "Fin de Deuda",
                title: `🎉 ¡Última cuota de "${inst.concept}"!`,
                message: `Este mes abonas la cuota final (${count}/${count}). Liberarás ${fmt(monthly)} mensuales en tu presupuesto a partir del mes próximo.`,
            });
        }
    });

    return alerts;
}

/**
 * Detects positive savings milestones.
 */
export function detectPositiveMilestones(tan: number, balance: number, ingresos: number): IntelligenceAlert | null {
    if (ingresos > 0 && tan >= 25 && balance > 0) {
        return {
            id: "positive-tan",
            type: "success",
            tag: "Logro de Ahorro",
            title: "🌟 ¡Excelente Tasa de Ahorro!",
            message: `Llevas retenido el ${tan.toFixed(1)}% de tus ingresos (${fmt(balance)}), superando ampliamente la meta del 20%.`,
        };
    }
    return null;
}

/**
 * Projects end-of-month expenses based on current month's burn rate.
 */
export function projectEndOfMonth(currentMonthEgresos: number, currentMonth: string): { projected: number; daysPassed: number; daysInMonth: number } | null {
    const now = new Date();
    const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    
    if (currentMonth !== currentMonthStr) return null;
    
    const today = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    if (today < 3 || today >= daysInMonth) return null;
    
    const dailyRate = currentMonthEgresos / today;
    const projected = dailyRate * daysInMonth;
    
    return { projected, daysPassed: today, daysInMonth };
}

/**
 * Calculates Vesta Score (0-100) based on financial health rules.
 */
export function calculateVestaScore(
    tan: number,
    dti: number,
    hasInvestments: boolean,
    subscriptionsChecked: boolean
): number {
    let score = 0;
    
    // 1. TAN (up to 30 pts)
    if (tan >= 20) score += 30;
    else if (tan >= 10) score += 20;
    else if (tan > 0) score += 10;
    
    // 2. DTI (up to 30 pts)
    if (dti === 0) score += 30;
    else if (dti <= 15) score += 30;
    else if (dti <= 30) score += 20;
    else if (dti <= 45) score += 10;
    
    // 3. Investments (20 pts)
    if (hasInvestments) score += 20;
    
    // 4. Proactive / Subscriptions (20 pts)
    if (subscriptionsChecked) score += 20;
    
    return Math.min(100, Math.max(0, score));
}

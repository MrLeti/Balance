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
 * @deprecated Replaced by user-defined subscription toggles in Settings.
 * Kept as a stub to avoid breaking any remaining callers.
 */
export function detectSubscriptions(_data: any[]): Subscription[] {
    return [];
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
    const prevCatMonths: Record<string, Set<string>> = {};

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
                if (!prevCatMonths[cat]) prevCatMonths[cat] = new Set<string>();
                prevCatMonths[cat].add(mKey);
            }
        }
    });

    let maxSpikeCat = "";
    let maxSpikeDiff = 0;
    let maxSpikePct = 0;
    let maxSpikeAvg = 0;
    let maxSpikeCurr = 0;

    for (const [cat, currTotal] of Object.entries(currentCatTotals)) {
        const activeMonths = prevCatMonths[cat]?.size || 0;
        if (activeMonths === 0) continue; // Sin datos históricos previos para esta categoría

        const avg = (prevCatTotals[cat] || 0) / activeMonths;
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

    // Umbral dinámico relativo al gasto total del usuario (ej. hasta 4% del total o piso de $5.000)
    const microThreshold = Math.max(Math.round(totalEgresos * 0.04), 5000);
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
    if (microCount >= 4 && microRatio >= 0.06 && microTotal >= Math.max(totalEgresos * 0.06, 15000)) {
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

        const isNeeds = 
            cat.includes("habitacion") || 
            cat.includes("comun") || 
            cat.includes("supermercado") ||
            cat.includes("alquiler") ||
            cat.includes("expensa") ||
            cat.includes("servicio") ||
            cat.includes("salud") ||
            cat.includes("farmacia") ||
            cat.includes("educacion") ||
            cat.includes("transporte") ||
            sub.includes("alquiler") ||
            sub.includes("expensas") ||
            sub.includes("impuesto") ||
            sub.includes("energía") ||
            sub.includes("luz") ||
            sub.includes("gas") ||
            sub.includes("internet") ||
            sub.includes("teléfono") ||
            sub.includes("mercadería") ||
            sub.includes("limpieza") ||
            sub.includes("transporte") ||
            sub.includes("salud") ||
            sub.includes("farmacia") ||
            sub.includes("educación");

        if (isNeeds && !sub.includes("suscrip") && !sub.includes("delivery")) {
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
    
    if (today < 4 || today >= daysInMonth) return null;
    
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
    if (dti === 0) score += 20; // 20 pts: saludable y libre de deuda
    else if (dti <= 15) score += 30; // 30 pts: apalancamiento prudente y controlado
    else if (dti <= 30) score += 20;
    else if (dti <= 45) score += 10;
    
    // 3. Investments (20 pts)
    if (hasInvestments) score += 20;
    
    // 4. Proactive / Subscriptions (20 pts)
    if (subscriptionsChecked) score += 20;
    
    return Math.min(100, Math.max(0, score));
}

/**
 * Detects whether active savings goals are progressing on track to meet their deadline.
 */
export function detectSavingsVelocity(
    goals: any[],
    data: any[]
): IntelligenceAlert[] {
    const alerts: IntelligenceAlert[] = [];
    if (!Array.isArray(goals) || goals.length === 0) return alerts;

    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    // Aportes de los últimos 3 meses para calcular ritmo
    const recent3Months = [0, 1, 2].map((offset) => {
        let m = curM - offset;
        let y = curY;
        while (m <= 0) {
            m += 12;
            y -= 1;
        }
        return `${String(m).padStart(2, "0")}/${y}`;
    });

    for (const goal of goals) {
        if (!goal || goal.isEmergency || !goal.targetAmount || goal.targetAmount <= 0) continue;
        const currentSaved = Number(goal.currentSaved) || 0;
        if (currentSaved >= goal.targetAmount) continue;

        let recentContributions = 0;
        data.forEach((r) => {
            if (!r || r.length < 6 || r[2] !== "Ahorro") return;
            const sub = String(r[4] || "").trim().toLowerCase();
            if (sub !== String(goal.name || "").trim().toLowerCase()) return;
            const dateStr = String(r[1] || "");
            const parts = dateStr.split("/");
            if (parts.length >= 3) {
                const mKey = `${parts[1]}/${parts[2]}`;
                if (recent3Months.includes(mKey)) {
                    const amt = parseSafeAmount(r[5]);
                    const cat = String(r[3] || "").toLowerCase();
                    const factor = cat.includes("retiro") || amt < 0 ? -1 : 1;
                    recentContributions += Math.abs(amt) * factor;
                }
            }
        });

        const monthlyPace = recentContributions / 3;
        if (monthlyPace > 0 && goal.deadline) {
            const remaining = goal.targetAmount - currentSaved;
            const monthsNeeded = Math.ceil(remaining / monthlyPace);

            let deadlineDate: Date | null = null;
            if (goal.deadline.includes("-")) {
                const parts = goal.deadline.split("-");
                deadlineDate = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
            } else if (goal.deadline.includes("/")) {
                const parts = goal.deadline.split("/");
                deadlineDate = new Date(Number(parts[1]), Number(parts[0]) - 1, 1);
            }

            if (deadlineDate && !isNaN(deadlineDate.getTime())) {
                const monthsToDeadline =
                    (deadlineDate.getFullYear() - curY) * 12 +
                    (deadlineDate.getMonth() - (curM - 1));

                if (monthsToDeadline > 0) {
                    if (monthsNeeded <= monthsToDeadline) {
                        alerts.push({
                            id: `goal-pace-${goal.id || goal.name}`,
                            type: "success",
                            tag: "Ritmo de Ahorro",
                            title: `🎯 En camino: "${goal.name}"`,
                            message: `Con tu ritmo actual de ${fmt(monthlyPace)}/mes, alcanzarás tu meta en ${monthsNeeded} ${monthsNeeded === 1 ? "mes" : "meses"} (a tiempo para tu objetivo).`,
                        });
                    } else {
                        const neededPace = Math.round(remaining / monthsToDeadline);
                        alerts.push({
                            id: `goal-pace-delay-${goal.id || goal.name}`,
                            type: "warning",
                            tag: "Ritmo de Ahorro",
                            title: `⏳ Meta "${goal.name}" retrasada`,
                            message: `A tu ritmo actual (${fmt(monthlyPace)}/mes) tardarás ${monthsNeeded} meses (faltan ${monthsToDeadline} meses para el objetivo). Necesitarías aportar ${fmt(neededPace)}/mes.`,
                        });
                    }
                }
            }
        }
    }

    return alerts;
}

/**
 * Detects user-defined subscription subcategories that haven't been paid this month.
 * Returns a single consolidated alert listing all unpaid items.
 * Only fires when viewing the current month and after day 5.
 */
export function detectUnpaidSubscriptions(
    categories: { name: string; type: string; subscriptionSubcategories?: string[] }[],
    filteredMonthData: any[],
    balanceMonth: string
): IntelligenceAlert | null {
    if (!categories || categories.length === 0) return null;
    if (balanceMonth === "Total") return null;

    const now = new Date();
    const curMonthStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    // Solo aplica al mes en curso, a partir del día 5
    if (balanceMonth !== curMonthStr || now.getDate() < 5) return null;

    // Recopilar todos los pares (categoryName, subcatName) marcados como suscripción
    const markedSubs: { catName: string; subName: string }[] = [];
    for (const cat of categories) {
        if (cat.type !== "Egreso") continue;
        if (!cat.subscriptionSubcategories || cat.subscriptionSubcategories.length === 0) continue;
        for (const sub of cat.subscriptionSubcategories) {
            markedSubs.push({ catName: cat.name, subName: sub });
        }
    }

    if (markedSubs.length === 0) return null;

    // Verificar cuáles NO tienen movimiento registrado en el mes actual
    const unpaid: string[] = [];
    for (const { catName, subName } of markedSubs) {
        const appeared = filteredMonthData.some((r) => {
            if (!r || r.length < 5 || r[2] !== "Egreso") return false;
            const rowCat = String(r[3] || "").trim();
            const rowSub = String(r[4] || "").trim();
            return rowCat === catName && rowSub === subName;
        });

        if (!appeared) {
            unpaid.push(subName);
        }
    }

    if (unpaid.length === 0) return null;

    const list = unpaid.length === 1
        ? `"${unpaid[0]}"`
        : unpaid.slice(0, -1).map(s => `"${s}"`).join(", ") + ` y "${unpaid[unpaid.length - 1]}"`;

    return {
        id: "unpaid-subscriptions",
        type: "warning",
        tag: "Gastos Fijos",
        title: `${unpaid.length === 1 ? "Gasto fijo pendiente" : "Gastos fijos pendientes"} este mes`,
        message: `Aún no registraste pago de ${list} este mes. Si ya lo pagaste, recordá anotarlo.`,
    };
}

/**
 * Detects prolonged periods without recorded transactions to encourage habit continuity.
 */
export function detectInactivity(data: any[]): IntelligenceAlert | null {
    if (!data || data.length === 0) return null;

    let latestDate: Date | null = null;

    for (const r of data) {
        if (!r || r.length < 2) continue;
        const dateStr = String(r[1] || "").trim();
        const parts = dateStr.split("/");
        if (parts.length === 3) {
            const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            if (!isNaN(d.getTime())) {
                if (!latestDate || d > latestDate) {
                    latestDate = d;
                }
            }
        }
    }

    if (!latestDate) return null;

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 7 && diffDays <= 60) {
        return {
            id: "inactivity-reminder",
            type: "info",
            tag: "Actualización",
            title: `Hace ${diffDays} días que no registras movimientos`,
            message: `Mantener tus finanzas al día te ayuda a evitar sorpresas. ¿Tenés gastos recientes pendientes de anotar?`,
        };
    }

    return null;
}

/**
 * Proactively reminds the user if mid-month has arrived without recorded income.
 */
export function detectMissingIncome(
    ingresos: number,
    balanceMonth: string
): IntelligenceAlert | null {
    if (balanceMonth === "Total") return null;

    const now = new Date();
    const curMonthStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

    if (balanceMonth === curMonthStr && now.getDate() >= 10 && ingresos === 0) {
        return {
            id: "missing-income",
            type: "info",
            tag: "Ingresos",
            title: "Sin ingresos registrados este mes",
            message: `Ya transcurrió parte del mes y aún no registraste ingresos en ${balanceMonth}. Si ya cobraste tu sueldo o ingresos extra, recordá cargarlos.`,
        };
    }

    return null;
}

/**
 * Anticipates installment plans completing next month.
 */
export function detectNextMonthEndingInstalments(instalments: InstalmentPlan[]): IntelligenceAlert[] {
    if (!instalments || instalments.length === 0) return [];
    const now = new Date();
    const nextMonthIdx = now.getFullYear() * 12 + now.getMonth() + 1;
    const alerts: IntelligenceAlert[] = [];

    instalments.forEach((inst) => {
        const count = Number(inst.instalmentsCount) || 1;
        const total = Number(inst.totalAmount) || 0;
        if (count <= 1 || total <= 0) return;

        const monthly = Math.round(total / count);
        const { month: sm, year: sy } = parseStartMonth(inst.startMonth, inst.date);
        const startIdx = sy * 12 + (sm - 1);
        const endIdx = startIdx + count - 1;

        if (nextMonthIdx === endIdx) {
            alerts.push({
                id: `next-end-cuota-${inst.id}`,
                type: "success",
                tag: "Fin de Deuda Próximo",
                title: `Próximo mes: ¡Finaliza "${inst.concept}"!`,
                message: `El próximo mes pagarás la cuota final (${count}/${count}). Liberarás ${fmt(monthly)} mensuales en tu presupuesto.`,
            });
        }
    });

    return alerts;
}


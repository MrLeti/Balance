export interface Instalment {
    id: string;
    date: string; // "DD/MM/YYYY" format
    concept: string;
    totalAmount: number;
    instalmentsCount: number;
    startMonth: string; // "MM/YYYY" format or any parseable date format
    tarjeta?: string;
}

export interface ProjectedPayment {
    date: string; // First day of the projected month, e.g. "01/01/2026"
    monthKey: string; // "MM/YYYY" format
    amount: number;
    instalmentNumber: number;
    originalId: string;
    tarjeta?: string;
}

export interface PagoTarjeta {
    id: string;
    closingDate: string;
    tarjeta: string;
    period: string; // "MM/YYYY" format
    amount: number;
}

export interface TarjetaInfo {
    id: string;
    nombre: string;
    color?: string;
    diaCierre?: number;
    diaVencimiento?: number;
    proximoCierre?: string;
    proximoVencimiento?: string;
}

export const DEFAULT_CARD_COLORS = [
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#f59e0b", // Amber
    "#10b981", // Emerald
    "#06b6d4", // Cyan
    "#ef4444", // Red
    "#84cc16", // Lime
    "#6366f1", // Indigo
    "#14b8a6", // Teal
];

/**
 * Normalizes any startMonth input into valid { month: number, year: number, monthKey: string }
 * Supports:
 * - "MM/YYYY" e.g. "04/2026", "4/2026"
 * - "YYYY-MM" e.g. "2026-04"
 * - "YYYY-MM-DD" e.g. "2026-04-15"
 * - "DD/MM/YYYY" e.g. "15/04/2026"
 * - Excel/Sheets serial number (e.g. 46113 or "46113")
 * - Fallback to provided fallbackDate or current date
 */
export function parseStartMonth(
    startMonth: unknown,
    fallbackDate?: string
): { month: number; year: number; monthKey: string } {
    if (startMonth !== null && startMonth !== undefined && startMonth !== "") {
        const str = String(startMonth).trim();

        // 1. Check Excel serial number (e.g. 30000 - 70000)
        const num = Number(str);
        if (!isNaN(num) && num > 30000 && num < 70000) {
            const utcDays = Math.floor(num - 25569);
            const date = new Date(utcDays * 86400 * 1000);
            const m = date.getUTCMonth() + 1;
            const y = date.getUTCFullYear();
            return {
                month: m,
                year: y,
                monthKey: `${String(m).padStart(2, '0')}/${y}`
            };
        }

        // 2. Check "MM/YYYY" or "M/YYYY"
        if (/^\d{1,2}\/\d{4}$/.test(str)) {
            const [mStr, yStr] = str.split('/');
            const m = parseInt(mStr, 10);
            const y = parseInt(yStr, 10);
            if (m >= 1 && m <= 12 && y > 1900) {
                return { month: m, year: y, monthKey: `${String(m).padStart(2, '0')}/${y}` };
            }
        }

        // 3. Check "YYYY-MM" or "YYYY-MM-DD"
        if (/^\d{4}-\d{1,2}/.test(str)) {
            const parts = str.split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (m >= 1 && m <= 12 && y > 1900) {
                return { month: m, year: y, monthKey: `${String(m).padStart(2, '0')}/${y}` };
            }
        }

        // 4. Check "DD/MM/YYYY"
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
            const parts = str.split('/');
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            if (m >= 1 && m <= 12 && y > 1900) {
                return { month: m, year: y, monthKey: `${String(m).padStart(2, '0')}/${y}` };
            }
        }
    }

    // Fallback to fallbackDate if valid
    if (fallbackDate && fallbackDate !== startMonth) {
        const parsed = parseStartMonth(fallbackDate);
        if (parsed.year > 1900) return parsed;
    }

    // Fallback to current date
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    return { month: m, year: y, monthKey: `${String(m).padStart(2, '0')}/${y}` };
}

/**
 * Calculates estimated next closing and due dates given closing and due day-of-month.
 */
export function getEstimatedCardDates(
    diaCierre = 20,
    diaVencimiento = 5,
    referenceDate = new Date()
): { nextClosingDate: string; nextDueDate: string } {
    const today = new Date(referenceDate);
    const currentDay = today.getDate();
    const currentMonth = today.getMonth(); // 0-indexed
    const currentYear = today.getFullYear();

    let closingMonth = currentMonth;
    let closingYear = currentYear;

    // If today is already past the closing day of this month, next closing is next month
    if (currentDay > diaCierre) {
        closingMonth++;
        if (closingMonth > 11) {
            closingMonth = 0;
            closingYear++;
        }
    }

    // Max days in the closing month
    const maxDaysClosing = new Date(closingYear, closingMonth + 1, 0).getDate();
    const safeClosingDay = Math.min(diaCierre, maxDaysClosing);
    const closingDate = new Date(closingYear, closingMonth, safeClosingDay);

    // Due date is in the month following the closing date
    let dueMonth = closingMonth + 1;
    let dueYear = closingYear;
    if (dueMonth > 11) {
        dueMonth = 0;
        dueYear++;
    }

    const maxDaysDue = new Date(dueYear, dueMonth + 1, 0).getDate();
    const safeDueDay = Math.min(diaVencimiento, maxDaysDue);
    const dueDate = new Date(dueYear, dueMonth, safeDueDay);

    const fmtDate = (d: Date) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    return {
        nextClosingDate: fmtDate(closingDate),
        nextDueDate: fmtDate(dueDate),
    };
}

/**
 * Calculates the future projected payments for a given list of instalments.
 */
export function calculateProjectedPayments(
    instalments: Instalment[],
    pagos: PagoTarjeta[] = []
): ProjectedPayment[] {
    const projections: ProjectedPayment[] = [];

    for (const inst of instalments) {
        const count = Number(inst.instalmentsCount) || 1;
        const total = Number(inst.totalAmount) || 0;
        if (count <= 0 || total <= 0) continue;

        // Ensure we divide cleanly. e.g. 100 in 3 = 33.33 each
        const rawMonthlyAmount = total / count;
        // Two decimals precision
        const monthlyAmount = Math.round(rawMonthlyAmount * 100) / 100;

        // Parse start month robustly
        const { month: startM, year: startY } = parseStartMonth(inst.startMonth, inst.date);
        let currentMonth = startM;
        let currentYear = startY;

        let remainingTotal = total;

        for (let i = 1; i <= count; i++) {
            const formattedMonth = currentMonth.toString().padStart(2, '0');
            const monthKey = `${formattedMonth}/${currentYear}`;

            // Avoid floating point errors for the very last instalment by taking the remaining chunk
            let amountToPay = monthlyAmount;
            if (i === count) {
                amountToPay = Math.round(remainingTotal * 100) / 100;
            }

            // Check if this month for this card is already paid (case-insensitive & trimmed)
            const cardName = inst.tarjeta?.trim();
            const isPaid = Boolean(cardName) && pagos.some(p =>
                p.tarjeta?.trim().toLowerCase() === cardName!.toLowerCase() &&
                p.period?.trim() === monthKey
            );

            if (!isPaid) {
                projections.push({
                    date: `01/${monthKey}`, // Assuming payment hits start of month for projection purposes
                    monthKey,
                    amount: amountToPay,
                    instalmentNumber: i,
                    originalId: inst.id,
                    tarjeta: inst.tarjeta?.trim() || undefined,
                });
            }

            // Redondear remainingTotal después de cada resta para evitar
            // acumulación de errores de punto flotante en cuotas largas (12+)
            remainingTotal = Math.round((remainingTotal - amountToPay) * 100) / 100;

            // Increment month
            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }
    }

    // Sort chronologically
    return projections.sort((a, b) => {
        const [ma, ya] = a.monthKey.split('/').map(Number);
        const [mb, yb] = b.monthKey.split('/').map(Number);
        if (ya !== yb) return ya - yb;
        return ma - mb;
    });
}

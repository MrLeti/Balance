export interface Instalment {
    id: string;
    date: string; // "DD/MM/YYYY" format
    concept: string;
    totalAmount: number;
    instalmentsCount: number;
    startMonth: string; // "MM/YYYY" format
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

/**
 * Calculates the future projected payments for a given list of instalments.
 */
export function calculateProjectedPayments(instalments: Instalment[], pagos: PagoTarjeta[] = []): ProjectedPayment[] {
    const projections: ProjectedPayment[] = [];

    for (const inst of instalments) {
        if (inst.instalmentsCount <= 0 || inst.totalAmount <= 0) continue;

        // Ensure we divide cleanly. e.g. 100 in 3 = 33.33 each
        const rawMonthlyAmount = inst.totalAmount / inst.instalmentsCount;
        // Two decimals precision
        const monthlyAmount = Math.round(rawMonthlyAmount * 100) / 100;

        // Parse start month
        const [monthStr, yearStr] = inst.startMonth.split('/');
        let currentMonth = parseInt(monthStr, 10);
        let currentYear = parseInt(yearStr, 10);

        if (isNaN(currentMonth) || isNaN(currentYear)) continue;

        let remainingTotal = inst.totalAmount;

        for (let i = 1; i <= inst.instalmentsCount; i++) {
            const formattedMonth = currentMonth.toString().padStart(2, '0');
            const monthKey = `${formattedMonth}/${currentYear}`;

            // Avoid floating point errors for the very last instalment by taking the remaining chunk
            let amountToPay = monthlyAmount;
            if (i === inst.instalmentsCount) {
                amountToPay = Math.round(remainingTotal * 100) / 100;
            }

            // Check if this month for this card is already paid
            const isPaid = inst.tarjeta && pagos.some(p => p.tarjeta === inst.tarjeta && p.period === monthKey);

            if (!isPaid) {
                projections.push({
                    date: `01/${monthKey}`, // Assuming payment hits start of month for projection purposes
                    monthKey,
                    amount: amountToPay,
                    instalmentNumber: i,
                    originalId: inst.id,
                    tarjeta: inst.tarjeta,
                });
            }

            remainingTotal -= amountToPay;

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

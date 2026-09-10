import { parseSafeAmount, roundMoney } from "./format";

export interface FinancialTotals {
    balance: number;
    ingresos: number;
    egresos: number;
    inversiones: number;
    ahorros: number;
}

/**
 * Pure calculation function that consolidates balance, income, expense,
 * investments and savings totals from transaction rows.
 *
 * Handles investments sell/rescate as income addition, and savings
 * withdrawals as positive balance release.
 */
export function computeFinancials(rows: (string | number)[][]): FinancialTotals {
    let b = 0;
    let i = 0;
    let e = 0;
    let inv = 0;
    let a = 0;

    for (const row of rows) {
        if (!row || row.length < 6) continue;
        const type = row[2];
        const val = parseSafeAmount(row[5]);
        const comment = String(row[6] || "").toLowerCase();
        const subCat = String(row[4] || "").toLowerCase();
        const category = String(row[3] || "").toLowerCase();
        const isVenta = comment.includes("venta") || subCat.includes("rescate");

        if (type === "Ingreso") {
            i += val;
            b += val;
        } else if (type === "Egreso") {
            e += val;
            b -= val;
        } else if (type === "Ahorro") {
            const isRetiro = category.includes("retiro") || val < 0;
            if (isRetiro) {
                b += Math.abs(val);
                a -= Math.abs(val);
            } else {
                b -= Math.abs(val);
                a += Math.abs(val);
            }
        } else if (type === "Inversión") {
            if (isVenta) {
                b += val;
                inv -= val;
            } else {
                b -= val;
                inv += val;
            }
        }
    }

    return {
        balance: roundMoney(b),
        ingresos: roundMoney(i),
        egresos: roundMoney(e),
        inversiones: roundMoney(inv),
        ahorros: roundMoney(a),
    };
}

// ─────────────────────────────────────────────────────────
// Inversiones — Types & Pure Calculation Functions
// ─────────────────────────────────────────────────────────

/* ─── Types ─── */

export type AssetType = "Acciones" | "Cripto" | "ETFs" | "Cedears";
export type TransactionType = "Compra" | "Venta";
export type Cartera = "Jubilaci\u00f3n" | "Crecimiento";

export interface InvestmentTransaction {
    id: string;
    date: string;            // "DD/MM/YYYY"
    type: TransactionType;
    asset: string;           // ticker: "AAPL", "BTC", "SPY", etc.
    assetType: AssetType;
    quantity: number;
    unitPrice: number;       // price per unit in ARS
    commission: number;      // broker commission in ARS
    cartera: Cartera;        // "Jubilaci\u00f3n" | "Crecimiento"
    comment: string;
}

export interface PortfolioHolding {
    asset: string;
    assetType: AssetType;
    totalQuantity: number;
    averageCost: number;         // weighted average purchase price
    totalInvested: number;       // total cost basis (avg * qty)
    totalCommissions: number;    // sum of buy commissions
    currentPrice: number;        // live or user-entered price
    currentValue: number;        // currentPrice × totalQuantity
    pnl: number;                 // unrealized P&L (currentValue - totalInvested)
    pnlPercent: number;          // pnl / totalInvested × 100
    realizedPnl: number;         // sum of realized gains from sales
}

export interface PortfolioSummary {
    totalInvested: number;
    totalCurrentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    totalRealizedPnl: number;
    holdingsCount: number;
    diversification: { label: string; value: number; color: string }[];
}

export interface PortfolioHistoryPoint {
    date: string;       // "DD/MM/YYYY"
    invested: number;   // accumulated capital invested up to this date
    value: number;      // estimated value at this point (uses last known prices)
}

/* ─── Constants ─── */

export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
    Acciones: "#3b82f6",
    Cripto: "#f59e0b",
    ETFs: "#8b5cf6",
    Cedears: "#22c55e",
};

export const ASSET_TYPES: AssetType[] = ["Acciones", "Cripto", "ETFs", "Cedears"];
export const CARTERAS: Cartera[] = ["Jubilaci\u00f3n", "Crecimiento"];

/* ─── Parsing (Google Sheets row ↔ InvestmentTransaction) ─── */

/**
 * Safely converts any Sheets cell value to a number.
 *
 * With valueRenderOption: "UNFORMATTED_VALUE" the Sheets API returns numeric cells
 * as actual JS numbers (e.g. 160000, 0.0009) — not strings — so calling .trim()
 * on them would throw.  This function handles both cases:
 *   - number  → returned as-is (no parsing needed, no locale issues)
 *   - string  → normalise comma/dot separator then parseFloat
 *     "0,0009"   → "0.0009"   → 0.0009  ✓
 *     "1.234,56" → "1234.56"  → 1234.56  ✓
 */
function parseNum(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;

    // Native number returned by UNFORMATTED_VALUE — use directly
    if (typeof value === "number") return isNaN(value) ? 0 : value;

    // String path — normalise locale decimal separator
    let s = String(value).trim();
    if (s === "") return 0;

    const hasComma = s.includes(",");
    const hasDot   = s.includes(".");

    if (hasComma && !hasDot) {
        s = s.replace(",", ".");
    } else if (hasComma && hasDot) {
        s = s.replace(/\./g, "").replace(",", ".");
    }

    return parseFloat(s) || 0;
}

// Row values from UNFORMATTED_VALUE can be string | number | boolean
type SheetCell = string | number | boolean | null | undefined;

/** Safely converts any Sheets cell to a string (for text fields). */
const str = (v: SheetCell): string => (v === null || v === undefined ? "" : String(v));

export function parseSheetRow(row: SheetCell[]): InvestmentTransaction {
    return {
        id:         str(row[0]),
        date:       str(row[1]),
        type:       (str(row[2]) as TransactionType) || "Compra",
        asset:      str(row[3]).toUpperCase(),
        assetType:  (str(row[4]) as AssetType)       || "Acciones",
        quantity:   parseNum(row[5]),
        unitPrice:  parseNum(row[6]),
        commission: parseNum(row[7]),
        cartera:    (str(row[8]) as Cartera)          || "Crecimiento",
        comment:    str(row[9]),
    };
}


export function transactionToRow(tx: Omit<InvestmentTransaction, "id">): (string | number)[] {
    return [
        tx.date,
        tx.type,
        tx.asset.toUpperCase(),
        tx.assetType,
        tx.quantity,
        tx.unitPrice,
        tx.commission,
        tx.cartera,
        tx.comment,
    ];
}

/* ─── Core Calculation Functions ─── */

/**
 * Calculates the weighted average cost of purchase for a set of buy transactions.
 * Formula: Σ(qty × price) / Σ(qty)
 */
export function calculateAverageCost(buys: InvestmentTransaction[]): number {
    let totalCost = 0;
    let totalQty = 0;

    for (const b of buys) {
        if (b.quantity <= 0) continue;
        totalCost += b.quantity * b.unitPrice;
        totalQty += b.quantity;
    }

    if (totalQty === 0) return 0;
    return Math.round((totalCost / totalQty) * 100) / 100;
}

/**
 * Builds the full portfolio from a list of transactions and current prices.
 * Handles average cost recalculation on each buy and realized P&L on each sale.
 */
export function buildPortfolio(
    transactions: InvestmentTransaction[],
    currentPrices: Record<string, number>
): PortfolioHolding[] {
    // Sort chronologically
    const sorted = [...transactions].sort((a, b) => {
        const [da, ma, ya] = a.date.split("/").map(Number);
        const [db, mb, yb] = b.date.split("/").map(Number);
        return (ya - yb) || (ma - mb) || (da - db);
    });

    // Internal tracking per asset
    const assets: Record<string, {
        assetType: AssetType;
        totalQuantity: number;
        totalCost: number;       // total cost basis of current holdings
        totalCommissions: number;
        realizedPnl: number;
    }> = {};

    for (const tx of sorted) {
        const key = tx.asset;
        if (!assets[key]) {
            assets[key] = {
                assetType: tx.assetType,
                totalQuantity: 0,
                totalCost: 0,
                totalCommissions: 0,
                realizedPnl: 0,
            };
        }
        const a = assets[key];

        if (tx.type === "Compra") {
            a.totalCost += tx.quantity * tx.unitPrice;
            a.totalQuantity += tx.quantity;
            a.totalCommissions += tx.commission;
        } else if (tx.type === "Venta") {
            // Calculate realized P&L using the current average cost
            const avgCost = a.totalQuantity > 0 ? a.totalCost / a.totalQuantity : 0;
            const sellQty = Math.min(tx.quantity, a.totalQuantity);
            const costBasis = avgCost * sellQty;
            const saleRevenue = tx.unitPrice * sellQty - tx.commission;
            a.realizedPnl += saleRevenue - costBasis;

            // Reduce holdings proportionally
            a.totalCost -= avgCost * sellQty;
            a.totalQuantity -= sellQty;
            a.totalCommissions += tx.commission;

            // Clamp to avoid floating-point negatives
            if (a.totalQuantity < 0.000001) {
                a.totalQuantity = 0;
                a.totalCost = 0;
            }
        }
    }

    // Build holdings array
    const holdings: PortfolioHolding[] = [];

    for (const [asset, data] of Object.entries(assets)) {
        const currentPrice = currentPrices[asset] || 0;
        const currentValue = currentPrice * data.totalQuantity;
        const totalInvested = data.totalCost;
        const pnl = currentValue - totalInvested;
        const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

        holdings.push({
            asset,
            assetType: data.assetType,
            totalQuantity: Math.round(data.totalQuantity * 1e8) / 1e8,
            averageCost: data.totalQuantity > 0
                ? Math.round((data.totalCost / data.totalQuantity) * 100) / 100
                : 0,
            totalInvested: Math.round(totalInvested * 100) / 100,
            totalCommissions: Math.round(data.totalCommissions * 100) / 100,
            currentPrice,
            currentValue: Math.round(currentValue * 100) / 100,
            pnl: Math.round(pnl * 100) / 100,
            pnlPercent: Math.round(pnlPercent * 100) / 100,
            realizedPnl: Math.round(data.realizedPnl * 100) / 100,
        });
    }

    return holdings;
}

/**
 * Computes a high-level summary of the entire portfolio.
 */
export function getPortfolioSummary(holdings: PortfolioHolding[]): PortfolioSummary {
    const activeHoldings = holdings.filter(h => h.totalQuantity > 0);

    const totalInvested = activeHoldings.reduce((s, h) => s + h.totalInvested, 0);
    const totalCurrentValue = activeHoldings.reduce((s, h) => s + h.currentValue, 0);
    const totalPnl = totalCurrentValue - totalInvested;
    const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    const totalRealizedPnl = holdings.reduce((s, h) => s + h.realizedPnl, 0);

    // Diversification by asset type
    const byType: Record<string, number> = {};
    for (const h of activeHoldings) {
        byType[h.assetType] = (byType[h.assetType] || 0) + h.currentValue;
    }

    const diversification = Object.entries(byType).map(([label, value]) => ({
        label,
        value: Math.round(value * 100) / 100,
        color: ASSET_TYPE_COLORS[label as AssetType] || "#94a3b8",
    }));

    return {
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        totalPnlPercent: Math.round(totalPnlPercent * 100) / 100,
        totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
        holdingsCount: activeHoldings.length,
        diversification,
    };
}

/**
 * Generates a time series of portfolio value for the evolution chart.
 * Each point represents the state after all transactions on that date.
 */
export function getPortfolioHistory(
    transactions: InvestmentTransaction[],
    currentPrices: Record<string, number>
): PortfolioHistoryPoint[] {
    if (transactions.length === 0) return [];

    const sorted = [...transactions].sort((a, b) => {
        const [da, ma, ya] = a.date.split("/").map(Number);
        const [db, mb, yb] = b.date.split("/").map(Number);
        return (ya - yb) || (ma - mb) || (da - db);
    });

    const points: PortfolioHistoryPoint[] = [];
    const runningHoldings: Record<string, { qty: number; cost: number }> = {};

    // Group by date
    const dateGroups: Record<string, InvestmentTransaction[]> = {};
    for (const tx of sorted) {
        if (!dateGroups[tx.date]) dateGroups[tx.date] = [];
        dateGroups[tx.date].push(tx);
    }

    for (const [date, txs] of Object.entries(dateGroups)) {
        for (const tx of txs) {
            if (!runningHoldings[tx.asset]) {
                runningHoldings[tx.asset] = { qty: 0, cost: 0 };
            }
            const h = runningHoldings[tx.asset];

            if (tx.type === "Compra") {
                h.cost += tx.quantity * tx.unitPrice;
                h.qty += tx.quantity;
            } else {
                const avgCost = h.qty > 0 ? h.cost / h.qty : 0;
                const sellQty = Math.min(tx.quantity, h.qty);
                h.cost -= avgCost * sellQty;
                h.qty -= sellQty;
                if (h.qty < 0.000001) {
                    h.qty = 0;
                    h.cost = 0;
                }
            }
        }

        let invested = 0;
        let value = 0;
        for (const [asset, h] of Object.entries(runningHoldings)) {
            invested += h.cost;
            value += (currentPrices[asset] || 0) * h.qty;
        }

        points.push({
            date,
            invested: Math.round(invested * 100) / 100,
            value: Math.round(value * 100) / 100,
        });
    }

    return points;
}

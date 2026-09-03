// ─────────────────────────────────────────────────────────
// Inversiones — Types & Pure Calculation Functions
// Multi-currency (ARS / USD) & Split Corporate Action Support
// ─────────────────────────────────────────────────────────

/* ─── Types ─── */

export type AssetType = "Acciones" | "Cripto" | "ETFs" | "Cedears" | "Bonos";
export type TransactionType = "Compra" | "Venta" | "Split";
export type Cartera = "Jubilación" | "Crecimiento";
export type Currency = "ARS" | "USD";

export interface InvestmentTransaction {
    id: string;
    date: string;            // "DD/MM/YYYY"
    type: TransactionType;
    asset: string;           // ticker: "AAPL", "BTC", "SPY", "AL30", etc.
    assetType: AssetType;
    quantity: number;        // For Split: multiplier factor (e.g. 10 for 10:1 split)
    unitPrice: number;       // price per unit in transaction currency (0 for Split)
    commission: number;      // broker commission in transaction currency
    cartera: Cartera;        // "Jubilación" | "Crecimiento"
    comment: string;
    currency?: Currency;     // "ARS" | "USD" (defaults to "ARS")
    fxRate?: number;         // Dollar exchange rate at date of transaction
}

export interface PortfolioHolding {
    asset: string;
    assetType: AssetType;
    totalQuantity: number;
    averageCost: number;         // weighted average purchase price in displayCurrency
    totalInvested: number;       // total cost basis in displayCurrency
    totalCommissions: number;    // sum of buy commissions in displayCurrency
    currentPrice: number;        // live or user-entered price in displayCurrency
    currentValue: number;        // currentPrice × totalQuantity in displayCurrency
    pnl: number;                 // unrealized P&L in displayCurrency
    pnlPercent: number;          // pnl / totalInvested × 100
    realizedPnl: number;         // sum of realized gains from sales in displayCurrency
}

export interface PortfolioSummary {
    totalInvested: number;
    totalCurrentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    totalRealizedPnl: number;
    twr: number;
    holdingsCount: number;
    diversification: { label: string; value: number; color: string }[];
    currencyDiversification: { label: string; value: number; color: string }[];
}

export interface PortfolioHistoryPoint {
    date: string;       // "DD/MM/YYYY"
    invested: number;   // accumulated capital invested up to this date
    value: number;      // estimated value at this point (uses last known prices)
    valueByCartera: Record<string, number>;
    twrPercent?: number; // cumulative Time-Weighted Return % up to this date
}

/* ─── Constants ─── */

export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
    Acciones: "#3b82f6",
    Cripto: "#f59e0b",
    ETFs: "#8b5cf6",
    Cedears: "#22c55e",
    Bonos: "#ec4899",
};

export const ASSET_TYPES: AssetType[] = ["Acciones", "Cripto", "ETFs", "Cedears", "Bonos"];
export const CARTERAS: Cartera[] = ["Jubilación", "Crecimiento"];

/* ─── Parsing (Google Sheets row ↔ InvestmentTransaction) ─── */

function parseNum(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;

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

type SheetCell = string | number | boolean | null | undefined;
const str = (v: SheetCell): string => (v === null || v === undefined ? "" : String(v).trim());

/** Parse Google Sheets dates or fallback to string */
function parseDate(value: SheetCell): string {
    if (typeof value === "number") {
        const baseDate = new Date(Date.UTC(1899, 11, 30));
        const date = new Date(baseDate.getTime() + value * 24 * 60 * 60 * 1000);
        const dd = String(date.getUTCDate()).padStart(2, '0');
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = date.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }
    return str(value);
}

export function parseSheetRow(row: SheetCell[]): InvestmentTransaction {
    const rawCurrency = str(row[10]).toUpperCase();
    const currency: Currency = rawCurrency === "USD" ? "USD" : "ARS";
    const fxRate = parseNum(row[11]) || undefined;

    const rawType = str(row[2]);
    let type: TransactionType = "Compra";
    if (rawType === "Venta") type = "Venta";
    else if (rawType === "Split") type = "Split";

    return {
        id:         str(row[0]),
        date:       parseDate(row[1]),
        type,
        asset:      str(row[3]).toUpperCase(),
        assetType:  (str(row[4]) as AssetType)       || "Acciones",
        quantity:   parseNum(row[5]),
        unitPrice:  parseNum(row[6]),
        commission: parseNum(row[7]),
        cartera:    (str(row[8]) as Cartera)          || "Crecimiento",
        comment:    str(row[9]),
        currency,
        fxRate,
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
        tx.currency || "ARS",
        tx.fxRate || 0,
    ];
}

/* ─── Currency Normalization Helper ─── */

/**
 * Converts a transaction unit price and commission to the desired displayCurrency (ARS or USD).
 */
export function getNormalizedTxPrices(
    tx: InvestmentTransaction,
    displayCurrency: Currency,
    fallbackFX: number
): { unitPrice: number; commission: number } {
    if (tx.type === "Split") {
        return { unitPrice: 0, commission: 0 };
    }

    const txCurrency: Currency = tx.currency || "ARS";
    const fx = (tx.fxRate && tx.fxRate > 0) ? tx.fxRate : (fallbackFX > 0 ? fallbackFX : 1);

    if (displayCurrency === "ARS") {
        if (txCurrency === "USD") {
            return {
                unitPrice: tx.unitPrice * fx,
                commission: tx.commission * fx,
            };
        }
        return {
            unitPrice: tx.unitPrice,
            commission: tx.commission,
        };
    } else {
        // displayCurrency === "USD"
        if (txCurrency === "USD") {
            return {
                unitPrice: tx.unitPrice,
                commission: tx.commission,
            };
        }
        return {
            unitPrice: fx > 0 ? tx.unitPrice / fx : tx.unitPrice,
            commission: fx > 0 ? tx.commission / fx : tx.commission,
        };
    }
}

/* ─── Core Calculation Functions ─── */

/**
 * Calculates the weighted average cost of purchase for a set of buy transactions.
 */
export function calculateAverageCost(buys: InvestmentTransaction[]): number {
    let totalCost = 0;
    let totalQty = 0;

    for (const b of buys) {
        if (b.quantity <= 0 || b.type !== "Compra") continue;
        totalCost += b.quantity * b.unitPrice;
        totalQty += b.quantity;
    }

    if (totalQty === 0) return 0;
    return Math.round((totalCost / totalQty) * 100) / 100;
}

/**
 * Builds the full portfolio from a list of transactions and current prices.
 * Supports Multi-currency (ARS / USD) and Split corporate actions.
 */
export function buildPortfolio(
    transactions: InvestmentTransaction[],
    currentPrices: Record<string, number>,
    displayCurrency: Currency = "ARS",
    fallbackFX: number = 1
): PortfolioHolding[] {
    // Sort chronologically
    const sorted = [...transactions].sort((a, b) => {
        const [da, ma, ya] = a.date.split("/").map(Number);
        const [db, mb, yb] = b.date.split("/").map(Number);
        return (ya - yb) || (ma - mb) || (da - db);
    });

    const assets: Record<string, {
        assetType: AssetType;
        totalQuantity: number;
        totalCost: number;       // total cost basis of current holdings in displayCurrency
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
        const { unitPrice, commission } = getNormalizedTxPrices(tx, displayCurrency, fallbackFX);

        if (tx.type === "Compra") {
            a.totalCost += tx.quantity * unitPrice;
            a.totalQuantity += tx.quantity;
            a.totalCommissions += commission;
        } else if (tx.type === "Venta") {
            const avgCost = a.totalQuantity > 0 ? a.totalCost / a.totalQuantity : 0;
            const sellQty = Math.min(tx.quantity, a.totalQuantity);
            const costBasis = avgCost * sellQty;
            const saleRevenue = unitPrice * sellQty - commission;
            a.realizedPnl += saleRevenue - costBasis;

            a.totalCost -= costBasis;
            a.totalQuantity -= sellQty;
            a.totalCommissions += commission;

            if (a.totalQuantity < 0.000001) {
                a.totalQuantity = 0;
                a.totalCost = 0;
            }
        } else if (tx.type === "Split") {
            // Split action: Multiplies quantity, totalCost remains identical, avgCost adjusts
            const factor = tx.quantity > 0 ? tx.quantity : 1;
            a.totalQuantity = a.totalQuantity * factor;
        }
    }

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
 * Calculates the Time-Weighted Return (TWR) of the portfolio.
 * Eliminates cash flow bias and supports Splits.
 */
export function calculateTWR(
    transactions: InvestmentTransaction[],
    currentPrices: Record<string, number>,
    displayCurrency: Currency = "ARS",
    fallbackFX: number = 1
): number {
    if (transactions.length === 0) return 0;

    const sorted = [...transactions].sort((a, b) => {
        const [da, ma, ya] = a.date.split("/").map(Number);
        const [db, mb, yb] = b.date.split("/").map(Number);
        return (ya - yb) || (ma - mb) || (da - db);
    });

    const dateGroups: Record<string, InvestmentTransaction[]> = {};
    for (const tx of sorted) {
        if (!dateGroups[tx.date]) dateGroups[tx.date] = [];
        dateGroups[tx.date].push(tx);
    }
    const dates = Object.keys(dateGroups);

    let twrMultiplier = 1;
    const runningQty: Record<string, number> = {};
    const lastKnownPrice: Record<string, number> = {};
    let previousValueAfter = 0;

    for (const date of dates) {
        const txs = dateGroups[date];

        for (const tx of txs) {
            if (tx.type !== "Split") {
                const { unitPrice } = getNormalizedTxPrices(tx, displayCurrency, fallbackFX);
                lastKnownPrice[tx.asset] = unitPrice;
            }
        }

        let valueBefore = 0;
        for (const [asset, qty] of Object.entries(runningQty)) {
            valueBefore += qty * (lastKnownPrice[asset] || 0);
        }

        if (previousValueAfter > 0) {
            const r = (valueBefore - previousValueAfter) / previousValueAfter;
            twrMultiplier *= (1 + r);
        }

        let netCashFlow = 0;
        for (const tx of txs) {
            const { unitPrice, commission } = getNormalizedTxPrices(tx, displayCurrency, fallbackFX);
            const grossFlow = tx.quantity * unitPrice;

            if (tx.type === "Compra") {
                runningQty[tx.asset] = (runningQty[tx.asset] || 0) + tx.quantity;
                netCashFlow += grossFlow + commission;
            } else if (tx.type === "Venta") {
                runningQty[tx.asset] = Math.max(0, (runningQty[tx.asset] || 0) - tx.quantity);
                netCashFlow -= (grossFlow - commission);
            } else if (tx.type === "Split") {
                const factor = tx.quantity > 0 ? tx.quantity : 1;
                runningQty[tx.asset] = (runningQty[tx.asset] || 0) * factor;
                if (lastKnownPrice[tx.asset]) {
                    lastKnownPrice[tx.asset] /= factor;
                }
            }
        }


        previousValueAfter = valueBefore + netCashFlow;
    }

    let finalValue = 0;
    for (const [asset, qty] of Object.entries(runningQty)) {
        finalValue += qty * (currentPrices[asset] || lastKnownPrice[asset] || 0);
    }

    if (previousValueAfter > 0) {
        const r = (finalValue - previousValueAfter) / previousValueAfter;
        twrMultiplier *= (1 + r);
    }

    return (twrMultiplier - 1) * 100;
}

/**
 * Computes a high-level summary of the entire portfolio.
 */
export function getPortfolioSummary(
    holdings: PortfolioHolding[],
    transactions: InvestmentTransaction[] = [],
    currentPrices: Record<string, number> = {},
    displayCurrency: Currency = "ARS",
    fallbackFX: number = 1
): PortfolioSummary {
    const activeHoldings = holdings.filter(h => h.totalQuantity > 0);

    const totalInvested = activeHoldings.reduce((s, h) => s + h.totalInvested, 0);
    const totalCurrentValue = activeHoldings.reduce((s, h) => s + h.currentValue, 0);
    const totalPnl = totalCurrentValue - totalInvested;
    const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    const totalRealizedPnl = holdings.reduce((s, h) => s + h.realizedPnl, 0);
    const twr = calculateTWR(transactions, currentPrices, displayCurrency, fallbackFX);

    // Diversification by asset type
    const byType: Record<string, number> = {};
    const byCurrency: Record<string, number> = { ARS: 0, USD: 0 };

    for (const h of activeHoldings) {
        byType[h.assetType] = (byType[h.assetType] || 0) + h.currentValue;
        
        if (h.assetType === "Acciones") {
            byCurrency["ARS"] += h.currentValue;
        } else {
            byCurrency["USD"] += h.currentValue;
        }
    }

    const diversification = Object.entries(byType).map(([label, value]) => ({
        label,
        value: Math.round(value * 100) / 100,
        color: ASSET_TYPE_COLORS[label as AssetType] || "#94a3b8",
    }));
    
    const currencyDiversification = Object.entries(byCurrency).map(([label, value]) => ({
        label,
        value: Math.round(value * 100) / 100,
        color: label === "USD" ? "#10b981" : "#3b82f6",
    }));

    return {
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        totalPnlPercent: Math.round(totalPnlPercent * 100) / 100,
        totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
        twr: Math.round(twr * 100) / 100,
        holdingsCount: activeHoldings.length,
        diversification,
        currencyDiversification,
    };
}

/**
 * Generates a time series of portfolio value for the evolution chart.
 */
export function getPortfolioHistory(
    transactions: InvestmentTransaction[],
    currentPrices: Record<string, number>,
    displayCurrency: Currency = "ARS",
    fallbackFX: number = 1
): PortfolioHistoryPoint[] {
    if (transactions.length === 0) return [];

    const sorted = [...transactions].sort((a, b) => {
        const [da, ma, ya] = a.date.split("/").map(Number);
        const [db, mb, yb] = b.date.split("/").map(Number);
        return (ya - yb) || (ma - mb) || (da - db);
    });

    const points: PortfolioHistoryPoint[] = [];
    const runningHoldings: Record<string, { qty: number; cost: number }> = {};
    const runningHoldingsByCartera: Record<string, { qty: number; cost: number }> = {};
    const lastKnownPrice: Record<string, number> = {};

    let twrMultiplier = 1.0;
    let previousValueAfter = 0;

    const dateGroups: Record<string, InvestmentTransaction[]> = {};
    for (const tx of sorted) {
        if (!dateGroups[tx.date]) dateGroups[tx.date] = [];
        dateGroups[tx.date].push(tx);
    }

    const groupEntries = Object.entries(dateGroups);
    for (let idx = 0; idx < groupEntries.length; idx++) {
        const [date, txs] = groupEntries[idx];

        // 1. Calculate portfolio value right before today's transactions
        let valueBefore = 0;
        for (const [asset, h] of Object.entries(runningHoldings)) {
            valueBefore += h.qty * (lastKnownPrice[asset] || 0);
        }

        if (previousValueAfter > 0) {
            const r = (valueBefore - previousValueAfter) / previousValueAfter;
            twrMultiplier *= (1 + r);
        }

        let netCashFlow = 0;
        for (const tx of txs) {
            if (!runningHoldings[tx.asset]) {
                runningHoldings[tx.asset] = { qty: 0, cost: 0 };
            }
            const h = runningHoldings[tx.asset];

            const carteraKey = `${tx.asset}|${tx.cartera}`;
            if (!runningHoldingsByCartera[carteraKey]) {
                runningHoldingsByCartera[carteraKey] = { qty: 0, cost: 0 };
            }
            const hc = runningHoldingsByCartera[carteraKey];

            const { unitPrice, commission } = getNormalizedTxPrices(tx, displayCurrency, fallbackFX);
            const grossFlow = tx.quantity * unitPrice;
            if (unitPrice > 0) {
                lastKnownPrice[tx.asset] = unitPrice;
            }

            if (tx.type === "Compra") {
                h.cost += tx.quantity * unitPrice;
                h.qty += tx.quantity;

                hc.cost += tx.quantity * unitPrice;
                hc.qty += tx.quantity;
                netCashFlow += grossFlow + commission;
            } else if (tx.type === "Venta") {
                const avgCost = h.qty > 0 ? h.cost / h.qty : 0;
                const sellQty = Math.min(tx.quantity, h.qty);
                h.cost -= avgCost * sellQty;
                h.qty -= sellQty;
                if (h.qty < 0.000001) { h.qty = 0; h.cost = 0; }

                const avgCostC = hc.qty > 0 ? hc.cost / hc.qty : 0;
                const sellQtyC = Math.min(tx.quantity, hc.qty);
                hc.cost -= avgCostC * sellQtyC;
                hc.qty -= sellQtyC;
                if (hc.qty < 0.000001) { hc.qty = 0; hc.cost = 0; }
                netCashFlow -= (sellQty * unitPrice - commission);
            } else if (tx.type === "Split") {

                const factor = tx.quantity > 0 ? tx.quantity : 1;
                h.qty *= factor;
                hc.qty *= factor;
                if (lastKnownPrice[tx.asset]) {
                    lastKnownPrice[tx.asset] /= factor;
                }
            }
        }

        previousValueAfter = valueBefore + netCashFlow;

        let invested = 0;
        let value = 0;
        const isLastPoint = (idx === groupEntries.length - 1);

        for (const [asset, h] of Object.entries(runningHoldings)) {
            invested += h.cost;
            const p = currentPrices[asset] || lastKnownPrice[asset] || 0;
            value += p * h.qty;
        }

        // If it's the last point, reflect current price gains into the final TWR
        let pointTWR = twrMultiplier;
        if (isLastPoint && previousValueAfter > 0) {
            const r = (value - previousValueAfter) / previousValueAfter;
            pointTWR = twrMultiplier * (1 + r);
        }

        const valueByCartera: Record<string, number> = {};
        for (const [key, hc] of Object.entries(runningHoldingsByCartera)) {
            const [asset, cartera] = key.split("|");
            const p = currentPrices[asset] || lastKnownPrice[asset] || 0;
            const currentVal = p * hc.qty;
            valueByCartera[cartera] = (valueByCartera[cartera] || 0) + currentVal;
        }

        points.push({
            date,
            invested: Math.round(invested * 100) / 100,
            value: Math.round(value * 100) / 100,
            valueByCartera,
            twrPercent: Math.round((pointTWR - 1) * 10000) / 100,
        });
    }

    points.sort((a, b) => {
        const [da, ma, ya] = a.date.split("/").map(Number);
        const [db, mb, yb] = b.date.split("/").map(Number);
        return (ya - yb) || (ma - mb) || (da - db);
    });

    return points;
}


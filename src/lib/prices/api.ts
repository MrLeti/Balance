// ─────────────────────────────────────────────────────────
// Price APIs for Investments Module
// CoinGecko (Crypto) + DolarAPI CCL (for CEDEARs ARS conversion)
// ─────────────────────────────────────────────────────────

/**
 * Map of common crypto tickers to CoinGecko IDs.
 * Users type "BTC", we need to send "bitcoin" to CoinGecko.
 */
const CRYPTO_ID_MAP: Record<string, string> = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    ADA: "cardano",
    DOT: "polkadot",
    AVAX: "avalanche-2",
    MATIC: "matic-network",
    LINK: "chainlink",
    UNI: "uniswap",
    ATOM: "cosmos",
    XRP: "ripple",
    DOGE: "dogecoin",
    SHIB: "shiba-inu",
    LTC: "litecoin",
    BNB: "binancecoin",
    USDT: "tether",
    USDC: "usd-coin",
    DAI: "dai",
};

export function getCoinGeckoId(ticker: string): string | null {
    return CRYPTO_ID_MAP[ticker.toUpperCase()] || null;
}

/**
 * Fetches current USD prices for a list of crypto tickers from CoinGecko.
 * Returns a map of ticker → USD price.
 */
export async function getCryptoPricesUSD(tickers: string[]): Promise<Record<string, number>> {
    const ids: string[] = [];
    const tickerToId: Record<string, string> = {};

    for (const t of tickers) {
        const id = getCoinGeckoId(t);
        if (id) {
            ids.push(id);
            tickerToId[t.toUpperCase()] = id;
        }
    }

    if (ids.length === 0) return {};

    try {
        const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`,
            { next: { revalidate: 300 } } // Cache 5 min
        );
        if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
        const data = await res.json();

        const prices: Record<string, number> = {};
        for (const [ticker, cgId] of Object.entries(tickerToId)) {
            if (data[cgId]?.usd) {
                prices[ticker] = data[cgId].usd;
            }
        }
        return prices;
    } catch (error) {
        console.error("Error fetching crypto prices from CoinGecko:", error);
        // Fail-Visible: Propagamos el error para que el frontend lo muestre al usuario
        // en vez de mostrar $0 silenciosamente y un P&L de -100%.
        throw new Error("No se pudieron obtener los precios de criptomonedas (CoinGecko). Intente nuevamente.");
    }
}

/**
 * Fetches the current Dólar CCL (Contado con Liquidación) sell price.
 * Used to convert USD prices to ARS for CEDEARs.
 */
export async function getDolarCCL(): Promise<number> {
    try {
        const res = await fetch("https://dolarapi.com/v1/dolares/contadoconliqui", {
            next: { revalidate: 300 },
        });
        if (!res.ok) throw new Error(`DolarAPI responded ${res.status}`);
        const data = await res.json();

        if (!data.venta) {
            throw new Error("No se encontró precio de venta CCL en la DolarAPI.");
        }

        return data.venta as number;
    } catch (error) {
        console.error("Error fetching Dólar CCL:", error);
        throw new Error("No se pudo obtener el tipo de cambio CCL.");
    }
}

/**
 * Common CEDEAR ratio map: how many CEDEARs represent 1 share of the underlying US stock.
 * ratio = CEDEARs per 1 original share. 
 * CEDEAR ARS price ≈ (US stock price in USD / ratio) × CCL
 */
const CEDEAR_RATIOS: Record<string, number> = {
    AAPL: 10,
    MSFT: 5,
    GOOGL: 14,
    AMZN: 72,
    META: 6,
    TSLA: 15,
    NVDA: 5,
    NFLX: 4,
    DIS: 4,
    KO: 5,
    PEP: 5,
    JPM: 3,
    V: 5,
    MA: 4,
    BA: 5,
    NKE: 5,
    BABA: 18,
    MELI: 2,
    GLOB: 4,
    AMD: 5,
    INTC: 10,
    PYPL: 10,
    SNAP: 30,
    UBER: 10,
    SPOT: 4,
    WMT: 5,
    PG: 5,
    JNJ: 3,
    XOM: 5,
    CVX: 3,
    GS: 2,
    ABBV: 3,
    PFE: 12,
    MRK: 5,
    T: 20,
    VZ: 10,
    CSCO: 10,
    ORCL: 5,
    CRM: 5,
    ADBE: 5,
    QCOM: 5,
    TXN: 5,
    SBUX: 5,
    MCD: 3,
    HD: 3,
    CAT: 3,
    MMM: 3,
    IBM: 3,
    GE: 4,
    F: 20,
    GM: 5,
    X: 10,
    VALE: 10,
    PBR: 10,
    GOLD: 10,
    DESP: 30,
    BIOX: 10,
    NU: 5,
    SPY: 5,
    QQQ: 5,
    EEM: 10,
    EWZ: 10,
    XLE: 10,
    XLF: 10,
    ARKK: 10,
    IWM: 5,
    DIA: 2,
    GLD: 5,
    SLV: 10,
    TLT: 5,
    HYG: 5,
};

export function getCedearRatio(ticker: string): number {
    return CEDEAR_RATIOS[ticker.toUpperCase()] || 1;
}

/**
 * Gets the list of known CEDEAR tickers.
 */
export function getKnownCedearTickers(): string[] {
    return Object.keys(CEDEAR_RATIOS);
}

/**
 * Fetches current USD prices for a list of stock/ETF/CEDEAR tickers using Yahoo Finance.
 * Uses the v8/finance/chart endpoint which is publicly accessible (v7/quote requires OAuth).
 * Requests are fired in parallel with Promise.allSettled so one bad ticker doesn't block the rest.
 */
export async function getEquityPricesUSD(tickers: string[]): Promise<Record<string, number>> {
    if (tickers.length === 0) return {};

    const YAHOO_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
    };

    const results = await Promise.allSettled(
        tickers.map(async (ticker) => {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
            const res = await fetch(url, {
                headers: YAHOO_HEADERS,
                next: { revalidate: 300 }, // Cache 5 min
            });

            if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} for ${ticker}`);

            const data = await res.json();
            const price: number = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;

            if (price <= 0) throw new Error(`No price data for ${ticker}`);

            return { ticker: ticker.toUpperCase(), price };
        })
    );

    const prices: Record<string, number> = {};
    for (const result of results) {
        if (result.status === "fulfilled") {
            prices[result.value.ticker] = result.value.price;
        } else {
            // Log but don't propagate — other tickers still succeed
            console.warn("Yahoo Finance price fetch failed:", result.reason);
        }
    }

    return prices;
}



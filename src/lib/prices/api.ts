// ─────────────────────────────────────────────────────────
// Price APIs for Investments Module
// Binance + CoinGecko (Crypto)
// Yahoo Finance + analisistecnico.com.ar (Argentine Equities / CEDEARs / Bonos)
// DolarAPI (CCL & MEP)
// ─────────────────────────────────────────────────────────

import { getCurrentDolarCCL } from "@/lib/dolar/api";

export { getCurrentDolarCCL as getDolarCCL };

/**
 * Map of common crypto tickers to CoinGecko IDs (for CoinGecko fallback).
 */
const CRYPTO_ID_MAP: Record<string, string> = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    ADA: "cardano",
    DOT: "polkadot",
    AVAX: "avalanche-2",
    MATIC: "matic-network",
    POL: "matic-network",
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
 * Fetches current USD prices for crypto tickers.
 * Primary: Binance Public API.
 * Fallback: CoinGecko Simple Price API.
 */
export async function getCryptoPricesUSD(tickers: string[]): Promise<Record<string, number>> {
    if (tickers.length === 0) return {};

    const uniqueTickers = [...new Set(tickers.map(t => t.toUpperCase()))];
    const prices: Record<string, number> = {};
    const remainingTickers: string[] = [];

    // 1. Try Binance API (High limit, fast, no API key needed)
    try {
        const binanceSymbols = uniqueTickers.map(t => {
            if (t === "USDT") return "USDCUSDT";
            return `${t}USDT`;
        });

        const symbolsParam = encodeURIComponent(JSON.stringify(binanceSymbols));
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${symbolsParam}`, {
            next: { revalidate: 120 }, // Cache 2 min
        });

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                for (const item of data) {
                    const price = parseFloat(item.price);
                    if (item.symbol === "USDCUSDT") {
                        prices["USDT"] = 1.0;
                    } else if (item.symbol.endsWith("USDT")) {
                        const rawTicker = item.symbol.replace("USDT", "");
                        if (price > 0) {
                            prices[rawTicker] = price;
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.warn("Binance API fetch failed, trying CoinGecko fallback:", err);
    }

    // Identify missing tickers for CoinGecko fallback
    for (const t of uniqueTickers) {
        if (t === "USDT" || t === "USDC" || t === "DAI") {
            if (!prices[t]) prices[t] = 1.0;
        } else if (!prices[t]) {
            remainingTickers.push(t);
        }
    }

    // 2. Fallback to CoinGecko for missing tickers
    if (remainingTickers.length > 0) {
        const ids: string[] = [];
        const tickerToId: Record<string, string> = {};

        for (const t of remainingTickers) {
            const id = getCoinGeckoId(t);
            if (id) {
                ids.push(id);
                tickerToId[t] = id;
            }
        }

        if (ids.length > 0) {
            try {
                const res = await fetch(
                    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`,
                    { next: { revalidate: 300 } }
                );
                if (res.ok) {
                    const data = await res.json();
                    for (const [ticker, cgId] of Object.entries(tickerToId)) {
                        if (data[cgId]?.usd) {
                            prices[ticker] = data[cgId].usd;
                        }
                    }
                }
            } catch (cgErr) {
                console.warn("CoinGecko fallback failed:", cgErr);
            }
        }
    }

    return prices;
}

export interface EquityQuote {
    price: number;
    currency: "ARS" | "USD";
    source: string;
}

/**
 * Fetches quote and detects currency from Yahoo Finance (.BA or raw symbol)
 */
async function fetchYahooPrice(
    ticker: string,
    registeredCurrency?: "ARS" | "USD"
): Promise<{ price: number; currency: "ARS" | "USD" } | null> {
    const cleanTicker = ticker.toUpperCase();
    const symbolsToTry = [`${cleanTicker}.BA`, cleanTicker];

    for (const symbol of symbolsToTry) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
                next: { revalidate: 180 }, // Cache 3 min
            });

            if (res.ok) {
                const data = await res.json();
                const meta = data?.chart?.result?.[0]?.meta;
                const price = Number(meta?.regularMarketPrice);
                if (!isNaN(price) && price > 0) {
                    const rawCurr = String(meta?.currency || "").toUpperCase();
                    let isUSD = false;
                    if (rawCurr === "USD") {
                        isUSD = true;
                    } else if (rawCurr === "ARS") {
                        isUSD = false;
                    } else {
                        // Fallback a la moneda registrada por el usuario
                        isUSD = registeredCurrency === "USD";
                    }

                    return {
                        price,
                        currency: isUSD ? "USD" : "ARS",
                    };
                }
            }
        } catch {
            // Try next symbol format
        }
    }
    return null;
}

/**
 * Fetches quote from analisistecnico.com.ar datafeed
 */
async function fetchAnalisisTecnicoPrice(
    ticker: string,
    type: string,
    registeredCurrency?: "ARS" | "USD"
): Promise<{ price: number; currency: "ARS" | "USD" } | null> {
    try {
        const cleanTicker = ticker.toUpperCase();
        const now = Math.floor(Date.now() / 1000);
        const from = now - 14 * 86400; // last 14 days
        
        let typeSuffix = "CEDEAR";
        if (type === "Acciones") typeSuffix = "ACCIONES";
        else if (type === "Bonos") typeSuffix = "BONOS";

        const symbolsToTry = [
            `${cleanTicker}:${typeSuffix}`,
            cleanTicker,
        ];

        for (const sym of symbolsToTry) {
            const url = `https://analisistecnico.com.ar/services/datafeed/history?symbol=${encodeURIComponent(sym)}&resolution=D&from=${from}&to=${now}`;
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json",
                    "Referer": "https://analisistecnico.com.ar/",
                },
                next: { revalidate: 300 },
            });

            if (res.ok) {
                const data = await res.json();
                if (data.s === "ok" && Array.isArray(data.c) && data.c.length > 0) {
                    const price = Number(data.c[data.c.length - 1]);
                    if (price > 0) {
                        return {
                            price,
                            currency: registeredCurrency || "ARS",
                        };
                    }
                }
            }
        }
    } catch {
        // Handled by caller
    }
    return null;
}

/**
 * Fetches current prices for Argentine equities & bonds (CEDEARs, ETFs, Acciones, Bonos)
 * Correctly detects and preserves the quote currency (ARS vs USD) based on API meta and user register.
 */
export async function getArgentineEquityPrices(
    tickers: { ticker: string; type: string; currency?: "ARS" | "USD" }[]
): Promise<Record<string, EquityQuote>> {
    if (tickers.length === 0) return {};

    const results = await Promise.allSettled(
        tickers.map(async ({ ticker, type, currency }) => {
            const cleanTicker = ticker.toUpperCase();

            // 1. Try Yahoo Finance
            const yahoo = await fetchYahooPrice(cleanTicker, currency);
            if (yahoo !== null && yahoo.price > 0) {
                return {
                    ticker: cleanTicker,
                    price: yahoo.price,
                    currency: yahoo.currency,
                    source: "Yahoo Finance",
                };
            }

            // 2. Fallback to analisistecnico.com.ar
            const at = await fetchAnalisisTecnicoPrice(cleanTicker, type, currency);
            if (at !== null && at.price > 0) {
                return {
                    ticker: cleanTicker,
                    price: at.price,
                    currency: at.currency,
                    source: "BYMA (analisistecnico)",
                };
            }

            return { ticker: cleanTicker, price: 0, currency: (currency || "ARS") as "ARS" | "USD", source: "no_data" };
        })
    );

    const quotes: Record<string, EquityQuote> = {};
    for (const result of results) {
        if (result.status === "fulfilled" && result.value.price > 0) {
            quotes[result.value.ticker] = {
                price: result.value.price,
                currency: result.value.currency,
                source: result.value.source,
            };
        }
    }

    return quotes;
}


// Alias for backwards compatibility
export { getArgentineEquityPrices as getArgentineEquityPricesARS };


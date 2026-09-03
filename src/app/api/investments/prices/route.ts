import { NextResponse } from "next/server";
import { getCryptoPricesUSD, getDolarCCL, getArgentineEquityPrices, type EquityQuote } from "@/lib/prices/api";
import { getCurrentDolarMEP } from "@/lib/dolar/api";
import { createClient } from "@/lib/supabase/server";
import { safeErrorResponse } from "@/lib/utils/api-error";

/**
 * GET /api/investments/prices?assets=BTC,ETH,GLD,SPY&types=Cripto,Cripto,ETFs,Cedears
 * Returns dual ARS and USD prices for each asset.
 */
export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const assetsParam = searchParams.get("assets");
        const typesParam = searchParams.get("types");
        const currenciesParam = searchParams.get("currencies");

        if (!assetsParam || !typesParam) {
            return NextResponse.json({ error: "Faltan parámetros." }, { status: 400 });
        }

        const assets = assetsParam.split(",").map(a => a.trim().toUpperCase());
        const types  = typesParam.split(",").map(t => t.trim());
        const currencies = currenciesParam ? currenciesParam.split(",").map(c => c.trim().toUpperCase()) : [];

        if (assets.length !== types.length) {
            return NextResponse.json({ error: "assets y types deben tener la misma longitud." }, { status: 400 });
        }

        // Separate by type
        const cryptoTickers: string[] = [];
        const equityPairs: { ticker: string; type: string; currency?: "ARS" | "USD" }[] = [];

        for (let i = 0; i < assets.length; i++) {
            const rawCurr = currencies[i] === "USD" ? "USD" : "ARS";
            if (types[i] === "Cripto") {
                cryptoTickers.push(assets[i]);
            } else {
                equityPairs.push({
                    ticker: assets[i],
                    type: types[i],
                    currency: (currencies[i] as "ARS" | "USD") || rawCurr,
                });
            }
        }


        const warnings: string[] = [];

        // Fetch live prices and CCL/MEP in parallel
        const [cryptoResult, equityResult, cclResult, mepResult] = await Promise.allSettled([
            cryptoTickers.length > 0
                ? getCryptoPricesUSD(cryptoTickers)
                : Promise.resolve({} as Record<string, number>),
            equityPairs.length > 0
                ? getArgentineEquityPrices(equityPairs)
                : Promise.resolve({} as Record<string, EquityQuote>),
            getDolarCCL(),
            getCurrentDolarMEP(),
        ]);

        const cryptoUSD = cryptoResult.status === "fulfilled" ? cryptoResult.value : {} as Record<string, number>;
        if (cryptoResult.status === "rejected") {
            warnings.push("⚠️ Falló consulta de precios cripto.");
        }

        const equityQuotes = equityResult.status === "fulfilled" ? equityResult.value : {} as Record<string, EquityQuote>;
        if (equityResult.status === "rejected") {
            warnings.push("⚠️ Falló consulta de cotizaciones BYMA / Yahoo Finance.");
        }


        const cclRate = cclResult.status === "fulfilled" ? cclResult.value : 0;
        if (cclResult.status === "rejected") {
            warnings.push("⚠️ No se pudo obtener el tipo de cambio CCL actual.");
        }

        const mepRate = mepResult.status === "fulfilled" ? mepResult.value : 0;
        if (mepResult.status === "rejected") {
            warnings.push("⚠️ No se pudo obtener el tipo de cambio MEP actual.");
        }

        // Try reading cached / manual prices from Supabase
        const cachedPrices: Record<string, { price_ars: number; price_usd: number; source: string }> = {};
        try {
            const { data: dbPrices } = await supabase
                .from("asset_prices")
                .select("asset, price_ars, price_usd, source")
                .in("asset", assets);

            if (dbPrices) {
                for (const p of dbPrices) {
                    cachedPrices[p.asset] = {
                        price_ars: Number(p.price_ars) || 0,
                        price_usd: Number(p.price_usd) || 0,
                        source: p.source || "Cache",
                    };
                }
            }
        } catch {
            // Non-blocking cache fallback
        }

        // Build response
        const prices: Record<string, { ars: number; usd: number; source: string }> = {};
        const toUpsert: { asset: string; price_ars: number; price_usd: number; source: string; updated_at: string }[] = [];

        // 1. Process Crypto
        const fxRateToUse = mepRate > 0 ? mepRate : cclRate;

        for (const ticker of cryptoTickers) {
            let usdPrice = cryptoUSD[ticker] || 0;
            let arsPrice = (usdPrice > 0 && fxRateToUse > 0) ? Math.round(usdPrice * fxRateToUse * 100) / 100 : 0;
            let source = usdPrice > 0 ? "Binance / CoinGecko" : "no_data";

            if (usdPrice <= 0 && cachedPrices[ticker]) {
                usdPrice = cachedPrices[ticker].price_usd;
                arsPrice = cachedPrices[ticker].price_ars || (fxRateToUse > 0 ? usdPrice * fxRateToUse : 0);
                source = `Guardado (${cachedPrices[ticker].source})`;
            }

            prices[ticker] = { ars: arsPrice, usd: usdPrice, source };

            if (usdPrice > 0) {
                toUpsert.push({
                    asset: ticker,
                    price_ars: arsPrice,
                    price_usd: usdPrice,
                    source: "Binance/CoinGecko",
                    updated_at: new Date().toISOString(),
                });
            }
        }

        // 2. Process Equities (Acciones, CEDEARs, ETFs, Bonos)
        for (const { ticker, currency: registeredCurrency } of equityPairs) {
            const eqData = equityQuotes[ticker];
            let arsPrice = 0;
            let usdPrice = 0;
            let source = "no_data";

            if (eqData && eqData.price > 0) {
                source = eqData.source;
                if (eqData.currency === "USD") {
                    usdPrice = eqData.price;
                    arsPrice = fxRateToUse > 0 ? Math.round(usdPrice * fxRateToUse * 100) / 100 : 0;
                } else {
                    arsPrice = eqData.price;
                    usdPrice = fxRateToUse > 0 ? Math.round((arsPrice / fxRateToUse) * 100) / 100 : 0;
                }
            } else if (cachedPrices[ticker]) {
                const cached = cachedPrices[ticker];
                source = `Guardado (${cached.source})`;
                if (registeredCurrency === "USD") {
                    usdPrice = cached.price_usd || cached.price_ars;
                    arsPrice = fxRateToUse > 0 ? Math.round(usdPrice * fxRateToUse * 100) / 100 : usdPrice;
                } else {
                    arsPrice = cached.price_ars || cached.price_usd;
                    usdPrice = fxRateToUse > 0 ? Math.round((arsPrice / fxRateToUse) * 100) / 100 : 0;
                }
            }

            prices[ticker] = { ars: arsPrice, usd: usdPrice, source };


            if (arsPrice > 0 || usdPrice > 0) {
                toUpsert.push({
                    asset: ticker,
                    price_ars: arsPrice,
                    price_usd: usdPrice,
                    source: eqData?.source || "Cache",
                    updated_at: new Date().toISOString(),
                });
            }
        }


        // Background cache upsert (non-blocking)
        if (toUpsert.length > 0) {
            supabase
                .from("asset_prices")
                .upsert(toUpsert, { onConflict: "asset" })
                .then(({ error }) => {
                    if (error) console.warn("Notice: Could not upsert asset_prices cache:", error.message);
                });
        }

        return NextResponse.json(
            { prices, mepRate: fxRateToUse, cclRate, warnings, timestamp: new Date().toISOString() },
            { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } }
        );

    } catch (error: unknown) {
        console.error("Error fetching prices:", error);
        return NextResponse.json({ error: "Error al obtener precios." }, { status: 500 });
    }
}

/**
 * POST /api/investments/prices
 * Allows manually setting and persisting a custom price for an asset.
 */
export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { asset, price_ars, price_usd } = body as {
            asset: string;
            price_ars?: number;
            price_usd?: number;
        };

        if (!asset || (price_ars === undefined && price_usd === undefined)) {
            return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
        }

        let mepRate = 0;
        try {
            mepRate = await getCurrentDolarMEP();
        } catch {
            // Optional
        }

        const finalArs = price_ars !== undefined
            ? Number(price_ars)
            : (price_usd !== undefined && mepRate > 0 ? Number(price_usd) * mepRate : 0);

        const finalUsd = price_usd !== undefined
            ? Number(price_usd)
            : (price_ars !== undefined && mepRate > 0 ? Number(price_ars) / mepRate : 0);


        const { error } = await supabase.from("asset_prices").upsert({
            asset: asset.toUpperCase().trim(),
            price_ars: finalArs,
            price_usd: finalUsd,
            source: "Manual",
            updated_at: new Date().toISOString(),
        }, { onConflict: "asset" });

        if (error) {
            console.error("Error saving manual price in Supabase:", error);
            throw new Error(`Error en base de datos: ${error.message}`);
        }

        return NextResponse.json({
            success: true,
            asset: asset.toUpperCase().trim(),
            price_ars: finalArs,
            price_usd: finalUsd,
            source: "Manual"
        });

    } catch (error: unknown) {
        console.error("Error saving manual price:", error);
        return NextResponse.json(safeErrorResponse(error, "Error al guardar precio manual"), { status: 500 });
    }
}


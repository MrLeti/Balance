import { NextResponse } from "next/server";
import { getCryptoPricesUSD, getDolarCCL, getArgentineEquityPricesARS } from "@/lib/prices/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/investments/prices?assets=BTC,ETH,GLD,SPY&types=Cripto,Cripto,ETFs,Cedears
 * Returns ARS prices for each asset based on its type.
 *
 * Cripto:           CoinGecko (USD) → CCL → ARS
 * Cedears/ETFs:     analisistecnico.com.ar → ARS directo (precios BYMA reales)
 * Acciones locales: analisistecnico.com.ar → ARS directo
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const assetsParam = searchParams.get("assets");
        const typesParam = searchParams.get("types");

        if (!assetsParam || !typesParam) {
            return NextResponse.json({ error: "Faltan parámetros." }, { status: 400 });
        }

        const assets = assetsParam.split(",").map(a => a.trim().toUpperCase());
        const types  = typesParam.split(",").map(t => t.trim());

        if (assets.length !== types.length) {
            return NextResponse.json({ error: "assets y types deben tener la misma longitud." }, { status: 400 });
        }

        // Separate by type
        const cryptoTickers: string[] = [];
        const equityPairs: { ticker: string; type: string }[] = [];

        for (let i = 0; i < assets.length; i++) {
            if (types[i] === "Cripto") {
                cryptoTickers.push(assets[i]);
            } else {
                equityPairs.push({ ticker: assets[i], type: types[i] });
            }
        }

        // Fetch in parallel — graceful degradation via allSettled
        const warnings: string[] = [];

        const [cryptoResult, equityResult, cclResult] = await Promise.allSettled([
            cryptoTickers.length > 0
                ? getCryptoPricesUSD(cryptoTickers)
                : Promise.resolve({} as Record<string, number>),
            equityPairs.length > 0
                ? getArgentineEquityPricesARS(equityPairs)
                : Promise.resolve({} as Record<string, number>),
            getDolarCCL(),
        ]);

        const cryptoUSD = cryptoResult.status  === "fulfilled" ? cryptoResult.value  : {} as Record<string, number>;
        if (cryptoResult.status === "rejected") {
            warnings.push("⚠️ No se pudieron obtener precios de criptomonedas (CoinGecko).");
            console.error("CoinGecko failed:", cryptoResult.reason);
        }

        const equityARS = equityResult.status  === "fulfilled" ? equityResult.value  : {} as Record<string, number>;
        if (equityResult.status === "rejected") {
            warnings.push("⚠️ No se pudieron obtener precios de CEDEARs/ETFs (analisistecnico.com.ar).");
            console.error("analisistecnico failed:", equityResult.reason);
        }

        const cclRate = cclResult.status === "fulfilled" ? cclResult.value : 0;
        if (cclResult.status === "rejected") {
            warnings.push("⚠️ No se pudo obtener el tipo de cambio CCL.");
            console.error("DolarCCL failed:", cclResult.reason);
        }

        // Build response
        const prices: Record<string, { ars: number; usd: number; source: string }> = {};

        // Crypto: USD × CCL → ARS
        for (const ticker of cryptoTickers) {
            const usdPrice = cryptoUSD[ticker] || 0;
            prices[ticker] = {
                usd: usdPrice,
                ars: cclRate > 0 ? Math.round(usdPrice * cclRate * 100) / 100 : 0,
                source: usdPrice > 0 ? "CoinGecko" : "no_data",
            };
        }

        // Equities: precio directo en ARS desde analisistecnico (BYMA)
        for (const { ticker } of equityPairs) {
            const arsPrice = equityARS[ticker] || 0;
            prices[ticker] = {
                usd: 0,          // no necesitamos el USD para nada — el ARS ya es correcto
                ars: arsPrice,
                source: arsPrice > 0 ? "BYMA (analisistecnico)" : "no_data",
            };
        }

        return NextResponse.json({ prices, cclRate, warnings, timestamp: new Date().toISOString() });

    } catch (error: unknown) {
        console.error("Error fetching prices:", error);
        return NextResponse.json({ error: "Error al obtener precios." }, { status: 500 });
    }
}

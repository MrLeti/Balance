import { NextResponse } from "next/server";
import { getCryptoPricesUSD, getDolarCCL, getCedearRatio, getEquityPricesUSD } from "@/lib/prices/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/investments/prices?assets=BTC,ETH,AAPL&types=Cripto,Cripto,Cedears
 * Returns ARS prices for each asset based on its type.
 * - Cripto: CoinGecko (USD) → CCL → ARS
 * - Cedears/Acciones/ETFs: Yahoo Finance (USD) × CEDEAR ratio → CCL → ARS
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
        const types = typesParam.split(",").map(t => t.trim());

        if (assets.length !== types.length) {
            return NextResponse.json({ error: "assets y types deben tener la misma longitud." }, { status: 400 });
        }

        // Separate by type
        const cryptoTickers: string[] = [];
        const equityTickers: string[] = []; // Acciones, ETFs, Cedears

        for (let i = 0; i < assets.length; i++) {
            if (types[i] === "Cripto") {
                cryptoTickers.push(assets[i]);
            } else {
                equityTickers.push(assets[i]);
            }
        }

        // Fetch prices in parallel — usamos allSettled para degradación parcial
        const warnings: string[] = [];

        const [cryptoResult, equityResult, cclResult] = await Promise.allSettled([
            cryptoTickers.length > 0 ? getCryptoPricesUSD(cryptoTickers) : Promise.resolve({} as Record<string, number>),
            equityTickers.length > 0 ? getEquityPricesUSD(equityTickers) : Promise.resolve({} as Record<string, number>),
            getDolarCCL(),
        ]);

        const cryptoUSD = cryptoResult.status === "fulfilled" ? cryptoResult.value : {} as Record<string, number>;
        if (cryptoResult.status === "rejected") {
            warnings.push("⚠️ No se pudieron obtener precios de criptomonedas (CoinGecko caído). Los valores de crypto no están actualizados.");
            console.error("CoinGecko failed:", cryptoResult.reason);
        }

        const equityUSD = equityResult.status === "fulfilled" ? equityResult.value : {} as Record<string, number>;
        if (equityResult.status === "rejected") {
            warnings.push("⚠️ No se pudieron obtener precios de acciones/ETFs (Yahoo Finance caído).");
            console.error("Yahoo Finance failed:", equityResult.reason);
        }

        const cclRate = cclResult.status === "fulfilled" ? cclResult.value : 0;
        if (cclResult.status === "rejected") {
            warnings.push("⚠️ No se pudo obtener el tipo de cambio CCL. Los valores en ARS de crypto no están disponibles.");
            console.error("DolarCCL failed:", cclResult.reason);
        }

        // Build price map in ARS
        const prices: Record<string, { ars: number; usd: number; source: string }> = {};

        // Crypto: USD → ARS via CCL
        for (const ticker of cryptoTickers) {
            const usdPrice = cryptoUSD[ticker] || 0;
            prices[ticker] = {
                usd: usdPrice,
                ars: cclRate > 0 ? Math.round(usdPrice * cclRate * 100) / 100 : 0,
                source: usdPrice > 0 ? "CoinGecko" : "no_data",
            };
        }

        // Equities: solo referencia USD. El usuario ingresa el precio ARS manualmente.
        for (let i = 0; i < assets.length; i++) {
            const ticker = assets[i];
            const type = types[i];

            if (type === "Cripto") continue;

            const usdPrice = equityUSD[ticker] || 0;

            prices[ticker] = {
                usd: usdPrice,
                ars: 0,
                source: usdPrice > 0 ? "Yahoo Finance (USD ref)" : "no_data",
            };
        }

        return NextResponse.json({
            prices,
            cclRate,
            warnings,
            timestamp: new Date().toISOString(),
        });
    } catch (error: unknown) {
        console.error("Error fetching prices:", error);
        return NextResponse.json(
            { error: "Error al obtener precios." },
            { status: 500 }
        );
    }
}

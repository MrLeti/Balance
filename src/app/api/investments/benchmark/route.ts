import { NextResponse } from "next/server";

export async function GET() {
    try {
        const [spyRes, mepRes, infRes] = await Promise.allSettled([
            // 1. S&P 500 (SPY) from Yahoo Finance
            fetch("https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=5y", {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                next: { revalidate: 3600 },
            }).then(r => r.json()),

            // 2. Dólar MEP histórico from ArgentinaDatos
            fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa", {
                headers: { "Accept": "application/json" },
                next: { revalidate: 3600 },
            }).then(r => r.json()),

            // 3. Inflación mensual (IPC) from ArgentinaDatos
            fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion", {
                headers: { "Accept": "application/json" },
                next: { revalidate: 3600 },
            }).then(r => r.json()),
        ]);

        // Process SPY
        let sp500: { timestamp: number; price: number }[] = [];
        if (spyRes.status === "fulfilled" && spyRes.value?.chart?.result?.[0]) {
            const res = spyRes.value.chart.result[0];
            const timestamps: number[] = res.timestamp || [];
            const quotes: number[] = res.indicators?.quote?.[0]?.close || [];
            for (let i = 0; i < timestamps.length; i++) {
                if (quotes[i] && quotes[i] > 0) {
                    sp500.push({
                        timestamp: timestamps[i],
                        price: quotes[i],
                    });
                }
            }
        }

        // Process MEP
        let mep: { date: string; rate: number }[] = [];
        if (mepRes.status === "fulfilled" && Array.isArray(mepRes.value)) {
            mep = mepRes.value.map((item: any) => ({
                date: item.fecha, // "YYYY-MM-DD"
                rate: Number(item.venta || item.compra || 0),
            })).filter(m => m.rate > 0);
        }

        // Process Inflation (IPC monthly %)
        let inflation: { date: string; rate: number }[] = [];
        if (infRes.status === "fulfilled" && Array.isArray(infRes.value)) {
            inflation = infRes.value.map((item: any) => ({
                date: item.fecha, // "YYYY-MM-DD"
                rate: Number(item.valor || 0),
            }));
        }

        return NextResponse.json({
            sp500,
            mep,
            inflation,
        }, {
            headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' }
        });

    } catch (error: unknown) {
        console.error("Error fetching benchmark data:", error);
        return NextResponse.json(
            { error: "Error al obtener datos de benchmark." },
            { status: 500 }
        );
    }
}


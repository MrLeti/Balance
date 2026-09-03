import { NextRequest, NextResponse } from "next/server";
import { getCurrentDolarMEP, getHistoricalDolarMEPWithFallback } from "@/lib/dolar/api";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get("date")?.trim() || "";

        let fxRate: number | null = null;
        let isLive = false;

        if (dateParam) {
            // Comprobar si la fecha es hoy
            const now = new Date();
            const todayDD = String(now.getDate()).padStart(2, "0");
            const todayMM = String(now.getMonth() + 1).padStart(2, "0");
            const todayYYYY = String(now.getFullYear());
            const todayStr = `${todayDD}/${todayMM}/${todayYYYY}`;

            if (dateParam === todayStr) {
                try {
                    fxRate = await getCurrentDolarMEP();
                    isLive = true;
                } catch {
                    fxRate = await getHistoricalDolarMEPWithFallback(dateParam);
                }
            } else {
                fxRate = await getHistoricalDolarMEPWithFallback(dateParam);
            }
        }

        if (!fxRate || fxRate <= 0) {
            try {
                fxRate = await getCurrentDolarMEP();
                isLive = true;
            } catch {
                fxRate = null;
            }
        }

        return NextResponse.json({
            success: true,
            fxRate: fxRate || 0,
            date: dateParam || "live",
            isLive,
        });
    } catch (error: unknown) {
        console.error("Error en GET /api/investments/fx-rate:", error);
        return NextResponse.json(
            { error: "Error al obtener cotización del dólar." },
            { status: 500 }
        );
    }
}
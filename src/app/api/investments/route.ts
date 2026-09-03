import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSafeAmount } from "@/lib/utils/format";
import { getHistoricalDolar, getCurrentDolarCCL } from "@/lib/dolar/api";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { data: sbData, error } = await supabase
            .from("investments")
            .select("*")
            .eq("user_id", user.id)
            .order("date", { ascending: true })
            .limit(10000);

        if (error) {
            console.error("Error consultando inversiones:", error);
            throw error;
        }

        const enrichedRows = await Promise.all(
            (sbData || []).map(async (inv) => {
                let formattedDate = inv.date;
                if (inv.date && inv.date.includes("-")) {
                    const [y, m, d] = inv.date.split("-");
                    formattedDate = `${d}/${m}/${y}`;
                }

                let fxRate = Number(inv.fx_rate) || 0;
                if (fxRate <= 0 && formattedDate) {
                    const histRate = await getHistoricalDolar(formattedDate, "ccl");
                    if (histRate && histRate > 0) {
                        fxRate = histRate;
                    }
                }

                return [
                    inv.id,
                    formattedDate,
                    inv.operation || "Compra",
                    inv.asset,
                    inv.asset_type,
                    Number(inv.quantity) || 0,
                    Number(inv.unit_price) || 0,
                    Number(inv.commission) || 0,
                    inv.cartera || "Crecimiento",
                    inv.comment || "",
                    inv.currency || "ARS",
                    fxRate,
                ];
            })
        );

        return NextResponse.json({ data: enrichedRows, source: "supabase" });
    } catch (error: unknown) {
        console.error("Error consultando inversiones:", error);
        return NextResponse.json(
            { error: "Error al obtener las inversiones." },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { items } = body as { items: (string | number)[][] };

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "El cuerpo de la solicitud debe contener un array 'items' con al menos un elemento." },
                { status: 400 }
            );
        }

        let liveCCL = 0;
        try {
            liveCCL = await getCurrentDolarCCL();
        } catch {
            // Optional fallback
        }

        const cleanItems = await Promise.all(
            items.map(async (row: (string | number)[]) => {
                const transactionId = crypto.randomUUID();

                const dateStr = String(row[0] || "");
                let isoDate = dateStr;
                if (dateStr.includes("/")) {
                    const parts = dateStr.split("/");
                    if (parts.length === 3) {
                        isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                    }
                }

                const cleanAsset = String(row[2] || "").trim().toUpperCase();
                if (!cleanAsset) {
                    throw new Error("El ticker o nombre del activo es obligatorio.");
                }

                const rawQty = String(row[4] || "0").replace(/,/g, ".");
                // Soporte satoshi para Bitcoin / Cripto: 8 decimales
                const qty = Math.round((parseFloat(rawQty) || 0) * 1e8) / 1e8;
                if (qty <= 0) {
                    throw new Error(`La cantidad de ${cleanAsset} debe ser mayor a cero.`);
                }

                const numPrice = parseSafeAmount(row[5]);
                const operation = String(row[1] || "Compra");
                if (operation !== "Split" && numPrice <= 0) {
                    throw new Error(`El precio unitario de ${cleanAsset} debe ser mayor a cero.`);
                }

                const numCommission = parseSafeAmount(row[6]);
                if (numCommission < 0) {
                    throw new Error("La comisión no puede ser un importe negativo.");
                }

                const currency = String(row[9] || "ARS").toUpperCase() === "USD" ? "USD" : "ARS";
                let fxRate = Number(row[10]) || 0;

                if (fxRate <= 0) {
                    if (dateStr) {
                        const hist = await getHistoricalDolar(dateStr, "ccl");
                        if (hist && hist > 0) fxRate = hist;
                    }
                    if (fxRate <= 0 && liveCCL > 0) {
                        fxRate = liveCCL;
                    }
                }

                return {
                    id: transactionId,
                    user_id: user.id,
                    date: isoDate,
                    operation,
                    asset: cleanAsset,
                    asset_type: String(row[3] || "Cedears"),
                    quantity: qty,
                    unit_price: Math.round(numPrice * 10000) / 10000,
                    commission: Math.round(numCommission * 10000) / 10000,
                    cartera: String(row[7] || "Crecimiento"),
                    comment: String(row[8] || ""),
                    currency,
                    fx_rate: fxRate > 0 ? Math.round(fxRate * 10000) / 10000 : null,
                };
            })
        );

        const { error: sbError } = await supabase.from("investments").insert(cleanItems);
        if (sbError) {
            console.error("Error guardando inversión en Supabase:", sbError);
            throw new Error(`No se pudo guardar la inversión: ${sbError.message}`);
        }

        return NextResponse.json({
            success: true,
            count: cleanItems.length,
            ids: cleanItems.map((r) => r.id),
            type: "investments",
        });
    } catch (error: unknown) {
        console.error("Error guardando inversión:", error);
        return NextResponse.json(
            safeErrorResponse(error, error instanceof Error ? error.message : "Error al guardar la inversión."),
            { status: 400 }
        );
    }
}

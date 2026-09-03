import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHistoricalDolarMEPWithFallback, getCurrentDolarMEP } from "@/lib/dolar/api";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

const CRYPTO_TICKERS = new Set(["BTC", "ETH", "USDT", "SOL", "BNB", "ADA", "XRP", "DOT", "DAI", "AVAX", "LINK"]);
const ETF_TICKERS = new Set(["SPY", "QQQ", "DIA", "IWM", "EEM", "VOO", "VTI", "GLD", "SLV", "XLK", "XLE", "XLF", "SPCX"]);
const BONO_TICKERS = new Set(["AL30", "AL30D", "GD30", "GD30D", "AE38", "AL29", "GD35", "TX26", "TX28", "AO29D"]);
const ARG_STOCKS = new Set(["YPFD", "PAMP", "GGAL", "BBAR", "CEPU", "TGSU2", "TGNO4", "TXAR", "ALUA", "CRES", "EDN", "BMA", "TRAN"]);

function inferAssetType(ticker: string, explicitType?: string): string {
    if (explicitType && explicitType.trim()) {
        const lower = explicitType.toLowerCase().trim();
        if (lower.includes("cedear")) return "Cedears";
        if (lower.includes("etf")) return "ETFs";
        if (lower.includes("cript") || lower.includes("crypt")) return "Cripto";
        if (lower.includes("bono") || lower.includes("título") || lower.includes("titulo")) return "Bonos";
        if (lower.includes("acci")) return "Acciones";
    }
    const t = ticker.toUpperCase().trim();
    if (CRYPTO_TICKERS.has(t)) return "Cripto";
    if (ETF_TICKERS.has(t)) return "ETFs";
    if (BONO_TICKERS.has(t)) return "Bonos";
    if (ARG_STOCKS.has(t)) return "Acciones";
    return "Cedears";
}

function normalizeToIsoDate(d: string): string {
    if (!d) return new Date().toISOString().split("T")[0];
    const s = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes("/")) {
        const parts = s.split("/");
        if (parts.length === 3) {
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            let year = parts[2];
            if (year.length === 2) year = `20${year}`;
            return `${year}-${month}-${day}`;
        }
    }
    return s;
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
        const { items, mode = "replace" } = body as { items: any[]; mode?: "replace" | "append" };

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No se enviaron datos para importar." }, { status: 400 });
        }

        let fallbackMep = 1300;
        try {
            fallbackMep = await getCurrentDolarMEP();
        } catch {}

        const preparedRecords = await Promise.all(
            items.map(async (row: any) => {
                const id = row.id && String(row.id).trim() !== "" ? String(row.id).trim() : crypto.randomUUID();
                const ticker = String(row.asset || row.ticker || row.activo || "").toUpperCase().trim();
                const operation = String(row.operation || row.type || row.operacion || "Compra").trim();
                const assetType = inferAssetType(ticker, row.assetType || row.asset_type || row.tipoActivo || row.tipo);
                const quantity = Math.abs(Number(row.quantity ?? row.cantidad ?? 0));
                const unitPrice = Math.abs(Number(row.unitPrice ?? row.unit_price ?? row.precio ?? 0));
                const commission = Math.abs(Number(row.commission ?? row.comision ?? 0));
                const cartera = String(row.cartera || row.portfolio || row.cuenta || "Inversión General").trim();
                const comment = String(row.comment || row.comentario || "").trim();
                const currency = String(row.currency || row.moneda || "ARS").toUpperCase() === "USD" ? "USD" : "ARS";
                const isoDate = normalizeToIsoDate(row.date || row.fecha);

                let fxRate: number | null = Number(row.fxRate ?? row.fx_rate ?? row.mep ?? 0) || null;
                // Independientemente de la moneda, si no tiene tipo de cambio (0 o vacío), buscar la cotización de esa fecha
                if (!fxRate || fxRate <= 0) {
                    try {
                        const hist = await getHistoricalDolarMEPWithFallback(isoDate);
                        fxRate = hist && hist > 0 ? hist : fallbackMep;
                    } catch {
                        fxRate = fallbackMep;
                    }
                }

                return {
                    id,
                    user_id: user.id,
                    date: isoDate,
                    operation: operation === "Venta" ? "Venta" : operation === "Split" ? "Split" : "Compra",
                    asset: ticker,
                    asset_type: assetType,
                    quantity,
                    unit_price: unitPrice,
                    commission,
                    cartera,
                    comment,
                    currency,
                    fx_rate: fxRate,
                };
            })
        );

        // 1. Limpieza si se eligió reemplazar
        if (mode === "replace") {
            // A. Limpiar tabla investments
            const { error: delInvErr } = await supabase
                .from("investments")
                .delete()
                .eq("user_id", user.id);

            if (delInvErr) {
                throw new Error(`Error al limpiar inversiones existentes: ${delInvErr.message}`);
            }

            // B. Limpiar movimientos de Inversión del Balance General (transactions)
            const { error: delTrxErr } = await supabase
                .from("transactions")
                .delete()
                .eq("user_id", user.id)
                .eq("type", "Inversión");

            if (delTrxErr) {
                throw new Error(`Error al limpiar movimientos de inversión en Balance: ${delTrxErr.message}`);
            }
        }

        // 2. Guardar en tabla investments
        const { error: insertErr } = await supabase.from("investments").upsert(preparedRecords, {
            onConflict: "id",
        });

        if (insertErr) {
            throw new Error(`Error al guardar inversiones en Supabase: ${insertErr.message}`);
        }

        // 3. Generar y reflejar transacciones en el Balance General
        const existingRefs = new Set<string>();
        if (mode === "append") {
            const { data: existingTrx } = await supabase
                .from("transactions")
                .select("investment_ref")
                .eq("user_id", user.id)
                .eq("type", "Inversión");

            (existingTrx || []).forEach((t) => {
                if (t.investment_ref) existingRefs.add(String(t.investment_ref).trim());
            });
        }

        const balanceTrxToInsert: any[] = [];

        for (const inv of preparedRecords) {
            if (inv.quantity <= 0 || inv.operation === "Split") continue;
            if (existingRefs.has(inv.id)) continue;

            const rawCost = inv.quantity * inv.unit_price + inv.commission;
            const fx = inv.currency === "USD" && inv.fx_rate ? inv.fx_rate : 1;
            const totalARS =
                inv.currency === "USD"
                    ? Math.round(rawCost * fx * 100) / 100
                    : Math.round(rawCost * 100) / 100;

            if (totalARS <= 0) continue;

            const isVenta = inv.operation === "Venta";
            const commentDetails = [
                isVenta ? "[Venta/Rescate]" : "",
                `${inv.quantity} ${inv.asset}`,
                `(${inv.currency}${inv.currency === "USD" && inv.fx_rate ? ` @ MEP $${inv.fx_rate}` : ""})`,
                inv.comment,
            ]
                .filter(Boolean)
                .join(" ")
                .trim();

            balanceTrxToInsert.push({
                id: crypto.randomUUID(),
                user_id: user.id,
                date: inv.date,
                type: "Inversión",
                category: "Activos Financieros",
                sub_category: inv.asset_type || "Cedears",
                amount: totalARS,
                comment: commentDetails,
                cuota_ref: null,
                investment_ref: inv.id,
            });

            existingRefs.add(inv.id);
        }

        if (balanceTrxToInsert.length > 0) {
            const { error: trxInsertErr } = await supabase.from("transactions").insert(balanceTrxToInsert);
            if (trxInsertErr) {
                console.error("Error reflejando transacciones en el Balance:", trxInsertErr);
                throw new Error(`Inversiones guardadas, pero fallo al reflejar en el Balance: ${trxInsertErr.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            importedCount: preparedRecords.length,
            balanceTransactionsCreated: balanceTrxToInsert.length,
            mode,
            message: `¡Importación completada! Se guardaron ${preparedRecords.length} inversiones y se crearon ${balanceTrxToInsert.length} movimientos en el Balance General.`,
        });
    } catch (error: unknown) {
        console.error("Error importando inversiones:", error);
        return NextResponse.json(
            safeErrorResponse(error, "Error al procesar la importación."),
            { status: 500 }
        );
    }
}

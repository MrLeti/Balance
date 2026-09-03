import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const [
            { data: transactions = [] },
            { data: instalments = [] },
            { data: investments = [] },
            { data: cards = [] },
            { data: card_payments = [] },
            { data: savings_goals = [] },
            { data: categories = [] },
        ] = await Promise.all([
            supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
            supabase.from("instalments").select("*").eq("user_id", user.id).order("date", { ascending: false }),
            supabase.from("investments").select("*").eq("user_id", user.id).order("date", { ascending: false }),
            supabase.from("cards").select("*").eq("user_id", user.id),
            supabase.from("card_payments").select("*").eq("user_id", user.id).order("period", { ascending: false }),
            supabase.from("savings_goals").select("*").eq("user_id", user.id),
            supabase.from("categories").select("*").eq("user_id", user.id),
        ]);

        const wb = XLSX.utils.book_new();

        // 1. Transacciones sheet
        const txRows = (transactions || []).map((t: any) => ({
            ID: t.id,
            Fecha: t.date,
            Tipo: t.type,
            Categoría: t.category,
            Subcategoría: t.sub_category,
            Monto: t.amount,
            Comentario: t.comment || "",
            CuotaRef: t.cuota_ref || "",
            ID_Inversion: t.investment_ref || "",
        }));
        const wsTx = XLSX.utils.json_to_sheet(txRows);
        XLSX.utils.book_append_sheet(wb, wsTx, "Transacciones");

        // 2. Cuotas sheet
        const cuotaRows = (instalments || []).map((c: any) => ({
            ID: c.id,
            Fecha: c.date,
            Concepto: c.concept,
            MontoTotal: c.total_amount,
            CantidadCuotas: c.instalments_count,
            MesInicio: c.start_month,
            Tarjeta: c.tarjeta || "",
        }));
        const wsCuotas = XLSX.utils.json_to_sheet(cuotaRows);
        XLSX.utils.book_append_sheet(wb, wsCuotas, "Cuotas");

        // 3. Inversiones sheet
        const invRows = (investments || []).map((i: any) => ({
            ID: i.id,
            Fecha: i.date,
            Operación: i.operation,
            Activo: i.asset,
            TipoActivo: i.asset_type,
            Cantidad: i.quantity,
            PrecioUnitario: i.unit_price,
            Comisión: i.commission,
            Cartera: i.cartera,
            Comentario: i.comment || "",
            Moneda: i.currency,
            FxRate: i.fx_rate || "",
        }));
        const wsInv = XLSX.utils.json_to_sheet(invRows);
        XLSX.utils.book_append_sheet(wb, wsInv, "Inversiones");

        // 4. Tarjetas sheet
        const cardRows = (cards || []).map((k: any) => ({
            ID: k.id,
            Nombre: k.nombre,
            Color: k.color,
            DiaCierre: k.dia_cierre,
            DiaVencimiento: k.dia_vencimiento,
            ProximoCierre: k.proximo_cierre || "",
            ProximoVencimiento: k.proximo_vencimiento || "",
        }));
        const wsCards = XLSX.utils.json_to_sheet(cardRows);
        XLSX.utils.book_append_sheet(wb, wsCards, "Tarjetas");

        // 5. Pagos Tarjetas
        const payRows = (card_payments || []).map((p: any) => ({
            ID: p.id,
            FechaCierre: p.closing_date,
            Tarjeta: p.tarjeta,
            Periodo: p.period,
            Monto: p.amount,
        }));
        const wsPay = XLSX.utils.json_to_sheet(payRows);
        XLSX.utils.book_append_sheet(wb, wsPay, "PagosTarjetas");

        // 6. Ahorros sheet
        const savRows = (savings_goals || []).map((s: any) => ({
            ID: s.id,
            Nombre: s.name,
            MontoObjetivo: s.target_amount,
            Moneda: s.currency,
            FechaLimite: s.deadline || "",
            Icono: s.icon || "",
            Color: s.color || "",
            EsEmergencia: s.is_emergency ? "Sí" : "No",
        }));
        const wsSav = XLSX.utils.json_to_sheet(savRows);
        XLSX.utils.book_append_sheet(wb, wsSav, "Ahorros");

        // 7. Categorias sheet
        const catRows = (categories || []).map((c: any) => ({
            ID: c.id,
            Tipo: c.type,
            Nombre: c.name,
            Subcategorias: Array.isArray(c.subcategories) ? c.subcategories.join(", ") : JSON.stringify(c.subcategories),
            Color: c.color || "",
        }));
        const wsCat = XLSX.utils.json_to_sheet(catRows);
        XLSX.utils.book_append_sheet(wb, wsCat, "Categorias");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        const dateStr = new Date().toISOString().split("T")[0];

        return new NextResponse(buf, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="vesta_finanzas_${dateStr}.xlsx"`,
            },
        });
    } catch (error: unknown) {
        console.error("Error generating Excel backup:", error);
        return NextResponse.json(
            safeErrorResponse(error, "Error al generar el archivo Excel."),
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CARD_COLORS } from "@/lib/utils/cuotas";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const { data: sbData, error } = await supabase
            .from("cards")
            .select("id, nombre, color, dia_cierre, dia_vencimiento, proximo_cierre, proximo_vencimiento")
            .eq("user_id", user.id)
            .order("nombre", { ascending: true });

        if (error) {
            console.error("Error consultando tarjetas:", error);
            throw error;
        }

        const data = (sbData || []).map((c, idx) => {
            let formattedCierre = c.proximo_cierre;
            if (c.proximo_cierre && c.proximo_cierre.includes("-")) {
                const [y, m, d] = c.proximo_cierre.split("-");
                formattedCierre = `${d}/${m}/${y}`;
            }
            let formattedVenc = c.proximo_vencimiento;
            if (c.proximo_vencimiento && c.proximo_vencimiento.includes("-")) {
                const [y, m, d] = c.proximo_vencimiento.split("-");
                formattedVenc = `${d}/${m}/${y}`;
            }
            return {
                id: c.id,
                nombre: c.nombre,
                color: c.color || DEFAULT_CARD_COLORS[idx % DEFAULT_CARD_COLORS.length],
                diaCierre: c.dia_cierre || 20,
                diaVencimiento: c.dia_vencimiento || 5,
                proximoCierre: formattedCierre || null,
                proximoVencimiento: formattedVenc || null,
            };
        });

        return NextResponse.json({ data, source: "supabase" });
    } catch (error: unknown) {
        console.error("Error consultando tarjetas:", error);
        return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = await req.json();
        const { nombre, color, diaCierre, diaVencimiento, proximoCierre, proximoVencimiento } = body;

        if (!nombre || !nombre.trim()) {
            return NextResponse.json({ error: "El nombre de la tarjeta es requerido." }, { status: 400 });
        }

        const id = crypto.randomUUID();

        const toISODate = (d?: string) => {
            if (!d) return null;
            if (d.includes("/")) {
                const [day, month, year] = d.split("/");
                return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            }
            return d;
        };

        const cardColor = color || DEFAULT_CARD_COLORS[0];
        const closeDay = parseInt(diaCierre, 10) || 20;
        const dueDay = parseInt(diaVencimiento, 10) || 5;

        const { error: sbError } = await supabase.from("cards").insert({
            id,
            user_id: user.id,
            nombre: nombre.trim(),
            color: cardColor,
            dia_cierre: closeDay,
            dia_vencimiento: dueDay,
            proximo_cierre: toISODate(proximoCierre),
            proximo_vencimiento: toISODate(proximoVencimiento),
        });

        if (sbError) {
            console.error("Error insertando tarjeta en Supabase:", sbError);
            throw new Error(`Error en base de datos: ${sbError.message}`);
        }

        return NextResponse.json({
            success: true,
            id,
            data: {
                id,
                nombre: nombre.trim(),
                color: cardColor,
                diaCierre: closeDay,
                diaVencimiento: dueDay,
                proximoCierre: proximoCierre || null,
                proximoVencimiento: proximoVencimiento || null,
            },
        });
    } catch (error: unknown) {
        console.error("Error guardando tarjeta:", error);
        return NextResponse.json(safeErrorResponse(error, "Error de base de datos"), { status: 500 });
    }
}

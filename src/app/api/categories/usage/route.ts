import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const subCategory = searchParams.get("subCategory");

        if (!category) {
            return NextResponse.json({ error: "El parámetro category es requerido." }, { status: 400 });
        }

        let query = supabase
            .from("transactions")
            .select("amount")
            .eq("category", category)
            .eq("user_id", user.id);

        if (subCategory) {
            query = query.eq("sub_category", subCategory);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error consultando uso de categoría:", error);
            return NextResponse.json({ count: 0, totalAmount: 0 });
        }

        const count = data?.length || 0;
        const totalAmount = data?.reduce((sum, item) => sum + Math.abs(Number(item.amount) || 0), 0) || 0;

        return NextResponse.json({ count, totalAmount });
    } catch (error: unknown) {
        console.error("Error al obtener uso de categoría:", error);
        return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
    }
}

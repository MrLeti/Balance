import { NextRequest, NextResponse } from "next/server";
import { processFinanceTextOrImage } from "@/lib/gemini/processor";
import { createClient } from "@/lib/supabase/server";
import { CategoryItem } from "@/lib/constants";
import { safeErrorResponse } from "@/lib/utils/api-error";

// VULN-05: Allowlist de tipos de archivo permitidos
const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
]);

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const formData = await req.formData();
        const text = formData.get("text") as string;
        const file = formData.get("file") as File | null;

        if (!text && !file) {
            return NextResponse.json(
                { error: "Debe proveer texto o una imagen." },
                { status: 400 }
            );
        }

        let base64Image: string | undefined = undefined;
        let mimeType: string | undefined = undefined;

        if (file) {
            // Protección OOM: Limitar tamaño de imagen a 5MB antes de inflar a Base64
            if (file.size > 5 * 1024 * 1024) {
                return NextResponse.json(
                    { error: "La imagen es demasiado pesada. El límite es 5 MB." },
                    { status: 413 }
                );
            }
            // VULN-05: Validar tipo de archivo contra allowlist
            if (!ALLOWED_MIME_TYPES.has(file.type)) {
                return NextResponse.json(
                    { error: "Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WebP, GIF) y PDF." },
                    { status: 415 }
                );
            }
            const buffer = await file.arrayBuffer();
            base64Image = Buffer.from(buffer).toString("base64");
            mimeType = file.type;
        }

        // Fetch user categories for AI instruction
        let userCategories: CategoryItem[] | undefined = undefined;
        try {
            const { data: cats } = await supabase
                .from("categories")
                .select("id, type, name, subcategories, color")
                .eq("user_id", user.id);

            if (cats && cats.length > 0) {
                userCategories = cats.map((c) => ({
                    id: c.id,
                    type: c.type,
                    name: c.name,
                    subcategories: Array.isArray(c.subcategories)
                        ? c.subcategories
                        : typeof c.subcategories === "string"
                        ? JSON.parse(c.subcategories)
                        : [],
                    color: c.color || "#3b82f6",
                }));
            }
        } catch (catErr) {
            console.warn("Could not fetch categories for AI prompt, using fallback:", catErr);
        }

        const items = await processFinanceTextOrImage(text || "", base64Image, mimeType, userCategories);

        return NextResponse.json({ items });
    } catch (error: unknown) {
        console.error("Error en el endpoint de proceso:", error);
        return NextResponse.json(
            safeErrorResponse(error, "Error procesando la solicitud."),
            { status: 500 }
        );
    }
}

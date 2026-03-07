import { NextRequest, NextResponse } from "next/server";
import { processFinanceTextOrImage } from "@/lib/gemini/processor";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
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
            // (1 MB en RAW se convierte en ~1.37 MB en Base64)
            if (file.size > 5 * 1024 * 1024) {
                return NextResponse.json(
                    { error: "La imagen es demasiado pesada. El límite es 5 MB." },
                    { status: 413 } // 413 Payload Too Large
                );
            }
            const buffer = await file.arrayBuffer();
            base64Image = Buffer.from(buffer).toString("base64");
            mimeType = file.type;
        }

        const items = await processFinanceTextOrImage(text || "", base64Image, mimeType);

        return NextResponse.json({ items });
    } catch (error: unknown) {
        console.error("Error en el endpoint de proceso:", error);
        return NextResponse.json(
            { error: "Error procesando la solicitud." },
            { status: 500 }
        );
    }
}

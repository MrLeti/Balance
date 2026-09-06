import { NextRequest, NextResponse } from "next/server";

// Server-side fallback memory cache for Web Share Target (expires in 60s)
interface CachedShareFile {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    timestamp: number;
}

const sharedFilesStore = new Map<string, CachedShareFile>();

// Clean up expired files periodically
const cleanupOldFiles = () => {
    const now = Date.now();
    for (const [id, item] of sharedFilesStore.entries()) {
        if (now - item.timestamp > 60000) {
            sharedFilesStore.delete(id);
        }
    }
};

export async function POST(req: NextRequest) {
    try {
        cleanupOldFiles();
        const formData = await req.formData();
        let file = (formData.get("file") || formData.get("sharedImage")) as File | null;

        if (!file || typeof file === "string") {
            for (const value of formData.values()) {
                if (value && typeof value === "object" && "arrayBuffer" in value && "size" in value) {
                    file = value as File;
                    break;
                }
            }
        }

        if (file && typeof file.arrayBuffer === "function") {
            const buffer = Buffer.from(await file.arrayBuffer());
            const shareId = crypto.randomUUID();

            sharedFilesStore.set(shareId, {
                buffer,
                fileName: file.name || "comprobante.jpg",
                mimeType: file.type || "image/jpeg",
                timestamp: Date.now(),
            });

            // 303 See Other redirects the browser to a GET request on the main page
            const redirectUrl = new URL(`/?shared_id=${shareId}`, req.url);
            return NextResponse.redirect(redirectUrl, 303);
        }

        return NextResponse.redirect(new URL("/", req.url), 303);
    } catch (err) {
        console.error("[Share Target Route] Error handling POST:", err);
        return NextResponse.redirect(new URL("/?share_error=true", req.url), 303);
    }
}

export async function GET(req: NextRequest) {
    cleanupOldFiles();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || !sharedFilesStore.has(id)) {
        return NextResponse.json({ error: "Archivo compartido no encontrado o expirado" }, { status: 404 });
    }

    const item = sharedFilesStore.get(id)!;
    sharedFilesStore.delete(id); // Consume once

    return new NextResponse(new Uint8Array(item.buffer), {
        headers: {
            "Content-Type": item.mimeType,
            "X-File-Name": encodeURIComponent(item.fileName),
        },
    });
}

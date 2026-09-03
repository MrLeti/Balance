import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";
import { Readable } from "stream";
import { safeErrorResponse } from "@/lib/utils/api-error";

export const dynamic = "force-dynamic";

// Helper to get or create "Vesta Backups" folder in user's Drive
async function getOrCreateVestaFolder(drive: any) {
    const query = "mimeType = 'application/vnd.google-apps.folder' and name = 'Vesta Backups' and trashed = false";
    const searchRes = await drive.files.list({
        q: query,
        fields: "files(id, name)",
        spaces: "drive",
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
        return searchRes.data.files[0].id;
    }

    const fileMetadata = {
        name: "Vesta Backups",
        mimeType: "application/vnd.google-apps.folder",
    };
    const folderRes = await drive.files.create({
        requestBody: fileMetadata,
        fields: "id",
    });

    return folderRes.data.id;
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
        const { action, accessToken, fileId } = body;

        if (!accessToken) {
            return NextResponse.json(
                { error: "Se requiere un token de acceso de Google Drive (Google OAuth)." },
                { status: 400 }
            );
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });

        const drive = google.drive({ version: "v3", auth: oauth2Client });
        const sheets = google.sheets({ version: "v4", auth: oauth2Client });

        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = `${now.getHours().toString().padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}`;

        // ACTION: Subir archivo .json de backup a Drive
        if (action === "upload-json") {
            const folderId = await getOrCreateVestaFolder(drive);

            // Fetch all tables
            const [
                { data: transactions = [] },
                { data: instalments = [] },
                { data: investments = [] },
                { data: cards = [] },
                { data: card_payments = [] },
                { data: savings_goals = [] },
                { data: categories = [] },
            ] = await Promise.all([
                supabase.from("transactions").select("*").eq("user_id", user.id),
                supabase.from("instalments").select("*").eq("user_id", user.id),
                supabase.from("investments").select("*").eq("user_id", user.id),
                supabase.from("cards").select("*").eq("user_id", user.id),
                supabase.from("card_payments").select("*").eq("user_id", user.id),
                supabase.from("savings_goals").select("*").eq("user_id", user.id),
                supabase.from("categories").select("*").eq("user_id", user.id),
            ]);

            const payload = {
                metadata: {
                    app: "Vesta Finance",
                    version: "1.0",
                    exportedAt: now.toISOString(),
                    userEmail: user.email || undefined,
                },
                data: {
                    transactions: transactions || [],
                    instalments: instalments || [],
                    investments: investments || [],
                    cards: cards || [],
                    card_payments: card_payments || [],
                    savings_goals: savings_goals || [],
                    categories: categories || [],
                },
            };

            const jsonString = JSON.stringify(payload, null, 2);
            const fileName = `vesta_backup_${dateStr}_${timeStr}.json`;

            const fileMetadata = {
                name: fileName,
                parents: folderId ? [folderId] : [],
            };

            const media = {
                mimeType: "application/json",
                body: Readable.from([jsonString]),
            };

            const createdFile = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: "id, name, webViewLink",
            });

            return NextResponse.json({
                success: true,
                message: `Copia guardada en Google Drive: ${fileName}`,
                fileId: createdFile.data.id,
                fileName: createdFile.data.name,
                fileUrl: createdFile.data.webViewLink,
            });
        }

        // ACTION: Exportar a nueva hoja de Google Sheets
        if (action === "export-sheets") {
            const folderId = await getOrCreateVestaFolder(drive);

            // Fetch user data
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

            const title = `Vesta Finanzas - ${dateStr} ${timeStr}`;

            // Create new Google Spreadsheet
            const createRes = await sheets.spreadsheets.create({
                requestBody: {
                    properties: { title },
                    sheets: [
                        { properties: { title: "Transacciones" } },
                        { properties: { title: "Cuotas" } },
                        { properties: { title: "Inversiones" } },
                        { properties: { title: "Tarjetas" } },
                        { properties: { title: "PagosTarjetas" } },
                        { properties: { title: "Ahorros" } },
                        { properties: { title: "Categorias" } },
                    ],
                },
            });

            const spreadsheetId = createRes.data.spreadsheetId!;

            // Move spreadsheet to "Vesta Backups" folder
            if (folderId) {
                await drive.files.update({
                    fileId: spreadsheetId,
                    addParents: folderId,
                    fields: "id, parents",
                });
            }

            // Populate each sheet with exact columns
            const txData = [
                ["ID", "Fecha", "Tipo", "Categoría", "Subcategoría", "Monto", "Comentario", "CuotaRef", "ID_Inversion"],
                ...(transactions || []).map((t: any) => [
                    t.id, t.date, t.type, t.category, t.sub_category, t.amount, t.comment || "", t.cuota_ref || "", t.investment_ref || ""
                ]),
            ];

            const cuotasData = [
                ["ID", "Fecha", "Concepto", "MontoTotal", "CantidadCuotas", "MesInicio", "Tarjeta"],
                ...(instalments || []).map((c: any) => [
                    c.id, c.date, c.concept, c.total_amount, c.instalments_count, c.start_month, c.tarjeta || ""
                ]),
            ];

            const invData = [
                ["ID", "Fecha", "Operación", "Activo", "TipoActivo", "Cantidad", "PrecioUnitario", "Comisión", "Cartera", "Comentario", "Moneda", "FxRate"],
                ...(investments || []).map((i: any) => [
                    i.id, i.date, i.operation, i.asset, i.asset_type, i.quantity, i.unit_price, i.commission, i.cartera, i.comment || "", i.currency, i.fx_rate || ""
                ]),
            ];

            const cardsData = [
                ["ID", "Nombre", "Color", "DiaCierre", "DiaVencimiento", "ProximoCierre", "ProximoVencimiento"],
                ...(cards || []).map((k: any) => [
                    k.id, k.nombre, k.color, k.dia_cierre, k.dia_vencimiento, k.proximo_cierre || "", k.proximo_vencimiento || ""
                ]),
            ];

            const paymentsData = [
                ["ID", "FechaCierre", "Tarjeta", "Periodo", "Monto"],
                ...(card_payments || []).map((p: any) => [
                    p.id, p.closing_date, p.tarjeta, p.period, p.amount
                ]),
            ];

            const savingsData = [
                ["ID", "Nombre", "MontoObjetivo", "Moneda", "FechaLimite", "Icono", "Color", "EsEmergencia"],
                ...(savings_goals || []).map((s: any) => [
                    s.id, s.name, s.target_amount, s.currency, s.deadline || "", s.icon || "", s.color || "", s.is_emergency ? "Sí" : "No"
                ]),
            ];

            const categoriesData = [
                ["ID", "Tipo", "Nombre", "Subcategorias", "Color"],
                ...(categories || []).map((c: any) => [
                    c.id, c.type, c.name, Array.isArray(c.subcategories) ? c.subcategories.join(", ") : JSON.stringify(c.subcategories), c.color || ""
                ]),
            ];

            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: "USER_ENTERED",
                    data: [
                        { range: "Transacciones!A1", values: txData },
                        { range: "Cuotas!A1", values: cuotasData },
                        { range: "Inversiones!A1", values: invData },
                        { range: "Tarjetas!A1", values: cardsData },
                        { range: "PagosTarjetas!A1", values: paymentsData },
                        { range: "Ahorros!A1", values: savingsData },
                        { range: "Categorias!A1", values: categoriesData },
                    ],
                },
            });

            return NextResponse.json({
                success: true,
                spreadsheetId,
                spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
                message: "Planilla creada en Google Sheets con éxito.",
            });
        }

        // ACTION: Listar backups en Google Drive
        if (action === "list-backups") {
            const folderId = await getOrCreateVestaFolder(drive);
            const query = `'${folderId}' in parents and mimeType = 'application/json' and trashed = false`;
            const listRes = await drive.files.list({
                q: query,
                fields: "files(id, name, createdTime, size)",
                orderBy: "createdTime desc",
                pageSize: 20,
            });

            return NextResponse.json({
                files: listRes.data.files || [],
            });
        }

        // ACTION: Descargar contenido de un backup específico desde Drive
        if (action === "get-backup-content") {
            if (!fileId) {
                return NextResponse.json({ error: "Falta fileId" }, { status: 400 });
            }

            const downloadRes = await drive.files.get(
                { fileId, alt: "media" },
                { responseType: "text" }
            );

            const content = typeof downloadRes.data === "string" ? JSON.parse(downloadRes.data) : downloadRes.data;
            return NextResponse.json(content);
        }

        return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    } catch (error: unknown) {
        console.error("Error in drive route:", error);
        return NextResponse.json(
            safeErrorResponse(error, "Error al comunicarse con Google Drive."),
            { status: 500 }
        );
    }
}

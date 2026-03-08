import { google } from "googleapis";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function getGoogleSheetsClient() {
    const session = (await getServerSession(authOptions)) as { accessToken?: string };

    if (!session || !session.accessToken) {
        throw new Error("No hay sesión activa o falta el AccessToken.");
    }

    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ access_token: session.accessToken as string });

    const sheets = google.sheets({ version: "v4", auth });
    return sheets;
}

export async function appendMultipleRowsToSheet(valuesArray: (string | number)[][]) {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            throw new Error("El ID del Google Sheet no está configurado (.env).");
        }

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "A:G", // Ahora abarca la columna G
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: valuesArray,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error al escribir en Google Sheets:", error);
        throw error;
    }
}

export async function getRecentRowsConfig() {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            throw new Error("El ID del Google Sheet no está configurado.");
        }

        // Leemos las primeras 500 filas para que nos sirva para los últimos movimientos y gráficos
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: "A:G", // Incluimos hasta la G
        });

        // Filtramos la primera fila (los títulos)
        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        const dataRows = rows.slice(1);

        // Asignar IDs al vuelo a filas viejas que no lo tengan en la DB
        // Para poder borrarlas en memoria, armamos un ID virtual predecible
        return dataRows.map(row => {
            if (!row[0] || String(row[0]).trim() === '') {
                const rowPayload = row.slice(1).join("||");
                return [`virt_${rowPayload}`, ...row.slice(1)];
            }
            return row;
        });
    } catch (error) {
        console.error("Error al leer Google Sheets:", error);
        throw error;
    }
}

export async function deleteRowFromSheetById(transactionId: string) {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            throw new Error("El ID del Google Sheet no está configurado.");
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: "A:G",
        });

        const rows = response.data.values;
        if (!rows) return false;

        let rowIndexToDelete = -1;

        // Si la row no tiene ID real en la BD, la única forma de borrarla 
        // es parseando temporalmente la tx clickeada sin su UUID virtual autogenerado
        // y comparando campo por campo.
        const txSinIdVirtual = transactionId.replace(/^virt_/, ""); // Identificador propio para txs viejas

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            // Caso 1: Tiene ID generado normalmente en la base de datos
            if (row.length >= 1 && row[0] === transactionId) {
                rowIndexToDelete = i;
                break;
            }

            // Caso 2: Es una fila vieja histórica sin ID (Columna A vacía)
            // Chequeamos que la metadata coincida armando un "hash" rápido o serializandolo
            if (!row[0] || String(row[0]).trim() === '') {
                const rowWithoutId = row.slice(1).join("||");
                if (rowWithoutId === txSinIdVirtual) {
                    rowIndexToDelete = i;
                    break;
                }
            }
        }

        if (rowIndexToDelete === -1) {
            throw new Error("Fila no encontrada");
        }

        const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const actualSheetId = sheetMeta.data.sheets?.[0]?.properties?.sheetId || 0;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: actualSheetId,
                                dimension: "ROWS",
                                startIndex: rowIndexToDelete,
                                endIndex: rowIndexToDelete + 1,
                            }
                        }
                    }
                ]
            }
        });

        return true;
    } catch (error) {
        console.error("Error al borrar en Google Sheets:", error);
        throw error;
    }
}

import { getGoogleSheetsClient } from "./sheets";

export async function appendTarjeta(valuesArray: (string | number)[][]) {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) throw new Error("El ID del Google Sheet no está configurado (.env).");

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "Tarjetas!A:B",
            valueInputOption: "USER_ENTERED",
            requestBody: { values: valuesArray },
        });
        return response.data;
    } catch (error) {
        console.error("Error al escribir en Google Sheets (Tarjetas):", error);
        throw error;
    }
}

export async function getTarjetas() {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) throw new Error("El ID del Google Sheet no está configurado.");

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: "Tarjetas!A:B",
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        return rows.slice(1);
    } catch (error) {
        console.error("Error al leer Google Sheets (Tarjetas):", error);
        throw error;
    }
}

export async function deleteTarjetaById(tarjetaId: string) {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) throw new Error("El ID del Google Sheet no está configurado.");

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: "Tarjetas!A:B",
        });

        const rows = response.data.values;
        if (!rows) return false;

        let rowIndexToDelete = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].length >= 1 && rows[i][0] === tarjetaId) {
                rowIndexToDelete = i;
                break;
            }
        }

        if (rowIndexToDelete === -1) throw new Error("Tarjeta no encontrada");

        const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetMeta.data.sheets?.find(s => s.properties?.title === "Tarjetas");
        const actualSheetId = sheet?.properties?.sheetId;

        if (actualSheetId === undefined) throw new Error("La pestaña 'Tarjetas' no existe.");

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: actualSheetId,
                            dimension: "ROWS",
                            startIndex: rowIndexToDelete,
                            endIndex: rowIndexToDelete + 1,
                        }
                    }
                }]
            }
        });
        return true;
    } catch (error) {
        console.error("Error al borrar en Google Sheets (Tarjetas):", error);
        throw error;
    }
}

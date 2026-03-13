import { getGoogleSheetsClient } from "./sheets";

export async function appendInstalment(valuesArray: (string | number)[][]) {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            throw new Error("El ID del Google Sheet no está configurado (.env).");
        }

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "Cuotas!A:G",
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: valuesArray,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error al escribir en Google Sheets (Cuotas):", error);
        throw error;
    }
}

export async function getInstalments() {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            throw new Error("El ID del Google Sheet no está configurado.");
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: "Cuotas!A:G",
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        return rows.slice(1);
    } catch (error) {
        console.error("Error al leer Google Sheets (Cuotas):", error);
        throw error;
    }
}

export async function deleteInstalmentById(instalmentId: string) {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            throw new Error("El ID del Google Sheet no está configurado.");
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: "Cuotas!A:G",
        });

        const rows = response.data.values;
        if (!rows) return false;

        let rowIndexToDelete = -1;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 1 && row[0] === instalmentId) {
                rowIndexToDelete = i;
                break;
            }
        }

        if (rowIndexToDelete === -1) {
            throw new Error("Cuota no encontrada");
        }

        const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });

        // Find the sheet ID for "Cuotas"
        const cuotasSheet = sheetMeta.data.sheets?.find(s => s.properties?.title === "Cuotas");
        const actualSheetId = cuotasSheet?.properties?.sheetId;

        if (actualSheetId === undefined) {
            throw new Error("La pestaña 'Cuotas' no existe en el documento.");
        }

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
        console.error("Error al borrar en Google Sheets (Cuotas):", error);
        throw error;
    }
}

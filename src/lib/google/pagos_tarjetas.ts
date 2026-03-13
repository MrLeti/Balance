import { getGoogleSheetsClient } from "./sheets";

export async function appendPagoTarjeta(valuesArray: (string | number)[][]) {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) throw new Error("El ID del Google Sheet no está configurado (.env).");

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "Pagos_Tarjetas!A:E",
            valueInputOption: "USER_ENTERED",
            requestBody: { values: valuesArray },
        });
        return response.data;
    } catch (error) {
        console.error("Error al escribir en Google Sheets (Pagos_Tarjetas):", error);
        throw error;
    }
}

export async function getPagosTarjetas() {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) throw new Error("El ID del Google Sheet no está configurado.");

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: "Pagos_Tarjetas!A:E",
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        return rows.slice(1);
    } catch (error) {
        console.error("Error al leer Google Sheets (Pagos_Tarjetas):", error);
        throw error;
    }
}

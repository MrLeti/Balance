// ─────────────────────────────────────────────────────────
// Google Sheets CRUD for the "Inversiones" tab
// Pattern follows instalments.ts
// ─────────────────────────────────────────────────────────

import { getGoogleSheetsClient } from "./sheets";

const SHEET_RANGE = "Inversiones!A:J";
const SHEET_TAB_NAME = "Inversiones";

/**
 * Appends one or more investment transaction rows to the "Inversiones" sheet.
 */
export async function appendInvestmentTransaction(valuesArray: (string | number)[][]) {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            throw new Error("El ID del Google Sheet no está configurado (.env).");
        }

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: SHEET_RANGE,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: valuesArray,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error al escribir en Google Sheets (Inversiones):", error);
        throw error;
    }
}

/**
 * Reads all investment transactions from the "Inversiones" sheet.
 * Skips the header row.
 */
export async function getInvestmentTransactions(): Promise<string[][]> {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            throw new Error("El ID del Google Sheet no está configurado.");
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: SHEET_RANGE,
            // UNFORMATTED_VALUE forces raw numbers ('160000') instead of locale-formatted
            // strings ('160.000' with Argentine thousands separator) which parseFloat misreads.
            valueRenderOption: "UNFORMATTED_VALUE",
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        return rows.slice(1);
    } catch (error) {
        console.error("Error al leer Google Sheets (Inversiones):", error);
        throw error;
    }
}

/**
 * Deletes an investment transaction by its ID (column A).
 */
export async function deleteInvestmentTransactionById(transactionId: string): Promise<boolean> {
    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            throw new Error("El ID del Google Sheet no está configurado.");
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: SHEET_RANGE,
            valueRenderOption: "UNFORMATTED_VALUE",
        });

        const rows = response.data.values;
        if (!rows) return false;

        let rowIndexToDelete = -1;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 1 && row[0] === transactionId) {
                rowIndexToDelete = i;
                break;
            }
        }

        if (rowIndexToDelete === -1) {
            throw new Error("Transacción de inversión no encontrada.");
        }

        const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });

        // Find the actual sheet ID for the "Inversiones" tab
        const invSheet = sheetMeta.data.sheets?.find(
            s => s.properties?.title === SHEET_TAB_NAME
        );
        const actualSheetId = invSheet?.properties?.sheetId;

        if (actualSheetId === undefined) {
            throw new Error(`La pestaña '${SHEET_TAB_NAME}' no existe en el documento.`);
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
                            },
                        },
                    },
                ],
            },
        });

        return true;
    } catch (error) {
        console.error("Error al borrar en Google Sheets (Inversiones):", error);
        throw error;
    }
}

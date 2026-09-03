export interface VestaBackupMetadata {
    app: "Vesta Finance";
    version: "1.0";
    exportedAt: string;
    userEmail?: string;
}

export interface VestaBackupData {
    transactions: any[];
    instalments: any[];
    investments: any[];
    cards: any[];
    card_payments: any[];
    savings_goals: any[];
    categories: any[];
}

export interface VestaBackupPayload {
    metadata: VestaBackupMetadata;
    data: VestaBackupData;
}

export interface BackupValidationResult {
    valid: boolean;
    error?: string;
    summary?: {
        transactionsCount: number;
        instalmentsCount: number;
        investmentsCount: number;
        cardsCount: number;
        cardPaymentsCount: number;
        savingsGoalsCount: number;
        categoriesCount: number;
        exportedAt: string;
        userEmail?: string;
    };
}

export function validateBackupPayload(payload: any): BackupValidationResult {
    if (!payload || typeof payload !== "object") {
        return { valid: false, error: "El archivo no contiene un formato JSON válido." };
    }

    if (!payload.metadata || payload.metadata.app !== "Vesta Finance") {
        return { valid: false, error: "El archivo no es una copia de seguridad oficial de Vesta Finance." };
    }

    if (!payload.data || typeof payload.data !== "object") {
        return { valid: false, error: "El archivo no contiene el bloque de datos esperado." };
    }

    const {
        transactions = [],
        instalments = [],
        investments = [],
        cards = [],
        card_payments = [],
        savings_goals = [],
        categories = [],
    } = payload.data;

    if (!Array.isArray(transactions) || !Array.isArray(instalments) || !Array.isArray(investments)) {
        return { valid: false, error: "La estructura interna de datos está dañada o incompleta." };
    }

    return {
        valid: true,
        summary: {
            transactionsCount: transactions.length,
            instalmentsCount: instalments.length,
            investmentsCount: investments.length,
            cardsCount: cards.length,
            cardPaymentsCount: card_payments.length,
            savingsGoalsCount: savings_goals.length,
            categoriesCount: categories.length,
            exportedAt: payload.metadata.exportedAt || new Date().toISOString(),
            userEmail: payload.metadata.userEmail,
        },
    };
}

import { describe, it, expect } from "vitest";
import { validateBackupPayload } from "./format";

describe("validateBackupPayload", () => {
    it("debe rechazar payloads nulos o vacíos", () => {
        expect(validateBackupPayload(null).valid).toBe(false);
        expect(validateBackupPayload(undefined).valid).toBe(false);
        expect(validateBackupPayload("string").valid).toBe(false);
    });

    it("debe rechazar archivos que no provienen de Vesta Finance", () => {
        const fake = {
            metadata: { app: "Other App", version: "1.0", exportedAt: new Date().toISOString() },
            data: { transactions: [] },
        };
        const res = validateBackupPayload(fake);
        expect(res.valid).toBe(false);
        expect(res.error).toContain("no es una copia de seguridad oficial de Vesta");
    });

    it("debe validar y resumir correctamente un respaldo válido", () => {
        const validPayload = {
            metadata: {
                app: "Vesta Finance" as const,
                version: "1.0" as const,
                exportedAt: "2026-09-02T18:00:00.000Z",
                userEmail: "alexi@test.com",
            },
            data: {
                transactions: [{ id: "tx1", amount: 1000 }, { id: "tx2", amount: 2000 }],
                instalments: [{ id: "inst1", concept: "Notebook" }],
                investments: [{ id: "inv1", asset: "AAPL" }],
                cards: [{ id: "card1", nombre: "Visa" }],
                card_payments: [],
                savings_goals: [{ id: "goal1", name: "Emergencia" }],
                categories: [{ id: "cat1", name: "Salario" }],
            },
        };

        const res = validateBackupPayload(validPayload);
        expect(res.valid).toBe(true);
        expect(res.summary?.transactionsCount).toBe(2);
        expect(res.summary?.instalmentsCount).toBe(1);
        expect(res.summary?.investmentsCount).toBe(1);
        expect(res.summary?.cardsCount).toBe(1);
        expect(res.summary?.savingsGoalsCount).toBe(1);
        expect(res.summary?.categoriesCount).toBe(1);
        expect(res.summary?.userEmail).toBe("alexi@test.com");
    });
});

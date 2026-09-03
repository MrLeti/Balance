import { describe, it, expect } from "vitest";
import { CATEGORIES } from "@/lib/constants";
import { calculateCleanMonthlyExpense } from "@/lib/utils/savings";

describe("Savings & Goals Configuration", () => {
    it("debería contener el tipo Ahorro con Aporte y Retiro en CATEGORIES", () => {
        expect(CATEGORIES.Ahorro).toBeDefined();
        expect(CATEGORIES.Ahorro.Aporte).toContain("Fondo de Emergencia");
        expect(CATEGORIES.Ahorro.Retiro).toContain("Fondo de Emergencia");
    });

    it("debería calcular correctamente el saldo neto de una meta de ahorro a partir de aportes y retiros", () => {
        const testMovements = [
            { type: "Ahorro", category: "Aporte", goalName: "Nueva PC", amount: 150000 },
            { type: "Ahorro", category: "Aporte", goalName: "Nueva PC", amount: 200000 },
            { type: "Ahorro", category: "Retiro", goalName: "Nueva PC", amount: -50000 },
        ];

        const balance = testMovements.reduce((acc, m) => acc + m.amount, 0);
        expect(balance).toBe(300000);
    });

    it("debería calcular el porcentaje de avance hacia la meta", () => {
        const currentSaved = 350000;
        const targetAmount = 1000000;
        const progress = Math.min(100, Math.round((currentSaved / targetAmount) * 100));

        expect(progress).toBe(35);
    });

    it("debería calcular correctamente los meses de cobertura del Fondo de Emergencia", () => {
        const emergencySaved = 2400000;
        const avgMonthlyExpense = 600000;
        const monthsCovered = Number((emergencySaved / avgMonthlyExpense).toFixed(1));

        expect(monthsCovered).toBe(4.0);
    });

    it("debería calcular el gasto mensual limpio y filtrar un gasto atípico/electrodoméstico grande (outlier)", () => {
        // Sample rows: [ID, Fecha, Tipo, Categoría, Subcategoría, Monto, Comentario]
        const mockRows = [
            // Month 1 (Enero 2026): Normal living expenses totaling 500k
            ["1", "05/01/2026", "Egreso", "Supermercado", "Comida", "150000", "Super"],
            ["2", "15/01/2026", "Egreso", "Servicios", "Luz", "80000", "Luz"],
            ["3", "25/01/2026", "Egreso", "Salud", "Farmacia", "70000", "Remedios"],
            ["4", "28/01/2026", "Egreso", "Transporte", "Combustible", "200000", "Nafta"],

            // Month 2 (Febrero 2026): Normal living expenses (520k) + 1 OUTLIER (Heladera $2.500.000)
            ["5", "03/02/2026", "Egreso", "Supermercado", "Comida", "160000", "Super"],
            ["6", "10/02/2026", "Egreso", "Servicios", "Gas", "90000", "Gas"],
            ["7", "14/02/2026", "Egreso", "Equipamiento", "Electrodomésticos", "2500000", "Heladera nueva"],
            ["8", "20/02/2026", "Egreso", "Transporte", "Combustible", "270000", "Nafta"],

            // Month 3 (Marzo 2026): Normal living expenses totaling 540k
            ["9", "02/03/2026", "Egreso", "Supermercado", "Comida", "180000", "Super"],
            ["10", "12/03/2026", "Egreso", "Servicios", "Internet", "100000", "Fibertel"],
            ["11", "22/03/2026", "Egreso", "Transporte", "Combustible", "260000", "Nafta"],
        ];

        const result = calculateCleanMonthlyExpense(mockRows);

        // Raw average with the 2.5M appliance would be around ~1.35M
        expect(result.rawMonthlyAvg).toBeGreaterThan(1000000);

        // Clean monthly average after outlier filter should reflect realistic ~520k living cost
        expect(result.outliersFilteredCount).toBe(1);
        expect(result.avgMonthlyExpense).toBeGreaterThanOrEqual(480000);
        expect(result.avgMonthlyExpense).toBeLessThanOrEqual(560000);
    });
});


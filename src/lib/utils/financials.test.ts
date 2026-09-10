import { describe, it, expect } from 'vitest';
import { computeFinancials } from './financials';

describe('computeFinancials utility', () => {
    it('returns zeroes for empty rows', () => {
        const res = computeFinancials([]);
        expect(res).toEqual({
            balance: 0,
            ingresos: 0,
            egresos: 0,
            inversiones: 0,
            ahorros: 0,
        });
    });

    it('correctly aggregates standard Income, Expense, Savings, and Investments', () => {
        const rows: (string | number)[][] = [
            ['tx-1', '01/03/2026', 'Ingreso', 'Salario', 'Blanco', 100000, 'Sueldo'],
            ['tx-2', '02/03/2026', 'Egreso', 'Comunes', 'Supermercado', 30000, 'Coto'],
            ['tx-3', '03/03/2026', 'Ahorro', 'Aporte', 'Fondo de Emergencia', 20000, 'Aporte'],
            ['tx-4', '04/03/2026', 'Inversión', 'Activos', 'CEDEAR', 15000, 'Compra'],
        ];

        const res = computeFinancials(rows);
        expect(res.ingresos).toBe(100000);
        expect(res.egresos).toBe(30000);
        expect(res.ahorros).toBe(20000);
        expect(res.inversiones).toBe(15000);
        // Balance = Ingresos (100000) - Egresos (30000) - Ahorros (20000) - Inversiones (15000) = 35000
        expect(res.balance).toBe(35000);
    });

    it('handles savings withdrawals properly (adds back to balance, subtracts from savings)', () => {
        const rows: (string | number)[][] = [
            ['tx-1', '01/03/2026', 'Ingreso', 'Salario', 'Blanco', 100000, 'Sueldo'],
            ['tx-2', '02/03/2026', 'Ahorro', 'Retiro', 'Fondo de Emergencia', 25000, 'Retiro para arreglos'],
        ];

        const res = computeFinancials(rows);
        expect(res.ingresos).toBe(100000);
        expect(res.ahorros).toBe(-25000);
        // Balance: 100000 + 25000 = 125000
        expect(res.balance).toBe(125000);
    });

    it('handles investment sales properly (adds to balance, subtracts from investments)', () => {
        const rows: (string | number)[][] = [
            ['tx-1', '01/03/2026', 'Inversión', 'Activos', 'CEDEAR', 50000, 'Venta de SPY'],
        ];

        const res = computeFinancials(rows);
        expect(res.inversiones).toBe(-50000);
        expect(res.balance).toBe(50000);
    });
});

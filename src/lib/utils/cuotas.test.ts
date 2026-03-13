import { describe, it, expect } from 'vitest';
import { calculateProjectedPayments, Instalment } from './cuotas';

describe('calculateProjectedPayments', () => {
    it('debería calcular las proyecciones correctamente para un mes', () => {
        const instalments: Instalment[] = [
            {
                id: '1',
                concept: 'Prueba',
                date: '01/01/2026',
                totalAmount: 1000,
                instalmentsCount: 1,
                startMonth: '01/2026'
            }
        ];

        const result = calculateProjectedPayments(instalments);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            date: '01/01/2026',
            monthKey: '01/2026',
            amount: 1000,
            instalmentNumber: 1,
            originalId: '1'
        });
    });

    it('debería dividir equitativamente en varios meses', () => {
        const instalments: Instalment[] = [
            {
                id: '1',
                concept: 'Prueba 3 cuotas',
                date: '01/01/2026',
                totalAmount: 300,
                instalmentsCount: 3,
                startMonth: '05/2026'
            }
        ];

        const result = calculateProjectedPayments(instalments);

        expect(result).toHaveLength(3);
        expect(result[0].monthKey).toBe('05/2026');
        expect(result[0].amount).toBe(100);

        expect(result[1].monthKey).toBe('06/2026');
        expect(result[1].amount).toBe(100);

        expect(result[2].monthKey).toBe('07/2026');
        expect(result[2].amount).toBe(100);
    });

    it('debería manejar casos de división con decimales correctos', () => {
        const instalments: Instalment[] = [
            {
                id: '1',
                concept: 'Prueba decimales',
                date: '01/01/2026',
                totalAmount: 100,
                instalmentsCount: 3,
                startMonth: '01/2026'
            }
        ];

        const result = calculateProjectedPayments(instalments);

        expect(result).toHaveLength(3);
        // 100 / 3 = 33.333... math round to 33.33
        expect(result[0].amount).toBe(33.33);
        expect(result[1].amount).toBe(33.33);
        // Last one should absorb the rest to equal exactly 100: 100 - (33.33 + 33.33) = 33.34
        expect(result[2].amount).toBe(33.34);
    });

    it('debería manejar correctamente el avance de los años (Diciembre a Enero)', () => {
        const instalments: Instalment[] = [
            {
                id: '1',
                concept: 'Cambio de año',
                date: '01/11/2025',
                totalAmount: 200,
                instalmentsCount: 2,
                startMonth: '12/2025' // starts dec
            }
        ];

        const result = calculateProjectedPayments(instalments);

        expect(result).toHaveLength(2);

        expect(result[0].monthKey).toBe('12/2025');
        expect(result[1].monthKey).toBe('01/2026');
    });

    it('debería ordenar cronológicamente proyecciones de distintas cuotas', () => {
        const instalments: Instalment[] = [
            {
                id: '1',
                concept: 'Cuota A',
                date: '01/01/2026',
                totalAmount: 100,
                instalmentsCount: 1,
                startMonth: '02/2026'
            },
            {
                id: '2',
                concept: 'Cuota B',
                date: '01/01/2026',
                totalAmount: 100,
                instalmentsCount: 1,
                startMonth: '01/2026'
            }
        ];

        const result = calculateProjectedPayments(instalments);

        expect(result).toHaveLength(2);
        expect(result[0].monthKey).toBe('01/2026');
        expect(result[0].originalId).toBe('2');
        expect(result[1].monthKey).toBe('02/2026');
        expect(result[1].originalId).toBe('1');
    });

    it('debería filtrar proyecciones pagadas cuando se proveen pagos de tarjeta', () => {
        const instalments: Instalment[] = [
            {
                id: '1',
                concept: 'Compra con Tarjeta',
                date: '01/01/2026',
                totalAmount: 300,
                instalmentsCount: 3,
                startMonth: '01/2026',
                tarjeta: 'Visa'
            }
        ];

        const pagos = [
            {
                id: 'p1',
                closingDate: '25/01/2026',
                tarjeta: 'Visa',
                period: '02/2026',
                amount: 100
            }
        ];

        const result = calculateProjectedPayments(instalments, pagos);

        expect(result).toHaveLength(2);
        expect(result[0].monthKey).toBe('01/2026');
        expect(result[1].monthKey).toBe('03/2026');
    });
});

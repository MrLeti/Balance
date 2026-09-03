import { describe, it, expect } from 'vitest';
import { calculateProjectedPayments, parseStartMonth, getEstimatedCardDates, Instalment } from './cuotas';

describe('parseStartMonth', () => {
    it('debería parsear correctamente el formato MM/YYYY', () => {
        const res = parseStartMonth('04/2026');
        expect(res).toEqual({ month: 4, year: 2026, monthKey: '04/2026' });
    });

    it('debería parsear correctamente el formato M/YYYY (un solo dígito)', () => {
        const res = parseStartMonth('5/2026');
        expect(res).toEqual({ month: 5, year: 2026, monthKey: '05/2026' });
    });

    it('debería parsear números de serie de Excel/Sheets (unformatted values)', () => {
        // 46113 es approx 1 de abril de 2026
        const res = parseStartMonth(46113);
        expect(res.year).toBe(2026);
        expect(res.month).toBe(4);
        expect(res.monthKey).toBe('04/2026');
    });

    it('debería parsear formato ISO YYYY-MM o YYYY-MM-DD', () => {
        const res = parseStartMonth('2026-08-15');
        expect(res).toEqual({ month: 8, year: 2026, monthKey: '08/2026' });
    });

    it('debería parsear formato fecha completa DD/MM/YYYY', () => {
        const res = parseStartMonth('25/11/2026');
        expect(res).toEqual({ month: 11, year: 2026, monthKey: '11/2026' });
    });

    it('debería usar fallbackDate si startMonth es inválido o nulo', () => {
        const res = parseStartMonth('', '12/05/2026');
        expect(res).toEqual({ month: 5, year: 2026, monthKey: '05/2026' });
    });
});

describe('getEstimatedCardDates', () => {
    it('debería calcular el cierre y vencimiento para una fecha antes del cierre', () => {
        const ref = new Date(2026, 3, 10); // 10 de Abril de 2026
        const res = getEstimatedCardDates(20, 5, ref);
        expect(res.nextClosingDate).toBe('20/04/2026');
        expect(res.nextDueDate).toBe('05/05/2026');
    });

    it('debería avanzar al mes siguiente si la fecha actual ya superó el día de cierre', () => {
        const ref = new Date(2026, 3, 25); // 25 de Abril de 2026 (pasó el día 20)
        const res = getEstimatedCardDates(20, 5, ref);
        expect(res.nextClosingDate).toBe('20/05/2026');
        expect(res.nextDueDate).toBe('05/06/2026');
    });
});

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
            originalId: '1',
            tarjeta: undefined,
        });
    });

    it('debería soportar startMonth proveniente de número de serie de Sheets', () => {
        const instalments: Instalment[] = [
            {
                id: '1',
                concept: 'Prueba serial Sheets',
                date: '01/04/2026',
                totalAmount: 300,
                instalmentsCount: 3,
                startMonth: '46113' // serial sheet date for April 2026
            }
        ];

        const result = calculateProjectedPayments(instalments);

        expect(result).toHaveLength(3);
        expect(result[0].monthKey).toBe('04/2026');
        expect(result[0].amount).toBe(100);
        expect(result[1].monthKey).toBe('05/2026');
        expect(result[2].monthKey).toBe('06/2026');
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

    it('debería filtrar proyecciones pagadas cuando se proveen pagos de tarjeta (case insensitive y trim)', () => {
        const instalments: Instalment[] = [
            {
                id: '1',
                concept: 'Compra con Tarjeta',
                date: '01/01/2026',
                totalAmount: 300,
                instalmentsCount: 3,
                startMonth: '01/2026',
                tarjeta: 'Visa Galicia '
            }
        ];

        const pagos = [
            {
                id: 'p1',
                closingDate: '25/01/2026',
                tarjeta: 'visa galicia',
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


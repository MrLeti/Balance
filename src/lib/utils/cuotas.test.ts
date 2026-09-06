import { describe, it, expect } from 'vitest';
import {
    calculateProjectedPayments,
    parseStartMonth,
    getEstimatedCardDates,
    getInitialStartMonth,
    advanceOneMonth,
    getInstalmentProgress,
    Instalment
} from './cuotas';

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

    it('debería usar día 25 y 5 por defecto si no se especifican', () => {
        const ref = new Date(2026, 4, 15); // 15 de Mayo de 2026
        const res = getEstimatedCardDates(undefined, undefined, ref);
        expect(res.nextClosingDate).toBe('25/05/2026');
        expect(res.nextDueDate).toBe('05/06/2026');
    });
});

describe('getInitialStartMonth', () => {
    it('asigna el mes actual si el gasto es antes o en el día de cierre (ej. 20 <= 25)', () => {
        const month = getInitialStartMonth('20/05/2026', { diaCierre: 25 });
        expect(month).toBe('05/2026');
    });

    it('asigna el mes siguiente si el gasto es posterior al día de cierre (ej. 26 > 25)', () => {
        const month = getInitialStartMonth('26/05/2026', { diaCierre: 25 });
        expect(month).toBe('06/2026');
    });

    it('respeta el día de cierre personalizado configurado por el usuario en la tarjeta (ej. cierre 15)', () => {
        expect(getInitialStartMonth('14/05/2026', { diaCierre: 15 })).toBe('05/2026');
        expect(getInitialStartMonth('16/05/2026', { diaCierre: 15 })).toBe('06/2026');
    });

    it('maneja correctamente el cambio de año (diciembre a enero)', () => {
        const month = getInitialStartMonth('28/12/2026', { diaCierre: 25 });
        expect(month).toBe('01/2027');
    });

    it('utiliza día 25 como fallback seguro si no se especifica tarjeta', () => {
        expect(getInitialStartMonth('20/05/2026', null)).toBe('05/2026');
        expect(getInitialStartMonth('26/05/2026', null)).toBe('06/2026');
    });
});

describe('advanceOneMonth', () => {
    it('avanza exactamente un mes manteniendo el mismo día', () => {
        expect(advanceOneMonth('25/05/2026')).toBe('25/06/2026');
        expect(advanceOneMonth('05/06/2026')).toBe('05/07/2026');
    });

    it('maneja fin de año pasando de diciembre a enero', () => {
        expect(advanceOneMonth('25/12/2026')).toBe('25/01/2027');
    });

    it('ajusta días para meses más cortos como febrero', () => {
        expect(advanceOneMonth('31/01/2026')).toBe('28/02/2026');
    });
});

describe('getInstalmentProgress', () => {
    it('calcula correctamente el progreso 1/3 cuando ninguna cuota ha sido pagada', () => {
        const inst: Instalment = {
            id: 'i1',
            date: '20/05/2026',
            concept: 'Zapatos',
            totalAmount: 30000,
            instalmentsCount: 3,
            startMonth: '05/2026',
            tarjeta: 'Visa Galicia'
        };
        const progress = getInstalmentProgress(inst, []);
        expect(progress.currentNumber).toBe(1);
        expect(progress.totalCount).toBe(3);
        expect(progress.paidCount).toBe(0);
        expect(progress.remainingAmount).toBe(30000);
        expect(progress.isCompleted).toBe(false);
    });

    it('calcula progreso 4/6 y saldo restante tras pagar 3 cuotas', () => {
        const inst: Instalment = {
            id: 'i1',
            date: '20/01/2026',
            concept: 'Televisor',
            totalAmount: 60000,
            instalmentsCount: 6,
            startMonth: '01/2026',
            tarjeta: 'Visa Galicia'
        };
        const pagos = [
            { id: 'p1', closingDate: '25/01/2026', tarjeta: 'Visa Galicia', period: '01/2026', amount: 10000 },
            { id: 'p2', closingDate: '25/02/2026', tarjeta: 'Visa Galicia', period: '02/2026', amount: 10000 },
            { id: 'p3', closingDate: '25/03/2026', tarjeta: 'Visa Galicia', period: '03/2026', amount: 10000 }
        ];
        const progress = getInstalmentProgress(inst, pagos);
        expect(progress.currentNumber).toBe(4);
        expect(progress.totalCount).toBe(6);
        expect(progress.paidCount).toBe(3);
        expect(progress.remainingAmount).toBe(30000);
        expect(progress.isCompleted).toBe(false);
    });

    it('marca completado cuando todas las cuotas han sido pagadas', () => {
        const inst: Instalment = {
            id: 'i1',
            date: '20/01/2026',
            concept: 'Licuadora',
            totalAmount: 20000,
            instalmentsCount: 2,
            startMonth: '01/2026',
            tarjeta: 'Visa Galicia'
        };
        const pagos = [
            { id: 'p1', closingDate: '25/01/2026', tarjeta: 'Visa Galicia', period: '01/2026', amount: 10000 },
            { id: 'p2', closingDate: '25/02/2026', tarjeta: 'Visa Galicia', period: '02/2026', amount: 10000 }
        ];
        const progress = getInstalmentProgress(inst, pagos);
        expect(progress.currentNumber).toBe(2);
        expect(progress.totalCount).toBe(2);
        expect(progress.paidCount).toBe(2);
        expect(progress.remainingAmount).toBe(0);
        expect(progress.isCompleted).toBe(true);
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


import { describe, it, expect } from 'vitest';
import {
    detectSubscriptions,
    detectCategorySpikes,
    detectSavingsVelocity,
    detectUnpaidSubscriptions,
    detectInactivity,
    detectMissingIncome,
    detectNextMonthEndingInstalments,
    calculateVestaScore,
    evaluateBudget503020,
    detectMicroSpending
} from './intelligence';

describe('Intelligence Utility Suite', () => {
    describe('detectSubscriptions', () => {
        it('returns empty array (deprecated: replaced by manual subscription toggles)', () => {
            // detectSubscriptions was replaced by user-defined subscription_subcategories.
            // The function is now a stub that always returns [] to avoid false positives.
            const rows = [
                ['1', '05/01/2026', 'Egreso', 'Comunes', 'Suscripciones', 5000, 'Spotify'],
                ['2', '05/02/2026', 'Egreso', 'Comunes', 'Suscripciones', 5000, 'Spotify'],
            ];
            expect(detectSubscriptions(rows)).toHaveLength(0);
        });
    });

    describe('detectCategorySpikes', () => {
        it('calculates average only against months with active records for that category', () => {
            // User only has 1 previous month of history (02/2026), spent 100,000 on Comunes.
            // In current month (03/2026), spent 105,000.
            // With the bug, avg was 100,000 / 3 = 33,333, falsely triggering a spike.
            // With fix, avg is 100,000 / 1 = 100,000, so NO spike is triggered!
            const data = [
                ['1', '10/02/2026', 'Egreso', 'Comunes', 'Mercadería', 100000, 'Super'],
                ['2', '10/03/2026', 'Egreso', 'Comunes', 'Mercadería', 105000, 'Super'],
            ];

            const alert = detectCategorySpikes(data, '03/2026');
            expect(alert).toBeNull();
        });

        it('triggers a spike when spending truly exceeds historical average by >35%', () => {
            const data = [
                ['1', '10/01/2026', 'Egreso', 'Comunes', 'Mercadería', 50000, 'Super'],
                ['2', '10/02/2026', 'Egreso', 'Comunes', 'Mercadería', 50000, 'Super'],
                ['3', '10/03/2026', 'Egreso', 'Comunes', 'Mercadería', 120000, 'Super'],
            ];

            const alert = detectCategorySpikes(data, '03/2026');
            expect(alert).not.toBeNull();
            expect(alert?.tag).toBe('Pico de Gasto');
            expect(alert?.title).toContain('Comunes');
        });
    });

    describe('detectSavingsVelocity', () => {
        it('identifies goal on track when monthly savings pace reaches target before deadline', () => {
            const now = new Date();
            const curM = String(now.getMonth() + 1).padStart(2, '0');
            const curY = now.getFullYear();
            const futureY = curY + 1; // 1 year ahead

            const goals = [
                {
                    id: 'g-1',
                    name: 'Vacaciones',
                    targetAmount: 120000,
                    currentSaved: 60000,
                    deadline: `${futureY}-${curM}`,
                },
            ];

            // Recent contributions: 20,000 per month
            const data = [
                ['1', `05/${curM}/${curY}`, 'Ahorro', 'Aporte', 'Vacaciones', 20000, ''],
            ];

            const alerts = detectSavingsVelocity(goals, data);
            expect(alerts.length).toBeGreaterThanOrEqual(1);
            expect(alerts[0].type).toBe('success');
            expect(alerts[0].title).toContain('En camino');
        });
    });

    describe('detectInactivity', () => {
        it('returns an alert when no transaction has been registered for more than 7 days', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 12);
            const dStr = `${String(pastDate.getDate()).padStart(2, '0')}/${String(pastDate.getMonth() + 1).padStart(2, '0')}/${pastDate.getFullYear()}`;

            const data = [
                ['1', dStr, 'Egreso', 'Comunes', 'Mercadería', 5000, 'Pan'],
            ];

            const alert = detectInactivity(data);
            expect(alert).not.toBeNull();
            expect(alert?.tag).toBe('Actualización');
            expect(alert?.title).toContain('12 días');
        });

        it('returns null if transaction was made recently (e.g. yesterday)', () => {
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 1);
            const dStr = `${String(recentDate.getDate()).padStart(2, '0')}/${String(recentDate.getMonth() + 1).padStart(2, '0')}/${recentDate.getFullYear()}`;

            const data = [
                ['1', dStr, 'Egreso', 'Comunes', 'Mercadería', 5000, 'Pan'],
            ];

            const alert = detectInactivity(data);
            expect(alert).toBeNull();
        });
    });

    describe('detectNextMonthEndingInstalments', () => {
        it('alerts when an installment plan finishes next month', () => {
            const now = new Date();
            const curM = now.getMonth() + 1;
            const curY = now.getFullYear();

            // Started 2 months ago, 3 instalments total -> finishes next month
            let startM = curM - 1;
            let startY = curY;
            if (startM <= 0) {
                startM += 12;
                startY -= 1;
            }

            const instalments = [
                {
                    id: 'inst-1',
                    concept: 'Smart TV',
                    totalAmount: 90000,
                    instalmentsCount: 3,
                    startMonth: `${String(startM).padStart(2, '0')}/${startY}`,
                    date: `01/${String(startM).padStart(2, '0')}/${startY}`,
                },
            ];

            const alerts = detectNextMonthEndingInstalments(instalments);
            expect(alerts).toHaveLength(1);
            expect(alerts[0].title).toContain('Próximo mes: ¡Finaliza "Smart TV"!');
            expect(alerts[0].message).toContain('30.000');
        });
    });

    describe('calculateVestaScore', () => {
        it('gives 20 points for DTI = 0 and 30 points for DTI in [1, 15]', () => {
            const scoreNoDebt = calculateVestaScore(20, 0, false, false);
            const scoreModDebt = calculateVestaScore(20, 10, false, false);

            expect(scoreNoDebt).toBe(50); // TAN 30 + DTI 20 = 50
            expect(scoreModDebt).toBe(60); // TAN 30 + DTI 30 = 60
        });
    });

    describe('evaluateBudget503020', () => {
        it('correctly maps custom categories matching supermarket, pharmacy, utilities to needs', () => {
            const rows = [
                ['1', '01/03/2026', 'Egreso', 'Supermercado Mensual', 'Carnes', 40000, ''],
                ['2', '02/03/2026', 'Egreso', 'Servicios del Hogar', 'Luz y Gas', 30000, ''],
            ];

            const alert = evaluateBudget503020(rows, 100000, 70000);
            expect(alert).not.toBeNull();
            expect(alert?.id).toBe('budget-503020-needs');
            expect(alert?.message).toContain('70%');
        });
    });

    describe('detectUnpaidSubscriptions', () => {
        it('returns null when no subscriptions are marked', () => {
            const now = new Date();
            const balanceMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const result = detectUnpaidSubscriptions([], [], balanceMonth);
            expect(result).toBeNull();
        });

        it('returns null when viewing a past month', () => {
            const categories = [
                { name: 'Habitacionales', type: 'Egreso', subscriptionSubcategories: ['Gas'] },
            ];
            const result = detectUnpaidSubscriptions(categories, [], '01/2025');
            expect(result).toBeNull();
        });

        it('returns null when all subscriptions are already paid this month', () => {
            const now = new Date();
            // Only fires after day 5, so simulate day >= 5 by testing against current month
            // (if today < 5, this test can't fire, but we test the "paid" branch)
            const balanceMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const d = String(now.getDate()).padStart(2, '0');
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const y = now.getFullYear();
            const categories = [
                { name: 'Habitacionales', type: 'Egreso', subscriptionSubcategories: ['Gas'] },
            ];
            const filteredMonthData = [
                ['1', `${d}/${m}/${y}`, 'Egreso', 'Habitacionales', 'Gas', 15000, ''],
            ];
            const result = detectUnpaidSubscriptions(categories, filteredMonthData, balanceMonth);
            // If day < 5 test returns null (guard), if >= 5 and paid also returns null
            expect(result).toBeNull();
        });

        it('generates a single consolidated alert listing all unpaid subscriptions', () => {
            const now = new Date();
            if (now.getDate() < 5) return; // Guard: test only fires after day 5

            const balanceMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const categories = [
                { name: 'Habitacionales', type: 'Egreso', subscriptionSubcategories: ['Gas', 'Internet'] },
                { name: 'Ocio', type: 'Egreso', subscriptionSubcategories: ['Netflix'] },
            ];
            // No transactions this month
            const result = detectUnpaidSubscriptions(categories, [], balanceMonth);
            expect(result).not.toBeNull();
            expect(result?.id).toBe('unpaid-subscriptions');
            expect(result?.type).toBe('warning');
            expect(result?.message).toContain('Gas');
            expect(result?.message).toContain('Internet');
            expect(result?.message).toContain('Netflix');
        });
    });
});

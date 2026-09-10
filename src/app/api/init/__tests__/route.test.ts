import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

describe('Unified Init API Route (/api/init)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 if user is not authenticated', async () => {
        (createClient as any).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
            },
        });

        const res = await GET();
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toBe('No autorizado');
    });

    it('returns consolidated transactions, categories, cuotas, and savingsGoals in one call', async () => {
        const mockUser = { id: 'user-123' };

        const mockTransactions = [
            {
                id: 'tx-1',
                date: '2026-03-15',
                type: 'Egreso',
                category: 'Comunes',
                sub_category: 'Mercadería',
                amount: 15000,
                comment: 'Coto',
                cuota_ref: null,
                investment_ref: null,
            },
            {
                id: 'tx-2',
                date: '2026-03-01',
                type: 'Ingreso',
                category: 'Salario',
                sub_category: 'Blanco',
                amount: 250000,
                comment: 'Sueldo',
                cuota_ref: null,
                investment_ref: null,
            },
        ];

        const mockCategories = [
            {
                id: 'cat-1',
                type: 'Egreso',
                name: 'Comunes',
                subcategories: ['Mercadería', 'Limpieza'],
                color: '#f59e0b',
                created_at: '2026-01-01T00:00:00Z',
            },
        ];

        const mockInstalments = [
            {
                id: 'inst-1',
                date: '2026-02-10',
                concept: 'Lavarropas',
                total_amount: 120000,
                instalments_count: 6,
                start_month: '02/2026',
                tarjeta: 'Visa',
            },
        ];

        const mockGoals = [
            {
                id: 'goal-1',
                name: 'Fondo de Emergencia',
                target_amount: 1000000,
                currency: 'ARS',
                is_emergency: true,
            },
        ];

        const fakeSupabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
            },
            from: vi.fn().mockImplementation((table: string) => {
                if (table === 'transactions') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        range: vi.fn().mockResolvedValue({ data: mockTransactions, error: null }),
                    };
                }
                if (table === 'categories') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockResolvedValue({ data: mockCategories, error: null }),
                    };
                }
                if (table === 'instalments') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockResolvedValue({ data: mockInstalments, error: null }),
                    };
                }
                if (table === 'savings_goals') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockResolvedValue({ data: mockGoals, error: null }),
                    };
                }
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }),
        };

        (createClient as any).mockResolvedValue(fakeSupabase);

        const res = await GET();
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.transactions).toHaveLength(2);
        expect(json.transactions[0][1]).toBe('15/03/2026'); // formatted date DD/MM/YYYY
        expect(json.categories).toHaveLength(1);
        expect(json.cuotas).toHaveLength(1);
        expect(json.cuotas[0].concept).toBe('Lavarropas');
        expect(json.savingsGoals).toHaveLength(1);
        expect(json.savingsGoals[0].isEmergency).toBe(true);
        expect(json.avgMonthlyExpense).toBeGreaterThanOrEqual(0);
    });
});

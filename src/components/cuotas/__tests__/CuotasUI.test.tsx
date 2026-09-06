import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TarjetasManager from '../TarjetasManager';
import PagoTarjetaModal from '../PagoTarjetaModal';
import CuotasDashboard from '../CuotasDashboard';
import { TarjetaInfo, PagoTarjeta, CuotaCompra } from '@/lib/utils/cuotas';

vi.mock('react-chartjs-2', () => ({
    Bar: () => <div data-testid="mock-bar-chart" />,
    Line: () => <div data-testid="mock-line-chart" />
}));

describe('Cuotas UI Components', () => {
    const mockOnTarjetaAdded = vi.fn();
    const mockOnLiquidarCard = vi.fn();
    const mockOnClose = vi.fn();
    const mockOnSuccess = vi.fn();

    const sampleTarjetas: TarjetaInfo[] = [
        {
            id: 'card-1',
            nombre: 'Visa Santander',
            color: '#3b82f6',
            diaCierre: 25,
            diaVencimiento: 5,
            proximoCierre: '25/09/2026',
            proximoVencimiento: '05/10/2026',
        },
        {
            id: 'card-2',
            nombre: 'Mastercard BBVA',
            color: '#ef4444',
            diaCierre: 20,
            diaVencimiento: 2,
            proximoCierre: '20/09/2026',
            proximoVencimiento: '02/10/2026',
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockImplementation((url: string | Request | URL) => {
            const urlStr = String(url);
            if (urlStr.includes('/api/tarjetas')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: sampleTarjetas })
                });
            }
            if (urlStr.includes('/api/pagos_tarjetas')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: [] })
                });
            }
            if (urlStr.includes('/api/cuotas')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        data: [
                            {
                                id: 'c1',
                                date: '10/05/2026',
                                concept: 'Zapatillas Nike',
                                totalAmount: 60000,
                                instalmentsCount: 6,
                                startMonth: '05/2026',
                                tarjeta: 'Visa Santander'
                            }
                        ]
                    })
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
    });

    describe('TarjetasManager', () => {
        it('has collapsible add-card form hidden by default and preloads 25 and 5', async () => {
            await act(async () => {
                render(
                    <TarjetasManager
                        tarjetas={sampleTarjetas}
                        onTarjetaAdded={mockOnTarjetaAdded}
                        onLiquidarCard={mockOnLiquidarCard}
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /\+ Agregar Tarjeta/i })).toBeDefined();
            });

            // Form inputs should NOT be visible initially
            expect(screen.queryByPlaceholderText(/Visa Galicia/i)).toBeNull();

            // Click toggle button to expand form
            const toggleBtn = screen.getByRole('button', { name: /\+ Agregar Tarjeta/i });
            await act(async () => {
                fireEvent.click(toggleBtn);
            });

            // Form inputs are now visible
            const nameInput = screen.getByPlaceholderText(/Visa Galicia/i);
            expect(nameInput).toBeDefined();

            // Dia Cierre defaults to 25, Dia Vencimiento defaults to 5
            const closeDayInput = screen.getByLabelText(/Día de Cierre/i) as HTMLInputElement;
            const dueDayInput = screen.getByLabelText(/Día de Vencimiento/i) as HTMLInputElement;
            expect(closeDayInput.value).toBe('25');
            expect(dueDayInput.value).toBe('5');
        });

        it('renders cards table with exact dates and Liquidar button for each card', async () => {
            await act(async () => {
                render(
                    <TarjetasManager
                        tarjetas={sampleTarjetas}
                        onTarjetaAdded={mockOnTarjetaAdded}
                        onLiquidarCard={mockOnLiquidarCard}
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('Visa Santander')).toBeDefined();
            });

            expect(screen.getByText('Mastercard BBVA')).toBeDefined();
            expect(screen.getByDisplayValue('25/09/2026')).toBeDefined();
            expect(screen.getByDisplayValue('05/10/2026')).toBeDefined();

            // Both cards should have a Liquidar button
            const liquidarButtons = screen.getAllByRole('button', { name: /💳 Liquidar/i });
            expect(liquidarButtons.length).toBe(2);

            // Clicking Liquidar invokes onLiquidarCard with that card
            await act(async () => {
                fireEvent.click(liquidarButtons[0]);
            });
            expect(mockOnLiquidarCard).toHaveBeenCalledWith(sampleTarjetas[0]);
        });
    });

    describe('PagoTarjetaModal', () => {
        it('preloads next month closing and due dates from target card and filters periods with debt', async () => {
            await act(async () => {
                render(
                    <PagoTarjetaModal
                        isOpen={true}
                        onClose={mockOnClose}
                        onSuccess={mockOnSuccess}
                        tarjetas={sampleTarjetas}
                        targetCard={sampleTarjetas[0]}
                        instalments={[
                            {
                                id: 'c1',
                                concept: 'Notebook',
                                totalAmount: 100000,
                                instalmentsCount: 10,
                                instalmentAmount: 10000,
                                startMonth: '09/2026',
                                tarjeta: 'Visa Santander'
                            }
                        ]}
                        pagos={[]}
                    />
                );
            });

            // Target card is Visa Santander (next closing 25/09/2026, next due 05/10/2026)
            // The modal should automatically advance one month: closing 25/10/2026, due 05/11/2026
            await waitFor(() => {
                const closingInput = screen.getByDisplayValue('25/10/2026') as HTMLInputElement;
                const dueInput = screen.getByDisplayValue('05/11/2026') as HTMLInputElement;
                expect(closingInput).toBeDefined();
                expect(dueInput).toBeDefined();
            });
        });
    });

    describe('CuotasDashboard', () => {
        it('renders without "Registrar nueva compra en cuotas" and includes progress and remaining columns', async () => {
            await act(async () => {
                render(<CuotasDashboard />);
            });

            // "Registrar nueva compra en cuotas" MUST NOT exist
            expect(screen.queryByText(/Registrar nueva compra en cuotas/i)).toBeNull();
            expect(screen.queryByText(/Registrar Compra en Cuotas/i)).toBeNull();

            // Progress ("Progreso") and Remaining ("Resta Pagar") table headers must exist
            await waitFor(() => {
                expect(screen.getByText('Progreso')).toBeDefined();
                expect(screen.getByText('Resta Pagar')).toBeDefined();
                expect(screen.getByText('Zapatillas Nike')).toBeDefined();
                // 0 out of 6 paid initially:
                expect(screen.getByText('0/6 pagadas')).toBeDefined();
            });
        });

        it('filters out completed cuotas when "Solo Activas" is selected and reveals them with "Mostrar Pagadas"', async () => {
            global.fetch = vi.fn().mockImplementation((url: string | Request | URL) => {
                const urlStr = String(url);
                if (urlStr.includes('/api/tarjetas')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ data: sampleTarjetas })
                    });
                }
                if (urlStr.includes('/api/pagos_tarjetas')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            data: [
                                { id: 'p1', tarjeta: 'Visa Santander', period: '01/2026', amount: 5000 },
                                { id: 'p2', tarjeta: 'Visa Santander', period: '02/2026', amount: 5000 },
                            ]
                        })
                    });
                }
                if (urlStr.includes('/api/cuotas')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            data: [
                                {
                                    id: 'c-active',
                                    date: '01/01/2026',
                                    concept: 'Lavarropas (Activa)',
                                    totalAmount: 15000,
                                    instalmentsCount: 3,
                                    startMonth: '01/2026',
                                    tarjeta: 'Visa Santander'
                                },
                                {
                                    id: 'c-done',
                                    date: '01/01/2026',
                                    concept: 'Cafetera (Pagada)',
                                    totalAmount: 10000,
                                    instalmentsCount: 2,
                                    startMonth: '01/2026',
                                    tarjeta: 'Visa Santander'
                                }
                            ]
                        })
                    });
                }
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            });

            await act(async () => {
                render(<CuotasDashboard />);
            });

            // By default "Solo Activas" is selected
            await waitFor(() => {
                expect(screen.getByText('Lavarropas (Activa)')).toBeDefined();
            });
            // "Cafetera (Pagada)" should NOT be shown in active view
            expect(screen.queryByText('Cafetera (Pagada)')).toBeNull();

            // Progress for 2 of 3 paid should show "2/3 pagadas"
            expect(screen.getByText('2/3 pagadas')).toBeDefined();

            // Switch radio to "Mostrar Pagadas"
            const showAllRadio = screen.getByLabelText(/Mostrar Pagadas/i);
            await act(async () => {
                fireEvent.click(showAllRadio);
            });

            // Now both should be visible, and completed shows "✓ Pagada"
            await waitFor(() => {
                expect(screen.getByText('Lavarropas (Activa)')).toBeDefined();
                expect(screen.getByText('Cafetera (Pagada)')).toBeDefined();
                expect(screen.getByText('✓ Pagada')).toBeDefined();
            });
        });
    });
});

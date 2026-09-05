import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ValidationModal from '../ValidationModal';
import { ExtractedItem } from '@/lib/constants';

describe('ValidationModal - List Review System for Invoices and Tickets', () => {
    const mockOnClose = vi.fn();
    const mockOnSuccess = vi.fn();

    const sampleTicketItems: ExtractedItem[] = [
        {
            Fecha: '05/09/2026',
            Tipo: 'Egreso',
            Categoría: 'Comunes',
            Subcategoría: 'Mercadería',
            Monto: '4500.50',
            Comentario: 'Leche y Galletitas',
        },
        {
            Fecha: '05/09/2026',
            Tipo: 'Egreso',
            Categoría: 'Comunes',
            Subcategoría: 'Limpieza',
            Monto: '1800.00',
            Comentario: 'Detergente magistral',
        },
        {
            Fecha: '05/09/2026',
            Tipo: 'Egreso',
            Categoría: 'Ocio',
            Subcategoría: 'Salida',
            Monto: '3200.00',
            Comentario: 'Cafetería',
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
            const urlStr = String(url);
            if (urlStr.includes('/api/categories')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: [] })
                } as Response);
            }
            if (urlStr.includes('/api/dolar')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ mep: 1300 })
                } as Response);
            }
            if (urlStr.includes('/api/savings/goals')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ goals: [] })
                } as Response);
            }
            if (urlStr.includes('/api/tarjetas')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: [{ id: 't1', nombre: 'Visa Santander' }] })
                } as Response);
            }
            if (urlStr.includes('/api/transactions')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                } as Response);
            }
            if (urlStr.includes('/api/cuotas')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ id: 'cuota-999', success: true })
                } as Response);
            }
            if (urlStr.includes('/api/process')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {
                                Fecha: '05/09/2026',
                                Tipo: 'Egreso',
                                Categoría: 'Comunes',
                                Subcategoría: 'Supermercado',
                                Monto: 4500,
                                Comentario: '4500 en súper'
                            }
                        ]
                    })
                } as Response);
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({})
            } as Response);
        });
    });

    it('renders all extracted ticket items in list mode', async () => {
        await act(async () => {
            render(
                <ValidationModal
                    items={sampleTicketItems}
                    onClose={mockOnClose}
                    onSuccess={mockOnSuccess}
                />
            );
        });

        // Header check
        expect(screen.getByText(/Revisar y Confirmar Comprobante/i)).toBeDefined();
        expect(screen.getByText(/3 ítems detectados/i)).toBeDefined();

        // Items descriptions rendered
        expect(screen.getByDisplayValue('Leche y Galletitas')).toBeDefined();
        expect(screen.getByDisplayValue('Detergente magistral')).toBeDefined();
        expect(screen.getByDisplayValue('Cafetería')).toBeDefined();

        // Amounts rendered
        expect(screen.getByDisplayValue('4500.50')).toBeDefined();
        expect(screen.getByDisplayValue('1800.00')).toBeDefined();
        expect(screen.getByDisplayValue('3200.00')).toBeDefined();

        // Totals: Global total is 4500.50 + 1800 + 3200 = 9500.50
        expect(screen.getByText('$9500.50')).toBeDefined();
        // Since they start unchecked, confirmed total should be $0.00
        expect(screen.getByText('$0.00')).toBeDefined();
    });

    it('toggles individual item checkboxes and updates Total a Guardar', async () => {
        await act(async () => {
            render(
                <ValidationModal
                    items={sampleTicketItems}
                    onClose={mockOnClose}
                    onSuccess={mockOnSuccess}
                />
            );
        });

        const item1Check = screen.getByLabelText('Seleccionar ítem 1') as HTMLInputElement;
        const item2Check = screen.getByLabelText('Seleccionar ítem 2') as HTMLInputElement;

        expect(item1Check.checked).toBe(false);
        expect(item2Check.checked).toBe(false);

        // Check Item 1 ($4500.50)
        await act(async () => {
            fireEvent.click(item1Check);
        });
        expect(item1Check.checked).toBe(true);
        expect(screen.getByText('$4500.50')).toBeDefined();
        expect(screen.getByText('(1 de 3 marcados)')).toBeDefined();

        // Check Item 2 ($1800.00) -> Total = 4500.50 + 1800 = 6300.50
        await act(async () => {
            fireEvent.click(item2Check);
        });
        expect(item2Check.checked).toBe(true);
        expect(screen.getByText('$6300.50')).toBeDefined();
        expect(screen.getByText('(2 de 3 marcados)')).toBeDefined();

        // Uncheck Item 1 -> Total returns to $1800.00
        await act(async () => {
            fireEvent.click(item1Check);
        });
        expect(item1Check.checked).toBe(false);
        expect(screen.getByText('$1800.00')).toBeDefined();
        expect(screen.getByText('(1 de 3 marcados)')).toBeDefined();
    });

    it('toggles all items using the master select all checkbox', async () => {
        await act(async () => {
            render(
                <ValidationModal
                    items={sampleTicketItems}
                    onClose={mockOnClose}
                    onSuccess={mockOnSuccess}
                />
            );
        });

        const selectAllToggle = screen.getByLabelText('Seleccionar todos los movimientos') as HTMLInputElement;
        expect(selectAllToggle.checked).toBe(false);
        expect(screen.getByText('$0.00')).toBeDefined();

        // Click Select All -> all 3 should be confirmed
        await act(async () => {
            fireEvent.click(selectAllToggle);
        });
        expect(selectAllToggle.checked).toBe(true);
        const totalElements = screen.getAllByText('$9500.50');
        expect(totalElements.length).toBe(2);
        expect(screen.getByText('(3 de 3 marcados)')).toBeDefined();

        // Click again -> all should be deselected
        await act(async () => {
            fireEvent.click(selectAllToggle);
        });
        expect(selectAllToggle.checked).toBe(false);
        expect(screen.getByText('$0.00')).toBeDefined();
        expect(screen.getByText('(0 de 3 marcados)')).toBeDefined();
    });

    it('allows inline editing of items and reflects changes in totals', async () => {
        await act(async () => {
            render(
                <ValidationModal
                    items={sampleTicketItems}
                    onClose={mockOnClose}
                    onSuccess={mockOnSuccess}
                />
            );
        });

        // Mark item 1
        const item1Check = screen.getByLabelText('Seleccionar ítem 1');
        await act(async () => {
            fireEvent.click(item1Check);
        });
        expect(screen.getByText('$4500.50')).toBeDefined();

        // Edit amount of item 1 from 4500.50 to 5000.00
        const item1AmountInput = screen.getByDisplayValue('4500.50');
        await act(async () => {
            fireEvent.change(item1AmountInput, { target: { value: '5000.00' } });
        });

        // Total should update to $5000.00
        expect(screen.getByText('$5000.00')).toBeDefined();

        // Edit description
        const descInput = screen.getByDisplayValue('Leche y Galletitas');
        await act(async () => {
            fireEvent.change(descInput, { target: { value: 'Leche descremada' } });
        });
        expect(screen.getByDisplayValue('Leche descremada')).toBeDefined();
    });

    it('saves ONLY confirmed items to /api/transactions and triggers transaction_added', async () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        await act(async () => {
            render(
                <ValidationModal
                    items={sampleTicketItems}
                    onClose={mockOnClose}
                    onSuccess={mockOnSuccess}
                />
            );
        });

        // Select ONLY item 1 and item 3 (skip item 2)
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Seleccionar ítem 1'));
            fireEvent.click(screen.getByLabelText('Seleccionar ítem 3'));
        });

        const saveButton = screen.getByRole('button', { name: /Confirmar y Guardar \(2\)/i });
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/transactions',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            ['05/09/2026', 'Egreso', 'Comunes', 'Mercadería', 4500.5, 'Leche y Galletitas', ''],
                            ['05/09/2026', 'Egreso', 'Ocio', 'Salida', 3200, 'Cafetería', '']
                        ]
                    })
                })
            );
        });

        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'transaction_added' }));
    });

    it('allows adding and removing rows in list mode', async () => {
        await act(async () => {
            render(
                <ValidationModal
                    items={sampleTicketItems}
                    onClose={mockOnClose}
                    onSuccess={mockOnSuccess}
                />
            );
        });

        expect(screen.getByText(/3 ítems detectados/i)).toBeDefined();

        // Click Add Row
        const addBtn = screen.getByRole('button', { name: /Agregar fila/i });
        await act(async () => {
            fireEvent.click(addBtn);
        });

        expect(screen.getByText(/4 ítems detectados/i)).toBeDefined();

        // Remove item 4
        const deleteButtons = screen.getAllByRole('button', { name: /Eliminar ítem/i });
        expect(deleteButtons.length).toBe(4);
        await act(async () => {
            fireEvent.click(deleteButtons[3]);
        });

        expect(screen.getByText(/3 ítems detectados/i)).toBeDefined();
    });

    it('keeps AI analyze input always visible without a toggle button and processes text prompt', async () => {
        await act(async () => {
            render(
                <ValidationModal
                    onClose={mockOnClose}
                    onSuccess={mockOnSuccess}
                />
            );
        });

        // Verify the old IA header toggle button is gone
        expect(screen.queryByRole('button', { name: /✨ IA/i })).toBeNull();

        // Verify the AI input field and title are directly visible
        expect(screen.getByText(/Analizar con IA/i)).toBeDefined();
        const aiInput = screen.getByPlaceholderText(/Escribí lo que compraste, gastaste o ingresaste\.\.\./i) as HTMLInputElement;
        expect(aiInput).toBeDefined();

        const analyzeBtn = screen.getByRole('button', { name: /Analizar/i }) as HTMLButtonElement;
        expect(analyzeBtn).toBeDefined();
        expect(analyzeBtn.disabled).toBe(true); // disabled when input is empty

        // Type text into the AI field
        await act(async () => {
            fireEvent.change(aiInput, { target: { value: '4500 en súper' } });
        });
        expect(aiInput.value).toBe('4500 en súper');
        expect(analyzeBtn.disabled).toBe(false);

        // Click Analizar
        await act(async () => {
            fireEvent.click(analyzeBtn);
        });

        // Check that /api/process was called with FormData containing text
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/process',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.any(FormData)
                })
            );
        });

        // Verify item from AI was loaded into editable list
        await waitFor(() => {
            expect(screen.getByDisplayValue('4500 en súper')).toBeDefined();
            expect(screen.getByDisplayValue('4500')).toBeDefined();
        });
    });
});


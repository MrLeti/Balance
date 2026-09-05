import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionsList from '../TransactionsList';

describe('TransactionsList Empirical Challenger (Milestone 4 Deep Validation)', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  // Generate 35 diverse historical transactions across different months and categories
  const createMockTransactions = (count: number) => {
    const categories = ['Alimentación', 'Servicios', 'Transporte', 'Salud', 'Educación', 'Ocio', 'Sueldo'];
    const subCategories = ['Supermercado', 'Electricidad', 'Combustible', 'Farmacia', 'Cursos', 'Cine', 'Principal'];
    const types = ['Egreso', 'Egreso', 'Egreso', 'Egreso', 'Egreso', 'Ahorro', 'Ingreso'];
    const dates = ['10/07/2026', '15/08/2026', '01/09/2026', '05/09/2026'];

    return Array.from({ length: count }, (_, i) => {
      const catIdx = i % categories.length;
      const date = dates[i % dates.length];
      const type = types[catIdx];
      const cat = categories[catIdx];
      const sub = subCategories[catIdx];
      const amount = (i + 1) * 1500;
      const comment = `Movimiento histórico ${i + 1} referencia`;
      return [`tx-${i + 1}`, date, type, cat, sub, amount, comment, '', ''];
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnEdit.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // 1. Column Filters (Fecha, Tipo, Categoría, Subcategoría)
  // -------------------------------------------------------------------------
  describe('Column Filters (Fecha, Tipo, Categoría, Subcategoría)', () => {
    it('renders all 4 required column filter selects', () => {
      const data = createMockTransactions(10);
      render(
        <TransactionsList
          transactions={data}
          totalCount={data.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      expect(screen.getByLabelText(/filtrar por fecha/i)).toBeDefined();
      expect(screen.getByLabelText(/filtrar por tipo/i)).toBeDefined();
      expect(screen.getByLabelText(/filtrar por categoría/i)).toBeDefined();
      expect(screen.getByLabelText(/filtrar por subcategoría/i)).toBeDefined();
    });

    it('populates distinct months in Fecha dropdown and filters correctly', () => {
      const data = createMockTransactions(15);
      render(
        <TransactionsList
          transactions={data}
          totalCount={data.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const fechaSelect = screen.getByLabelText(/filtrar por fecha/i) as HTMLSelectElement;
      const options = Array.from(fechaSelect.options).map((o) => o.value);

      expect(options).toContain('');
      expect(options).toContain('09/2026');
      expect(options).toContain('08/2026');
      expect(options).toContain('07/2026');

      // Filter by 07/2026
      fireEvent.change(fechaSelect, { target: { value: '07/2026' } });
      const visibleDates = screen.getAllByText(/10\/07\/2026/);
      expect(visibleDates.length).toBeGreaterThan(0);
      expect(screen.queryByText(/01\/09\/2026/)).toBeNull();
    });

    it('filters correctly by Tipo ("Ingreso", "Egreso", "Ahorro")', () => {
      const data = createMockTransactions(20);
      render(
        <TransactionsList
          transactions={data}
          totalCount={data.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const tipoSelect = screen.getByLabelText(/filtrar por tipo/i) as HTMLSelectElement;

      // Filter by Ahorro
      fireEvent.change(tipoSelect, { target: { value: 'Ahorro' } });
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => {
        expect(row.textContent).toContain('Ahorro');
        expect(row.textContent).not.toContain('Sueldo');
      });
    });

    it('filters correctly by Categoría dropdown', () => {
      const data = createMockTransactions(20);
      render(
        <TransactionsList
          transactions={data}
          totalCount={data.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const catSelect = screen.getByLabelText(/filtrar por categoría/i) as HTMLSelectElement;
      fireEvent.change(catSelect, { target: { value: 'Alimentación' } });

      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => {
        expect(row.textContent).toContain('Alimentación');
      });
    });

    it('filters correctly by Subcategoría dropdown', () => {
      const data = createMockTransactions(20);
      render(
        <TransactionsList
          transactions={data}
          totalCount={data.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const subCatSelect = screen.getByLabelText(/filtrar por subcategoría/i) as HTMLSelectElement;
      fireEvent.change(subCatSelect, { target: { value: 'Supermercado' } });

      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => {
        expect(row.textContent).toContain('Supermercado');
      });
    });

    it('intersects multiple filters simultaneously (Fecha + Tipo + Categoría)', () => {
      const data = createMockTransactions(30);
      render(
        <TransactionsList
          transactions={data}
          totalCount={data.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const fechaSelect = screen.getByLabelText(/filtrar por fecha/i);
      const tipoSelect = screen.getByLabelText(/filtrar por tipo/i);
      const catSelect = screen.getByLabelText(/filtrar por categoría/i);

      fireEvent.change(fechaSelect, { target: { value: '09/2026' } });
      fireEvent.change(tipoSelect, { target: { value: 'Ingreso' } });
      fireEvent.change(catSelect, { target: { value: 'Sueldo' } });

      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => {
        expect(row.textContent).toContain('09/2026');
        expect(row.textContent).toContain('Ingreso');
        expect(row.textContent).toContain('Sueldo');
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Pagination (Initial 20 & Internal Toggle)
  // -------------------------------------------------------------------------
  describe('Pagination (initialLimit 20 & Internal Toggle)', () => {
    it('displays strictly 20 items initially when provided with 35 historical transactions', () => {
      const data = createMockTransactions(35);
      render(
        <TransactionsList
          transactions={data}
          totalCount={data.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      // 1 thead row + 20 tbody rows = 21 rows
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(21);

      // Verify internal toggle button
      const toggleBtn = screen.getByRole('button', { name: /ver todos los movimientos \(35 en total\) 👇/i });
      expect(toggleBtn).toBeDefined();
    });

    it('expands to all 35 transactions upon clicking the toggle button and flips text to collapse', () => {
      const data = createMockTransactions(35);
      render(
        <TransactionsList
          transactions={data}
          totalCount={data.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const expandBtn = screen.getByRole('button', { name: /ver todos los movimientos \(35 en total\) 👇/i });
      fireEvent.click(expandBtn);

      // 1 thead row + 35 tbody rows = 36 rows
      expect(screen.getAllByRole('row')).toHaveLength(36);

      // Button flips to collapse
      const collapseBtn = screen.getByRole('button', { name: /mostrar solo primeros 20 movimientos ☝️/i });
      expect(collapseBtn).toBeDefined();

      // Collapse back
      fireEvent.click(collapseBtn);
      expect(screen.getAllByRole('row')).toHaveLength(21);
      expect(screen.getByRole('button', { name: /ver todos los movimientos \(35 en total\) 👇/i })).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Global Search & Highlighting (<mark>)
  // -------------------------------------------------------------------------
  describe('Global Search & Highlighting (<mark>)', () => {
    it('highlights matching search query in table cells using <mark> tag', () => {
      const data = [
        ['tx-1', '01/09/2026', 'Egreso', 'Farmacia', 'Medicamentos', 4500, 'Compra amoxicilina en farmacia central', '', ''],
      ];

      const { container } = render(
        <TransactionsList
          transactions={data}
          totalCount={1}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const searchInput = screen.getByPlaceholderText(/buscar/i);
      fireEvent.change(searchInput, { target: { value: 'amoxicilina' } });

      const markElements = container.querySelectorAll('mark');
      expect(markElements.length).toBeGreaterThan(0);
      expect(markElements[0].textContent?.toLowerCase()).toBe('amoxicilina');
    });
  });

  // -------------------------------------------------------------------------
  // 4. In-situ Pill Editing (✓ Guardar / ✗ Cancelar)
  // -------------------------------------------------------------------------
  describe('Immediate In-situ Pill Editing', () => {
    it('immediately renders ✓ and ✗ pill buttons when editing a cell', () => {
      const data = [
        ['tx-1', '01/09/2026', 'Egreso', 'Alimentación', 'Supermercado', 5000, 'Comentario previo', '', ''],
      ];

      render(
        <TransactionsList
          transactions={data}
          totalCount={1}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      fireEvent.click(screen.getByText('Comentario previo'));

      const savePill = screen.getByRole('button', { name: /✓/i });
      const cancelPill = screen.getByRole('button', { name: /✗/i });

      expect(savePill).toBeDefined();
      expect(savePill.getAttribute('title')).toBe('Guardar (Enter)');
      expect(cancelPill).toBeDefined();
      expect(cancelPill.getAttribute('title')).toBe('Cancelar (Esc)');
    });

    it('commits edit upon clicking ✓ button without requiring blur or confirmation bubble', async () => {
      const data = [
        ['tx-1', '01/09/2026', 'Egreso', 'Alimentación', 'Supermercado', 5000, 'Texto antiguo', '', ''],
      ];

      render(
        <TransactionsList
          transactions={data}
          totalCount={1}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      fireEvent.click(screen.getByText('Texto antiguo'));
      const input = screen.getByDisplayValue('Texto antiguo');
      fireEvent.change(input, { target: { value: 'Texto nuevo y guardado' } });

      const savePill = screen.getByRole('button', { name: /✓/i });
      fireEvent.click(savePill);

      await waitFor(() => {
        expect(mockOnEdit).toHaveBeenCalledWith('tx-1', 'comment', 'Texto nuevo y guardado');
      });
    });

    it('cancels edit upon clicking ✗ button and restores original text', () => {
      const data = [
        ['tx-1', '01/09/2026', 'Egreso', 'Alimentación', 'Supermercado', 5000, 'Texto intacto', '', ''],
      ];

      render(
        <TransactionsList
          transactions={data}
          totalCount={1}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      fireEvent.click(screen.getByText('Texto intacto'));
      const input = screen.getByDisplayValue('Texto intacto');
      fireEvent.change(input, { target: { value: 'Texto que se cancelará' } });

      const cancelPill = screen.getByRole('button', { name: /✗/i });
      fireEvent.click(cancelPill);

      expect(mockOnEdit).not.toHaveBeenCalled();
      expect(screen.getByText('Texto intacto')).toBeDefined();
      expect(screen.queryByDisplayValue('Texto que se cancelará')).toBeNull();
    });

    it('supports keyboard shortcuts: Enter commits edit, Escape cancels edit', async () => {
      const data = [
        ['tx-1', '01/09/2026', 'Egreso', 'Alimentación', 'Supermercado', 5000, 'Comentario enter', '', ''],
      ];

      render(
        <TransactionsList
          transactions={data}
          totalCount={1}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      // Enter test
      fireEvent.click(screen.getByText('Comentario enter'));
      const input = screen.getByDisplayValue('Comentario enter');
      fireEvent.change(input, { target: { value: 'Guardado con Enter' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnEdit).toHaveBeenCalledWith('tx-1', 'comment', 'Guardado con Enter');
      });

      // Escape test
      const table = screen.getByRole('table');
      fireEvent.click(within(table).getByText('Alimentación'));
      const catInput = screen.getByDisplayValue('Alimentación');
      fireEvent.change(catInput, { target: { value: 'Cambio cancelado con Esc' } });
      fireEvent.keyDown(catInput, { key: 'Escape' });

      expect(mockOnEdit).toHaveBeenCalledTimes(1); // not called again
      expect(within(table).getByText('Alimentación')).toBeDefined();
    });
  });
});

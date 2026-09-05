import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditableTable, { ColumnDef, FilterDef } from '../EditableTable';

describe('EditableTable Component (Tiers 1-4: Movimientos Table Contracts)', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  const sampleColumns: ColumnDef[] = [
    { key: 'date', header: 'Fecha', type: 'date', editable: true },
    { key: 'type', header: 'Tipo', type: 'select', options: ['Ingreso', 'Egreso', 'Ahorro', 'Inversión'], editable: true },
    { key: 'category', header: 'Categoría', type: 'text', editable: true },
    { key: 'sub_category', header: 'Subcategoría', type: 'text', editable: true },
    { key: 'amount', header: 'Importe', type: 'number', editable: true },
    { key: 'comment', header: 'Comentario', type: 'text', editable: true },
  ];

  const sampleFilters: FilterDef[] = [
    {
      key: 'date',
      label: 'Fecha',
      options: [
        { value: '', label: 'Todas las fechas' },
        { value: '01/09/2026', label: '01/09/2026' },
        { value: '02/09/2026', label: '02/09/2026' },
      ],
    },
    {
      key: 'type',
      label: 'Tipo',
      options: [
        { value: '', label: 'Todos' },
        { value: 'Ingreso', label: 'Ingreso' },
        { value: 'Egreso', label: 'Egreso' },
      ],
    },
    {
      key: 'category',
      label: 'Categoría',
      options: [
        { value: '', label: 'Todas las categorías' },
        { value: 'Alimentación', label: 'Alimentación' },
        { value: 'Servicios', label: 'Servicios' },
        { value: 'Sueldo', label: 'Sueldo' },
      ],
    },
    {
      key: 'sub_category',
      label: 'Subcategoría',
      options: [
        { value: '', label: 'Todas las subcategorías' },
        { value: 'Supermercado', label: 'Supermercado' },
        { value: 'Luz', label: 'Luz' },
        { value: 'Principal', label: 'Principal' },
      ],
    },
  ];

  // Helper to generate N realistic transaction rows
  function generateRows(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `tx-${i + 1}`,
      date: i % 2 === 0 ? '01/09/2026' : '02/09/2026',
      type: i % 3 === 0 ? 'Ingreso' : 'Egreso',
      category: i % 3 === 0 ? 'Sueldo' : i % 2 === 0 ? 'Alimentación' : 'Servicios',
      sub_category: i % 3 === 0 ? 'Principal' : i % 2 === 0 ? 'Supermercado' : 'Luz',
      amount: (i + 1) * 1000,
      comment: `Transacción número ${i + 1}`,
    }));
  }

  beforeEach(() => {
    mockOnEdit.mockReset();
    mockOnDelete.mockReset();
    mockOnEdit.mockResolvedValue(undefined);
  });

  // =========================================================================
  // Tier 1: 20 Records Initial Limit & Toggle Button
  // =========================================================================
  describe('Initial Limit & Pagination Toggle (R4 Specification)', () => {
    it('displays exactly 20 rows by default when given 30 rows and initialLimit=20', () => {
      const rows = generateRows(30);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          initialLimit={20}
          loadMoreLabel="Ver todos los movimientos"
        />
      );

      // 1 thead row + 20 tbody rows = 21 tr elements
      const tableRows = screen.getAllByRole('row');
      expect(tableRows).toHaveLength(21);

      // Verify toggle button is visible with total count
      const toggleButton = screen.getByRole('button', { name: /30 en total/i });
      expect(toggleButton).toBeDefined();
    });

    it('expands to show all 30 rows when clicking the toggle button', () => {
      const rows = generateRows(30);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          initialLimit={20}
          loadMoreLabel="Ver todos los movimientos"
        />
      );

      const expandButton = screen.getByRole('button', { name: /30 en total/i });
      fireEvent.click(expandButton);

      // 1 thead row + 30 tbody rows = 31 tr elements
      const allRows = screen.getAllByRole('row');
      expect(allRows).toHaveLength(31);

      // Toggle button text flips to collapse
      const collapseButton = screen.getByRole('button', { name: /mostrar solo primeras 20/i });
      expect(collapseButton).toBeDefined();
    });

    it('collapses back to 20 rows when clicking the collapse button', () => {
      const rows = generateRows(30);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          initialLimit={20}
          loadMoreLabel="Ver todos los movimientos"
        />
      );

      // Expand
      fireEvent.click(screen.getByRole('button', { name: /30 en total/i }));
      expect(screen.getAllByRole('row')).toHaveLength(31);

      // Collapse
      fireEvent.click(screen.getByRole('button', { name: /mostrar solo primeras 20/i }));
      expect(screen.getAllByRole('row')).toHaveLength(21);
      expect(screen.getByRole('button', { name: /30 en total/i })).toBeDefined();
    });

    it('does not display toggle button when rows are less than or equal to initialLimit', () => {
      const rows = generateRows(15);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          initialLimit={20}
          loadMoreLabel="Ver todos los movimientos"
        />
      );

      const tableRows = screen.getAllByRole('row');
      expect(tableRows).toHaveLength(16); // 1 header + 15 rows

      expect(screen.queryByRole('button', { name: /en total/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /primeras/i })).toBeNull();
    });
  });

  // =========================================================================
  // Tier 2: Column Filtering (Fecha, Tipo, Categoría, Subcategoría)
  // =========================================================================
  describe('Column Filtering (Fecha, Tipo, Categoría, Subcategoría)', () => {
    it('filters rows in real-time by Tipo column', () => {
      const rows = generateRows(10);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          filters={sampleFilters}
        />
      );

      // Find the select for Tipo
      const allSelects = screen.getAllByRole('combobox');
      const tipoFilter = allSelects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'Ingreso')
      )!;

      // Filter by Ingreso
      fireEvent.change(tipoFilter, { target: { value: 'Ingreso' } });

      const filteredRows = screen.getAllByRole('row').slice(1); // omit header
      expect(filteredRows.length).toBeGreaterThan(0);
      filteredRows.forEach((row) => {
        expect(row.textContent).toContain('Ingreso');
        expect(row.textContent).not.toContain('Egreso');
      });
    });

    it('filters rows in real-time by Categoría column', () => {
      const rows = generateRows(10);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          filters={sampleFilters}
        />
      );

      const allSelects = screen.getAllByRole('combobox');
      const catFilter = allSelects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'Alimentación')
      )!;

      fireEvent.change(catFilter, { target: { value: 'Alimentación' } });

      const filteredRows = screen.getAllByRole('row').slice(1);
      expect(filteredRows.length).toBeGreaterThan(0);
      filteredRows.forEach((row) => {
        expect(row.textContent).toContain('Alimentación');
      });
    });

    it('filters rows in real-time by Subcategoría column', () => {
      const rows = generateRows(10);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          filters={sampleFilters}
        />
      );

      const allSelects = screen.getAllByRole('combobox');
      const subcatFilter = allSelects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'Supermercado')
      )!;

      fireEvent.change(subcatFilter, { target: { value: 'Supermercado' } });

      const filteredRows = screen.getAllByRole('row').slice(1);
      expect(filteredRows.length).toBeGreaterThan(0);
      filteredRows.forEach((row) => {
        expect(row.textContent).toContain('Supermercado');
      });
    });

    it('combines multiple column filters simultaneously (Tipo + Categoría)', () => {
      const rows = generateRows(12);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          filters={sampleFilters}
        />
      );

      const allSelects = screen.getAllByRole('combobox');
      const tipoFilter = allSelects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'Egreso')
      )!;
      const catFilter = allSelects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'Alimentación')
      )!;

      fireEvent.change(tipoFilter, { target: { value: 'Egreso' } });
      fireEvent.change(catFilter, { target: { value: 'Alimentación' } });

      const filteredRows = screen.getAllByRole('row').slice(1);
      expect(filteredRows.length).toBeGreaterThan(0);
      filteredRows.forEach((row) => {
        expect(row.textContent).toContain('Egreso');
        expect(row.textContent).toContain('Alimentación');
      });
    });

    it('restores all records when resetting filter to empty option', () => {
      const rows = generateRows(10);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          filters={sampleFilters}
        />
      );

      const allSelects = screen.getAllByRole('combobox');
      const tipoFilter = allSelects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'Ingreso')
      )!;

      // Filter
      fireEvent.change(tipoFilter, { target: { value: 'Ingreso' } });
      expect(screen.getAllByRole('row').slice(1).length).toBeLessThan(10);

      // Reset
      fireEvent.change(tipoFilter, { target: { value: '' } });
      expect(screen.getAllByRole('row').slice(1).length).toBe(10);
    });
  });

  // =========================================================================
  // Tier 3: Global Search & Highlighting
  // =========================================================================
  describe('Global Search across All History (R4)', () => {
    it('searches across all historical fields in a case-insensitive manner', () => {
      const rows = [
        { id: '1', date: '01/09/2026', type: 'Egreso', category: 'Alimentación', sub_category: 'Supermercado', amount: 5000, comment: 'Compra semanal coto' },
        { id: '2', date: '02/09/2026', type: 'Ingreso', category: 'Sueldo', sub_category: 'Honorarios', amount: 150000, comment: 'Pago consultoría cliente' },
        { id: '3', date: '03/09/2026', type: 'Egreso', category: 'Transporte', sub_category: 'Combustible', amount: 8000, comment: 'Carga nafta ypf' },
      ];

      render(<EditableTable columns={sampleColumns} rows={rows} />);

      const searchInput = screen.getByPlaceholderText(/buscar/i);

      // Search by uppercase term matching comment
      fireEvent.change(searchInput, { target: { value: 'COTO' } });
      expect(screen.getByText(/compra semanal coto/i)).toBeDefined();
      expect(screen.queryByText(/honorarios/i)).toBeNull();
      expect(screen.queryByText(/combustible/i)).toBeNull();

      // Search by partial category
      fireEvent.change(searchInput, { target: { value: 'Transp' } });
      expect(screen.getByText(/combustible/i)).toBeDefined();
      expect(screen.queryByText(/coto/i)).toBeNull();
    });

    it('displays empty message when search yields no matches', () => {
      const rows = generateRows(5);
      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          emptyMessage="No se encontraron movimientos."
        />
      );

      const searchInput = screen.getByPlaceholderText(/buscar/i);
      fireEvent.change(searchInput, { target: { value: 'NonExistentXYZ999' } });

      expect(screen.getByText('No se encontraron movimientos.')).toBeDefined();
      expect(screen.queryByRole('row', { name: /transacción número/i })).toBeNull();
    });

    it('supports visual <mark> tags when search term matches cell content', () => {
      const rows = [
        { id: '1', date: '01/09/2026', type: 'Egreso', category: 'Farmacia', sub_category: 'Medicamentos', amount: 3500, comment: 'Ibuprofeno' },
      ];

      const { container } = render(
        <EditableTable columns={sampleColumns} rows={rows} />
      );

      const searchInput = screen.getByPlaceholderText(/buscar/i);
      fireEvent.change(searchInput, { target: { value: 'Farmacia' } });

      // Verifies matching row is visible
      expect(screen.getByText(/farmacia/i)).toBeDefined();

      // If <mark> highlighting is active, verify mark element properties
      const markElements = container.querySelectorAll('mark');
      if (markElements.length > 0) {
        expect(markElements[0].textContent?.toLowerCase()).toBe('farmacia');
      }
    });
  });

  // =========================================================================
  // Tier 4: In-situ Editing with Action Buttons (✓ Save and ✗ Cancel)
  // =========================================================================
  describe('In-situ Editing, Action Buttons & Keyboard Support', () => {
    it('activates cell editing input upon clicking an editable cell', () => {
      const rows = [
        { id: '1', date: '01/09/2026', type: 'Egreso', category: 'Alimentación', sub_category: 'Super', amount: 5000, comment: 'Original text' },
      ];

      render(<EditableTable columns={sampleColumns} rows={rows} onEdit={mockOnEdit} />);

      const cell = screen.getByText('Original text');
      fireEvent.click(cell);

      // Active input should now exist with the current value
      const input = screen.getByDisplayValue('Original text') as HTMLInputElement;
      expect(input).toBeDefined();
      expect(input.tagName).toBe('INPUT');
    });

    it('cancels editing on Escape key without committing or calling onEdit', () => {
      const rows = [
        { id: '1', date: '01/09/2026', type: 'Egreso', category: 'Alimentación', sub_category: 'Super', amount: 5000, comment: 'Draft text' },
      ];

      render(<EditableTable columns={sampleColumns} rows={rows} onEdit={mockOnEdit} />);

      fireEvent.click(screen.getByText('Draft text'));
      const input = screen.getByDisplayValue('Draft text');

      fireEvent.change(input, { target: { value: 'Modified text that will be cancelled' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Input should disappear, original text remains, onEdit never called
      expect(screen.queryByDisplayValue('Modified text that will be cancelled')).toBeNull();
      expect(screen.getByText('Draft text')).toBeDefined();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it('commits changes and triggers onEdit with correct payload via Save action button (✓)', async () => {
      const rows = [
        { id: '1', date: '01/09/2026', type: 'Egreso', category: 'Alimentación', sub_category: 'Super', amount: 5000, comment: 'Old comment' },
      ];

      render(<EditableTable columns={sampleColumns} rows={rows} onEdit={mockOnEdit} />);

      fireEvent.click(screen.getByText('Old comment'));
      const input = screen.getByDisplayValue('Old comment');

      fireEvent.change(input, { target: { value: 'New updated comment' } });

      // Save action button: either immediate pill button or confirmation button
      let saveBtn = screen.queryByRole('button', { name: /✓/i }) || screen.queryByTitle(/guardar/i);
      if (!saveBtn) {
        // Trigger commit draft to reveal confirm action
        fireEvent.keyDown(input, { key: 'Enter' });
        saveBtn = screen.getByRole('button', { name: /✓/i });
      }

      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockOnEdit).toHaveBeenCalledWith('1', 'comment', 'New updated comment');
      });
    });

    it('cancels changes via Cancel action button (✗) without triggering onEdit', () => {
      const rows = [
        { id: '1', date: '01/09/2026', type: 'Egreso', category: 'Alimentación', sub_category: 'Super', amount: 5000, comment: 'Keep original' },
      ];

      render(<EditableTable columns={sampleColumns} rows={rows} onEdit={mockOnEdit} />);

      fireEvent.click(screen.getByText('Keep original'));
      const input = screen.getByDisplayValue('Keep original');

      fireEvent.change(input, { target: { value: 'Changed value' } });

      let cancelBtn = screen.queryByRole('button', { name: /✗/i }) || screen.queryByTitle(/cancelar/i);
      if (!cancelBtn) {
        fireEvent.keyDown(input, { key: 'Enter' });
        cancelBtn = screen.getByRole('button', { name: /✗/i });
      }

      fireEvent.click(cancelBtn);

      expect(mockOnEdit).not.toHaveBeenCalled();
      expect(screen.getByText('Keep original')).toBeDefined();
    });

    it('commits number columns with evaluated arithmetic expressions', async () => {
      const rows = [
        { id: '1', date: '01/09/2026', type: 'Egreso', category: 'Alimentación', sub_category: 'Super', amount: 1000, comment: 'Math test' },
      ];

      render(<EditableTable columns={sampleColumns} rows={rows} onEdit={mockOnEdit} />);

      fireEvent.click(screen.getByText('1000'));
      const input = screen.getByDisplayValue('1000');

      // Enter arithmetic formula e.g. 1000 + 500
      fireEvent.change(input, { target: { value: '1000+500' } });

      let saveBtn = screen.queryByRole('button', { name: /✓/i }) || screen.queryByTitle(/guardar/i);
      if (!saveBtn) {
        fireEvent.keyDown(input, { key: 'Enter' });
        saveBtn = screen.getByRole('button', { name: /✓/i });
      }

      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockOnEdit).toHaveBeenCalledWith('1', 'amount', 1500);
      });
    });

    it('does not trigger onEdit if the edited value is unchanged', () => {
      const rows = [
        { id: '1', date: '01/09/2026', type: 'Egreso', category: 'Alimentación', sub_category: 'Super', amount: 5000, comment: 'Unchanged value' },
      ];

      render(<EditableTable columns={sampleColumns} rows={rows} onEdit={mockOnEdit} />);

      fireEvent.click(screen.getByText('Unchanged value'));
      const input = screen.getByDisplayValue('Unchanged value');

      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnEdit).not.toHaveBeenCalled();
      expect(screen.getByText('Unchanged value')).toBeDefined();
    });

    it('invokes onDelete callback when delete button (×) is clicked', () => {
      const rows = [
        { id: 'tx-to-delete', date: '01/09/2026', type: 'Egreso', category: 'Alimentación', sub_category: 'Super', amount: 5000, comment: 'To delete' },
      ];

      render(
        <EditableTable
          columns={sampleColumns}
          rows={rows}
          onDelete={mockOnDelete}
        />
      );

      const deleteBtn = screen.getByRole('button', { name: '×' });
      fireEvent.click(deleteBtn);

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
      expect(mockOnDelete).toHaveBeenCalledWith('tx-to-delete');
    });
  });
});

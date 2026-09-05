import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionsList from '../TransactionsList';

describe('TransactionsList Tree-Cascading & Date Range Filters', () => {
  const mockOnDelete = vi.fn();
  const mockOnEdit = vi.fn();

  // Diverse test dataset with distinct tree hierarchies and dates
  const sampleTransactions = [
    // Habitacionales -> Alquiler, Expensas (Egreso)
    ['tx-1', '05/09/2026', 'Egreso', 'Habitacionales', 'Alquiler', 120000, 'Alquiler mensual', '', ''],
    ['tx-2', '10/09/2026', 'Egreso', 'Habitacionales', 'Expensas', 35000, 'Expensas edificio', '', ''],
    // Comunes -> Supermercado, Farmacia (Egreso)
    ['tx-3', '15/08/2026', 'Egreso', 'Comunes', 'Supermercado', 45000, 'Compras super', '', ''],
    ['tx-4', '20/08/2026', 'Egreso', 'Comunes', 'Farmacia', 12000, 'Medicamentos', '', ''],
    // Sueldo -> Principal (Ingreso)
    ['tx-5', '01/08/2026', 'Ingreso', 'Sueldo', 'Principal', 300000, 'Sueldo mensual', '', ''],
    // Inversiones -> Cedears (Inversión)
    ['tx-6', '12/07/2025', 'Inversión', 'Inversiones', 'Cedears', 50000, 'Compra Apple', '', ''],
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnEdit.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // 1. Tree-Cascading Filters: Category -> Subcategory
  // ---------------------------------------------------------------------------
  describe('Tree-Cascading Category -> Subcategory', () => {
    it('shows only subcategories belonging to the selected category', () => {
      render(
        <TransactionsList
          transactions={sampleTransactions}
          totalCount={sampleTransactions.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const categorySelect = screen.getByLabelText(/filtrar por categoría/i) as HTMLSelectElement;
      const subCategorySelect = screen.getByLabelText(/filtrar por subcategoría/i) as HTMLSelectElement;

      // Before selecting a category, all subcategories are available
      const initialSubOptions = Array.from(subCategorySelect.options).map((o) => o.value);
      expect(initialSubOptions).toContain('Alquiler');
      expect(initialSubOptions).toContain('Supermercado');
      expect(initialSubOptions).toContain('Principal');

      // Select category "Habitacionales"
      fireEvent.change(categorySelect, { target: { value: 'Habitacionales' } });

      const filteredSubOptions = Array.from(subCategorySelect.options).map((o) => o.value);

      // Must contain only Habitacionales subcategories
      expect(filteredSubOptions).toContain('');
      expect(filteredSubOptions).toContain('Alquiler');
      expect(filteredSubOptions).toContain('Expensas');
      // Must NOT contain subcategories of other categories
      expect(filteredSubOptions).not.toContain('Supermercado');
      expect(filteredSubOptions).not.toContain('Farmacia');
      expect(filteredSubOptions).not.toContain('Principal');
      expect(filteredSubOptions).not.toContain('Cedears');
    });

    it('resets subcategory if category changes to one that does not include the selected subcategory', () => {
      render(
        <TransactionsList
          transactions={sampleTransactions}
          totalCount={sampleTransactions.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const categorySelect = screen.getByLabelText(/filtrar por categoría/i) as HTMLSelectElement;
      let subCategorySelect = screen.getByLabelText(/filtrar por subcategoría/i) as HTMLSelectElement;

      // Filter by Habitacionales
      fireEvent.change(categorySelect, { target: { value: 'Habitacionales' } });
      subCategorySelect = screen.getByLabelText(/filtrar por subcategoría/i) as HTMLSelectElement;

      // Select subcategory "Alquiler"
      fireEvent.change(subCategorySelect, { target: { value: 'Alquiler' } });
      expect(subCategorySelect.value).toBe('Alquiler');

      // Change category to "Comunes"
      fireEvent.change(categorySelect, { target: { value: 'Comunes' } });
      subCategorySelect = screen.getByLabelText(/filtrar por subcategoría/i) as HTMLSelectElement;

      // Subcategory must be reset to "" because Alquiler is not in Comunes
      expect(subCategorySelect.value).toBe('');
      const subOptions = Array.from(subCategorySelect.options).map((o) => o.value);
      expect(subOptions).toContain('Supermercado');
      expect(subOptions).toContain('Farmacia');
      expect(subOptions).not.toContain('Alquiler');
    });

    it('filters categories based on selected Tipo', () => {
      render(
        <TransactionsList
          transactions={sampleTransactions}
          totalCount={sampleTransactions.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const tipoSelect = screen.getByLabelText(/filtrar por tipo/i) as HTMLSelectElement;
      const categorySelect = screen.getByLabelText(/filtrar por categoría/i) as HTMLSelectElement;

      // Select "Ingreso"
      fireEvent.change(tipoSelect, { target: { value: 'Ingreso' } });

      const catOptions = Array.from(categorySelect.options).map((o) => o.value);
      expect(catOptions).toContain('Sueldo');
      expect(catOptions).not.toContain('Habitacionales');
      expect(catOptions).not.toContain('Comunes');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Date Range Filter & Presets
  // ---------------------------------------------------------------------------
  describe('Date Range Filter & Presets', () => {
    it('provides date presets: Este mes, Mes pasado, Este año, and Personalizado', () => {
      render(
        <TransactionsList
          transactions={sampleTransactions}
          totalCount={sampleTransactions.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const fechaSelect = screen.getByLabelText(/filtrar por fecha/i) as HTMLSelectElement;
      const options = Array.from(fechaSelect.options).map((o) => o.value);

      expect(options).toContain('');
      expect(options).toContain('current_month');
      expect(options).toContain('last_month');
      expect(options).toContain('current_year');
      expect(options).toContain('custom');

      // Personalizado (custom) must be positioned right after "Este año" (current_year)
      const currentYearIndex = options.indexOf('current_year');
      const customIndex = options.indexOf('custom');
      expect(customIndex).toBe(currentYearIndex + 1);
    });

    it('renders clean labels for categories and subcategories without folder or arrow emojis', () => {
      render(
        <TransactionsList
          transactions={sampleTransactions}
          totalCount={sampleTransactions.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const categorySelect = screen.getByLabelText(/filtrar por categoría/i) as HTMLSelectElement;
      const subCategorySelect = screen.getByLabelText(/filtrar por subcategoría/i) as HTMLSelectElement;

      const categoryLabels = Array.from(categorySelect.options).map((o) => o.text);
      const subCategoryLabels = Array.from(subCategorySelect.options).map((o) => o.text);

      categoryLabels.forEach((label) => {
        expect(label).not.toContain('📁');
      });
      subCategoryLabels.forEach((label) => {
        expect(label).not.toContain('↳');
      });
    });

    it('reveals Desde and Hasta date inputs when "custom" is selected', () => {
      render(
        <TransactionsList
          transactions={sampleTransactions}
          totalCount={sampleTransactions.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const fechaSelect = screen.getByLabelText(/filtrar por fecha/i) as HTMLSelectElement;

      // Inputs should not be visible before selecting custom
      expect(screen.queryByLabelText(/fecha desde/i)).toBeNull();
      expect(screen.queryByLabelText(/fecha hasta/i)).toBeNull();

      // Select "custom"
      fireEvent.change(fechaSelect, { target: { value: 'custom' } });

      // Inputs should now be in the document
      const desdeInput = screen.getByLabelText(/fecha desde/i) as HTMLInputElement;
      const hastaInput = screen.getByLabelText(/fecha hasta/i) as HTMLInputElement;
      expect(desdeInput).toBeDefined();
      expect(hastaInput).toBeDefined();
    });

    it('filters rows correctly using custom date range inputs', () => {
      render(
        <TransactionsList
          transactions={sampleTransactions}
          totalCount={sampleTransactions.length}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const fechaSelect = screen.getByLabelText(/filtrar por fecha/i) as HTMLSelectElement;
      fireEvent.change(fechaSelect, { target: { value: 'custom' } });

      const desdeInput = screen.getByLabelText(/fecha desde/i) as HTMLInputElement;
      const hastaInput = screen.getByLabelText(/fecha hasta/i) as HTMLInputElement;

      // Filter between 01/08/2026 and 31/08/2026 (August 2026 transactions: tx-3, tx-4, tx-5)
      fireEvent.change(desdeInput, { target: { value: '2026-08-01' } });
      fireEvent.change(hastaInput, { target: { value: '2026-08-31' } });

      // August transactions should be visible
      expect(screen.getByText('Compras super')).toBeDefined();
      expect(screen.getByText('Medicamentos')).toBeDefined();
      expect(screen.getByText('Sueldo mensual')).toBeDefined();

      // September and 2025 transactions should NOT be visible
      expect(screen.queryByText('Alquiler mensual')).toBeNull();
      expect(screen.queryByText('Expensas edificio')).toBeNull();
      expect(screen.queryByText('Compra Apple')).toBeNull();
    });
  });
});

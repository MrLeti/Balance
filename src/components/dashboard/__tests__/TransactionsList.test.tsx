import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionsList from '../TransactionsList';

describe('TransactionsList Integration (Tier 1-4: Movimientos View)', () => {
  const mockSetSearchTerm = vi.fn();
  const mockSetTxLimit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnEdit = vi.fn();

  const sampleRawTransactions = [
    ['tx-1', '01/09/2026', 'Ingreso', 'Sueldo', 'Principal', 250000, 'Cobro nómina', '', ''],
    ['tx-2', '02/09/2026', 'Egreso', 'Alimentación', 'Supermercado', 18500, 'Compra semanal', '', ''],
    ['tx-3', '03/09/2026', 'Egreso', 'Servicios', 'Internet', 9200, 'Factura fibra óptica', '', ''],
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnEdit.mockResolvedValue(undefined);
  });

  it('renders section title "Historial de Movimientos"', () => {
    render(
      <TransactionsList
        transactions={sampleRawTransactions}
        totalCount={3}
        searchTerm=""
        setSearchTerm={mockSetSearchTerm}
        txLimit={20}
        setTxLimit={mockSetTxLimit}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText(/historial de movimientos/i)).toBeDefined();
  });

  it('correctly maps raw transaction tuples to rendered table cells', () => {
    render(
      <TransactionsList
        transactions={sampleRawTransactions}
        totalCount={3}
        searchTerm=""
        setSearchTerm={mockSetSearchTerm}
        txLimit={20}
        setTxLimit={mockSetTxLimit}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    const table = screen.getByRole('table');
    const withinTable = within(table);

    // Verify row 1
    expect(withinTable.getByText('01/09/2026')).toBeDefined();
    expect(withinTable.getByText('Sueldo')).toBeDefined();
    expect(withinTable.getByText('Principal')).toBeDefined();
    expect(withinTable.getByText('Cobro nómina')).toBeDefined();

    // Verify row 2
    expect(withinTable.getByText('02/09/2026')).toBeDefined();
    expect(withinTable.getByText('Alimentación')).toBeDefined();
    expect(withinTable.getByText('Supermercado')).toBeDefined();
    expect(withinTable.getByText('Compra semanal')).toBeDefined();
  });

  it('formats amounts with correct signs (+ for Ingreso, - for Egreso)', () => {
    render(
      <TransactionsList
        transactions={sampleRawTransactions}
        totalCount={3}
        searchTerm=""
        setSearchTerm={mockSetSearchTerm}
        txLimit={20}
        setTxLimit={mockSetTxLimit}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    // Ingreso should render with + prefix (e.g. +$250.000 or similar currency format)
    const ingresoAmount = screen.getByText(/\+.*250/);
    expect(ingresoAmount).toBeDefined();

    // Egreso should render with - prefix
    const egresoAmount = screen.getByText(/-.*18/);
    expect(egresoAmount).toBeDefined();
  });

  it('renders "Ver Todos los Movimientos 👇" button when totalCount > txLimit and calls setTxLimit', () => {
    render(
      <TransactionsList
        transactions={sampleRawTransactions}
        totalCount={50}
        searchTerm=""
        setSearchTerm={mockSetSearchTerm}
        txLimit={20}
        setTxLimit={mockSetTxLimit}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    const loadMoreBtn = screen.getByRole('button', { name: /ver todos los movimientos/i });
    expect(loadMoreBtn).toBeDefined();

    fireEvent.click(loadMoreBtn);
    expect(mockSetTxLimit).toHaveBeenCalledWith(50);
  });

  it('does not render "Ver Todos los Movimientos" button when totalCount <= txLimit', () => {
    render(
      <TransactionsList
        transactions={sampleRawTransactions}
        totalCount={3}
        searchTerm=""
        setSearchTerm={mockSetSearchTerm}
        txLimit={20}
        setTxLimit={mockSetTxLimit}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.queryByRole('button', { name: /ver todos los movimientos/i })).toBeNull();
  });

  it('passes the original raw transaction array to onDelete callback when delete (×) is clicked', () => {
    render(
      <TransactionsList
        transactions={sampleRawTransactions}
        totalCount={3}
        searchTerm=""
        setSearchTerm={mockSetSearchTerm}
        txLimit={20}
        setTxLimit={mockSetTxLimit}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: '×' });
    expect(deleteButtons.length).toBe(3);

    // Because defaultSortKey="date" and defaultSortDir="desc", row 0 is tx-3 (03/09/2026)
    fireEvent.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(sampleRawTransactions[2]);
  });

  it('allows in-situ editing and propagates changes to onEdit callback', async () => {
    render(
      <TransactionsList
        transactions={sampleRawTransactions}
        totalCount={3}
        searchTerm=""
        setSearchTerm={mockSetSearchTerm}
        txLimit={20}
        setTxLimit={mockSetTxLimit}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    const commentCell = screen.getByText('Compra semanal');
    fireEvent.click(commentCell);

    const input = screen.getByDisplayValue('Compra semanal');
    fireEvent.change(input, { target: { value: 'Compra supermercado Carrefour' } });

    // Save
    let saveBtn = screen.queryByRole('button', { name: /✓/i });
    if (!saveBtn) {
      fireEvent.keyDown(input, { key: 'Enter' });
      saveBtn = screen.getByRole('button', { name: /✓/i });
    }
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockOnEdit).toHaveBeenCalledWith('tx-2', 'comment', 'Compra supermercado Carrefour');
    });
  });

  it('displays empty state message when transactions array is empty', () => {
    render(
      <TransactionsList
        transactions={[]}
        totalCount={0}
        searchTerm=""
        setSearchTerm={mockSetSearchTerm}
        txLimit={20}
        setTxLimit={mockSetTxLimit}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText(/no hay movimientos registrados aún/i)).toBeDefined();
  });
});

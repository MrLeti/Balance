import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChartData, ChartOptions, ScriptableContext, TooltipItem } from 'chart.js';
import DashboardIncomeExpenseChart from '../DashboardIncomeExpenseChart';

interface LineProps {
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
}

let capturedLineProps: LineProps | null = null;

vi.mock('react-chartjs-2', () => ({
  Line: (props: LineProps) => {
    capturedLineProps = props;
    return <div data-testid="mock-line-chart" />;
  },
}));

function createMockCanvasContext() {
  const colorStops: { offset: number; color: string }[] = [];
  const mockGradient = {
    addColorStop: vi.fn((offset: number, color: string) => {
      colorStops.push({ offset, color });
    }),
    _colorStops: colorStops,
  };
  const ctx = {
    createLinearGradient: vi.fn(() => mockGradient),
  } as unknown as CanvasRenderingContext2D;

  return { ctx, mockGradient, colorStops };
}

function parseAlphaFromRgba(colorStr: string): number {
  const match = colorStr.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  return match ? parseFloat(match[1]) : NaN;
}

describe('DashboardIncomeExpenseChartEmpiricalChallenger (Adversarial Stress Test Suite)', () => {
  beforeEach(() => {
    capturedLineProps = null;
    vi.clearAllMocks();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  describe('1. Empty Datasets & Edge Case Robustness', () => {
    it('renders empty state when data is empty array []', () => {
      render(<DashboardIncomeExpenseChart data={[]} balanceMonth="09/2026" />);

      expect(screen.getByTestId('dashboard-chart-empty')).toBeDefined();
      expect(screen.getByText(/no hay movimientos en este período/i)).toBeDefined();
      expect(capturedLineProps).toBeNull();
    });

    it('renders empty state when data is undefined (default prop)', () => {
      render(<DashboardIncomeExpenseChart balanceMonth="09/2026" />);

      expect(screen.getByTestId('dashboard-chart-empty')).toBeDefined();
      expect(capturedLineProps).toBeNull();
    });

    it('renders empty state when filteredData is explicitly passed as empty array []', () => {
      const data = [['tx-1', '01/09/2026', 'Ingreso', 'Cat', '', 50000, '', '']];
      render(
        <DashboardIncomeExpenseChart
          data={data}
          filteredData={[]}
          balanceMonth="09/2026"
        />
      );

      expect(screen.getByTestId('dashboard-chart-empty')).toBeDefined();
      expect(capturedLineProps).toBeNull();
    });

    it('renders empty state when dataset contains only unsupported non-financial types (e.g. Transferencia)', () => {
      const unsupportedOnly = [
        ['tx-1', '01/09/2026', 'Transferencia', 'Entre cuentas', '', 100000, '', ''],
        ['tx-2', '05/09/2026', 'Desconocido', 'Otro', '', 200000, '', ''],
        ['tx-3', '10/09/2026', 'Ajuste', 'Balance', '', 50000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={unsupportedOnly} balanceMonth="09/2026" />);

      expect(screen.getByTestId('dashboard-chart-empty')).toBeDefined();
      expect(capturedLineProps).toBeNull();
    });

    it('renders distribution chart when dataset contains Ahorro and Inversión types', () => {
      const savingsOnly = [
        ['tx-1', '01/09/2026', 'Ahorro', 'Fondo de Emergencia', '', 100000, '', ''],
        ['tx-2', '05/09/2026', 'Inversión', 'CEDEARs', '', 200000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={savingsOnly} balanceMonth="09/2026" />);

      expect(screen.getByTestId('dashboard-income-expense-chart')).toBeDefined();
      expect(capturedLineProps).not.toBeNull();
      const ahorro = capturedLineProps!.data.datasets.find((d) => d.label === 'Ahorro');
      const inversion = capturedLineProps!.data.datasets.find((d) => d.label === 'Inversión');
      expect(ahorro?.data).toEqual([100000, 0]);
      expect(inversion?.data).toEqual([0, 200000]);
    });

    it('renders empty state when transactions have zero amount or invalid amounts', () => {
      const zeroTransactions = [
        ['tx-1', '01/09/2026', 'Ingreso', 'Regalo', '', 0, '', ''],
        ['tx-2', '05/09/2026', 'Egreso', 'Gastos', '', '$ 0', '', ''],
        ['tx-3', '10/09/2026', 'Ingreso', 'Bonus', '', 'abc', '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={zeroTransactions} balanceMonth="09/2026" />);

      expect(screen.getByTestId('dashboard-chart-empty')).toBeDefined();
      expect(capturedLineProps).toBeNull();
    });

    it('handles malformed rows (nulls, truncated arrays, corrupted dates) without throwing', () => {
      const malformedData: unknown[] = [
        null,
        undefined,
        [],
        ['tx-short', '01/09/2026'],
        ['tx-bad-date', 'not-a-date', 'Ingreso', '', '', 50000],
        ['tx-bad-month', '15/13/2026', 'Ingreso', '', '', 50000], // month 13
        ['tx-bad-format', '2026-09-01', 'Ingreso', '', '', 50000], // YYYY-MM-DD not matching DD/MM/YYYY
        ['tx-valid', '05/09/2026', 'Ingreso', 'Sueldo', '', 150000, '', ''],
      ];

      expect(() => {
        render(<DashboardIncomeExpenseChart data={malformedData} balanceMonth="09/2026" />);
      }).not.toThrow();

      expect(screen.getByTestId('dashboard-income-expense-chart')).toBeDefined();
      expect(capturedLineProps).not.toBeNull();
      expect(capturedLineProps!.data.labels).toEqual(['05/09']);
    });
  });

  describe('2. All Income & All Expenses Scenarios', () => {
    it('aggregates correctly when period contains ONLY income (Egresos line must be all zeros)', () => {
      const incomeOnly = [
        ['tx-1', '02/09/2026', 'Ingreso', 'Sueldo', '', 250000, '', ''],
        ['tx-2', '15/09/2026', 'Ingreso', 'Freelance', '', 75000, '', ''],
        ['tx-3', '28/09/2026', 'Ingreso', 'Dividendos', '', 30000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={incomeOnly} balanceMonth="09/2026" />);

      expect(capturedLineProps).not.toBeNull();
      const { data } = capturedLineProps!;

      expect(data.labels).toEqual(['02/09', '15/09', '28/09']);

      const ingresos = data.datasets.find((d) => d.label === 'Ingresos');
      const egresos = data.datasets.find((d) => d.label === 'Egresos');

      expect(ingresos?.data).toEqual([250000, 75000, 30000]);
      expect(egresos?.data).toEqual([0, 0, 0]);
    });

    it('aggregates correctly when period contains ONLY expenses (Ingresos line must be all zeros)', () => {
      const expensesOnly = [
        ['tx-1', '03/09/2026', 'Egreso', 'Alquiler', '', 120000, '', ''],
        ['tx-2', '10/09/2026', 'Egreso', 'Supermercado', '', 45000, '', ''],
        ['tx-3', '22/09/2026', 'Egreso', 'Servicios', '', 18000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={expensesOnly} balanceMonth="09/2026" />);

      expect(capturedLineProps).not.toBeNull();
      const { data } = capturedLineProps!;

      expect(data.labels).toEqual(['03/09', '10/09', '22/09']);

      const ingresos = data.datasets.find((d) => d.label === 'Ingresos');
      const egresos = data.datasets.find((d) => d.label === 'Egresos');

      expect(ingresos?.data).toEqual([0, 0, 0]);
      expect(egresos?.data).toEqual([120000, 45000, 18000]);
    });

    it('computes net cashflow difference correctly in tooltip afterBody for both surplus and deficit', () => {
      const mixed = [
        ['tx-1', '05/09/2026', 'Ingreso', 'Sueldo', '', 100000, '', ''],
        ['tx-2', '05/09/2026', 'Egreso', 'Gastos', '', 40000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={mixed} balanceMonth="09/2026" />);

      const afterBodyFn = capturedLineProps?.options?.plugins?.tooltip?.callbacks?.afterBody;
      expect(afterBodyFn).toBeDefined();

      // Case 1: Surplus (+60,000)
      const mockItemsSurplus = [
        { dataset: { label: 'Ingresos' }, parsed: { y: 100000 } },
        { dataset: { label: 'Egresos' }, parsed: { y: 40000 } },
      ] as unknown as TooltipItem<'line'>[];

      const surplusText = afterBodyFn!(mockItemsSurplus);
      expect(surplusText).toContain('Neto: +$');
      expect(surplusText).toContain('60.000');

      // Case 2: Deficit (-30,000)
      const mockItemsDeficit = [
        { dataset: { label: 'Ingresos' }, parsed: { y: 20000 } },
        { dataset: { label: 'Egresos' }, parsed: { y: 50000 } },
      ] as unknown as TooltipItem<'line'>[];

      const deficitText = afterBodyFn!(mockItemsDeficit);
      expect(deficitText).toContain('Neto: -$');
      expect(deficitText).toContain('30.000');
    });
  });

  describe('3. Same-Day Multiple Transactions & Sorting', () => {
    it('consolidates multiple income and expense transactions occurring on the identical day into a single data point', () => {
      const sameDayData = [
        ['tx-1', '15/09/2026', 'Ingreso', 'Sueldo', '', 200000, '', ''],
        ['tx-2', '15/09/2026', 'Ingreso', 'Honorarios', '', 50000, '', ''],
        ['tx-3', '15/09/2026', 'Egreso', 'Supermercado', '', 35000, '', ''],
        ['tx-4', '15/09/2026', 'Egreso', 'Farmacia', '', 15000, '', ''],
        ['tx-5', '15/09/2026', 'Egreso', 'Combustible', '', 20000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={sameDayData} balanceMonth="09/2026" />);

      expect(capturedLineProps).not.toBeNull();
      const { data } = capturedLineProps!;

      expect(data.labels).toHaveLength(1);
      expect(data.labels).toEqual(['15/09']);

      const ingresos = data.datasets.find((d) => d.label === 'Ingresos');
      const egresos = data.datasets.find((d) => d.label === 'Egresos');

      expect(ingresos?.data).toEqual([250000]); // 200000 + 50000
      expect(egresos?.data).toEqual([70000]);   // 35000 + 15000 + 20000
    });

    it('correctly sorts chronological points when input rows are shuffled out of order', () => {
      const unsortedData = [
        ['tx-1', '28/09/2026', 'Ingreso', 'Venta', '', 30000, '', ''],
        ['tx-2', '02/09/2026', 'Egreso', 'Café', '', 5000, '', ''],
        ['tx-3', '14/09/2026', 'Ingreso', 'Sueldo', '', 150000, '', ''],
        ['tx-4', '07/09/2026', 'Egreso', 'Super', '', 40000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={unsortedData} balanceMonth="09/2026" />);

      expect(capturedLineProps).not.toBeNull();
      const { data } = capturedLineProps!;

      expect(data.labels).toEqual(['02/09', '07/09', '14/09', '28/09']);

      const ingresos = data.datasets.find((d) => d.label === 'Ingresos');
      const egresos = data.datasets.find((d) => d.label === 'Egresos');

      expect(ingresos?.data).toEqual([0, 0, 150000, 30000]);
      expect(egresos?.data).toEqual([5000, 40000, 0, 0]);
    });
  });

  describe('4. Leap Year & Calendar Boundary Handling', () => {
    it('correctly aggregates leap year day 29/02/2024 and sorts after 28/02/2024', () => {
      const leapYearData = [
        ['tx-1', '29/02/2024', 'Ingreso', 'Freelance', '', 80000, '', ''],
        ['tx-2', '28/02/2024', 'Egreso', 'Cena', '', 25000, '', ''],
        ['tx-3', '01/02/2024', 'Ingreso', 'Sueldo', '', 300000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={leapYearData} balanceMonth="02/2024" />);

      expect(capturedLineProps).not.toBeNull();
      const { data } = capturedLineProps!;

      expect(data.labels).toEqual(['01/02', '28/02', '29/02']);

      const ingresos = data.datasets.find((d) => d.label === 'Ingresos');
      const egresos = data.datasets.find((d) => d.label === 'Egresos');

      expect(ingresos?.data).toEqual([300000, 0, 80000]);
      expect(egresos?.data).toEqual([0, 25000, 0]);
    });

    it('aggregates leap year February data into "Feb 24" when viewing full year 2024', () => {
      const leapYearAnnual = [
        ['tx-1', '15/01/2024', 'Ingreso', 'Sueldo', '', 200000, '', ''],
        ['tx-2', '29/02/2024', 'Egreso', 'Gastos Bisiesto', '', 50000, '', ''],
        ['tx-3', '10/03/2024', 'Ingreso', 'Honorarios', '', 80000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={leapYearAnnual} balanceMonth="2024" />);

      expect(capturedLineProps).not.toBeNull();
      const { data } = capturedLineProps!;

      expect(data.labels).toEqual(['Ene 24', 'Feb 24', 'Mar 24']);

      const egresos = data.datasets.find((d) => d.label === 'Egresos');
      expect(egresos?.data).toEqual([0, 50000, 0]);
    });

    it('orders multi-year boundaries correctly in "Total" view across Dec 2025 and Jan 2026', () => {
      const yearCrossingData = [
        ['tx-1', '15/01/2026', 'Ingreso', 'Sueldo', '', 150000, '', ''],
        ['tx-2', '20/12/2025', 'Ingreso', 'Aguinaldo', '', 100000, '', ''],
        ['tx-3', '05/11/2025', 'Egreso', 'Compras', '', 30000, '', ''],
      ];

      render(<DashboardIncomeExpenseChart data={yearCrossingData} balanceMonth="Total" />);

      expect(capturedLineProps).not.toBeNull();
      const { data } = capturedLineProps!;

      expect(data.labels).toEqual(['Nov 25', 'Dic 25', 'Ene 26']);
    });
  });

  describe('5. Period Switching & Dynamic Reactivity', () => {
    it('seamlessly transitions from daily view to yearly view to Total view on rerender', () => {
      const testData = [
        ['tx-1', '05/01/2025', 'Ingreso', 'Sueldo', '', 100000, '', ''],
        ['tx-2', '20/01/2025', 'Egreso', 'Gastos', '', 40000, '', ''],
        ['tx-3', '10/02/2025', 'Ingreso', 'Sueldo', '', 110000, '', ''],
        ['tx-4', '15/09/2026', 'Ingreso', 'Sueldo', '', 120000, '', ''],
      ];

      const { rerender } = render(
        <DashboardIncomeExpenseChart data={testData} balanceMonth="01/2025" />
      );

      // Daily view for 01/2025
      expect(capturedLineProps!.data.labels).toEqual(['05/01', '20/01']);

      // Switch to year 2025
      rerender(<DashboardIncomeExpenseChart data={testData} balanceMonth="2025" />);
      expect(capturedLineProps!.data.labels).toEqual(['Ene 25', 'Feb 25']);

      // Switch to Total
      rerender(<DashboardIncomeExpenseChart data={testData} balanceMonth="Total" />);
      expect(capturedLineProps!.data.labels).toEqual(['Ene 25', 'Feb 25', 'Sep 26']);
    });

    it('transitions gracefully between line chart and empty state when switching to an empty month and back', () => {
      const testData = [
        ['tx-1', '05/09/2026', 'Ingreso', 'Sueldo', '', 100000, '', ''],
      ];

      const { rerender } = render(
        <DashboardIncomeExpenseChart data={testData} balanceMonth="09/2026" />
      );

      expect(screen.getByTestId('dashboard-income-expense-chart')).toBeDefined();
      expect(screen.queryByTestId('dashboard-chart-empty')).toBeNull();

      // Switch to empty month
      rerender(<DashboardIncomeExpenseChart data={testData} balanceMonth="10/2026" />);
      expect(screen.getByTestId('dashboard-chart-empty')).toBeDefined();
      expect(screen.queryByTestId('dashboard-income-expense-chart')).toBeNull();

      // Switch back to populated month
      rerender(<DashboardIncomeExpenseChart data={testData} balanceMonth="09/2026" />);
      expect(screen.getByTestId('dashboard-income-expense-chart')).toBeDefined();
      expect(screen.queryByTestId('dashboard-chart-empty')).toBeNull();
    });
  });

  describe('6. Visual Specifications, Responsive Resize & Scriptable Gradients', () => {
    const standardData = [
      ['tx-1', '01/09/2026', 'Ingreso', 'Sueldo', '', 100000, '', ''],
      ['tx-2', '02/09/2026', 'Egreso', 'Gastos', '', 50000, '', ''],
    ];

    it('verifies responsive and resize handling options', () => {
      render(<DashboardIncomeExpenseChart data={standardData} balanceMonth="09/2026" />);

      const options = capturedLineProps?.options;
      expect(options).toBeDefined();
      expect(options?.responsive).toBe(true);
      expect(options?.maintainAspectRatio).toBe(false);
      expect(options?.interaction?.mode).toBe('index');
      expect(options?.interaction?.intersect).toBe(false);
    });

    it('verifies dataset visual styles for all 4 global types: green #22c55e, red #ef4444, blue #3b82f6, purple #8b5cf6 with tension 0.35', () => {
      render(<DashboardIncomeExpenseChart data={standardData} balanceMonth="09/2026" />);

      const ingresos = capturedLineProps!.data.datasets.find((d) => d.label === 'Ingresos');
      const egresos = capturedLineProps!.data.datasets.find((d) => d.label === 'Egresos');
      const ahorro = capturedLineProps!.data.datasets.find((d) => d.label === 'Ahorro');
      const inversion = capturedLineProps!.data.datasets.find((d) => d.label === 'Inversión');

      expect(ingresos?.borderColor).toBe('#22c55e');
      expect(ingresos?.pointBackgroundColor).toBe('#22c55e');
      expect(ingresos?.borderWidth).toBe(2.5);
      expect(ingresos?.tension).toBe(0.35);
      expect(ingresos?.fill).toBe(true);

      expect(egresos?.borderColor).toBe('#ef4444');
      expect(egresos?.pointBackgroundColor).toBe('#ef4444');
      expect(egresos?.borderWidth).toBe(2.5);
      expect(egresos?.tension).toBe(0.35);
      expect(egresos?.fill).toBe(true);

      expect(ahorro?.borderColor).toBe('#3b82f6');
      expect(ahorro?.pointBackgroundColor).toBe('#3b82f6');
      expect(ahorro?.borderWidth).toBe(2.5);
      expect(ahorro?.tension).toBe(0.35);
      expect(ahorro?.fill).toBe(true);

      expect(inversion?.borderColor).toBe('#8b5cf6');
      expect(inversion?.pointBackgroundColor).toBe('#8b5cf6');
      expect(inversion?.borderWidth).toBe(2.5);
      expect(inversion?.tension).toBe(0.35);
      expect(inversion?.fill).toBe(true);
    });

    it('handles scriptable gradient generation safely when chartArea is missing or collapsed', () => {
      render(<DashboardIncomeExpenseChart data={standardData} balanceMonth="09/2026" />);

      const ingresos = capturedLineProps!.data.datasets.find((d) => d.label === 'Ingresos');
      const bgFn = ingresos?.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient | undefined;

      const { ctx } = createMockCanvasContext();

      // Missing chartArea
      const missingAreaCtx = { chart: { ctx, chartArea: null as unknown as { top: number; bottom: number } } } as unknown as ScriptableContext<'line'>;
      expect(() => bgFn(missingAreaCtx)).not.toThrow();
      expect(bgFn(missingAreaCtx)).toBeUndefined();

      // Collapsed chartArea (bottom <= top)
      const collapsedAreaCtx = { chart: { ctx, chartArea: { top: 100, bottom: 50 } } } as unknown as ScriptableContext<'line'>;
      expect(() => bgFn(collapsedAreaCtx)).not.toThrow();
      expect(bgFn(collapsedAreaCtx)).toBeUndefined();
    });

    it('adapts theme automatically via MutationObserver when isDark prop is undefined', async () => {
      const { unmount } = render(<DashboardIncomeExpenseChart data={standardData} balanceMonth="09/2026" />);

      // Initial state is light (no data-theme)
      const ingresos = capturedLineProps!.data.datasets.find((d) => d.label === 'Ingresos');
      const bgFn = ingresos?.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;

      const { ctx: lightCtx, colorStops: lightStops } = createMockCanvasContext();
      bgFn({ chart: { ctx: lightCtx, chartArea: { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 } } } as unknown as ScriptableContext<'line'>);

      // Light mode stop 0 alpha should be close to 0.35 * 0.7 = 0.245
      const lightAlpha = parseAlphaFromRgba(lightStops[0].color);
      expect(lightAlpha).toBeCloseTo(0.245, 3);

      // Now trigger mutation observer by setting data-theme="dark"
      await act(async () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        await new Promise((r) => setTimeout(r, 20));
      });

      // Now evaluate gradient in dark mode
      const { ctx: darkCtx, colorStops: darkStops } = createMockCanvasContext();
      const updatedIngresos = capturedLineProps!.data.datasets.find((d) => d.label === 'Ingresos');
      const updatedBgFn = updatedIngresos?.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
      updatedBgFn({ chart: { ctx: darkCtx, chartArea: { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 } } } as unknown as ScriptableContext<'line'>);

      const darkAlpha = parseAlphaFromRgba(darkStops[0].color);
      expect(darkAlpha).toBeCloseTo(0.35, 3);

      unmount();
    });

    it('formats y-axis tick labels using fmtCompact (e.g. $1.0M, $50.0K, $0)', () => {
      render(<DashboardIncomeExpenseChart data={standardData} balanceMonth="09/2026" />);

      const yTickCallback = capturedLineProps?.options?.scales?.y?.ticks?.callback;
      expect(yTickCallback).toBeDefined();

      if (typeof yTickCallback === 'function') {
        const dummyContext = {} as unknown as Record<string, unknown>;
        const formatted1M = yTickCallback.call(dummyContext, 1000000, 0, []);
        expect(formatted1M).toBe('$1.0M');

        const formatted50K = yTickCallback.call(dummyContext, 50000, 0, []);
        expect(formatted50K).toBe('$50.0K');

        const formattedZero = yTickCallback.call(dummyContext, 0, 0, []);
        expect(formattedZero).toMatch(/\$\s*0/);
      }
    });
  });
});

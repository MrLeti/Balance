import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChartData, ChartDataset, ChartOptions, ScriptableContext } from 'chart.js';
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

describe('DashboardIncomeExpenseChart (Milestone 2: Chart Gradient Engine & Dashboard View)', () => {
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

  const sampleTransactions = [
    ['tx-1', '01/09/2026', 'Ingreso', 'Sueldo', 'Principal', 300000, '', ''],
    ['tx-2', '05/09/2026', 'Egreso', 'Alimentación', 'Supermercado', 45000, '', ''],
    ['tx-3', '12/09/2026', 'Egreso', 'Servicios', 'Luz', 15000, '', ''],
    ['tx-4', '12/09/2026', 'Ingreso', 'Extras', 'Freelance', 50000, '', ''],
    ['tx-5', '20/09/2026', 'Egreso', 'Ocio', 'Salida', 20000, '', ''],
  ];

  it('renders empty state when transaction array is empty', () => {
    render(<DashboardIncomeExpenseChart data={[]} balanceMonth="09/2026" />);

    expect(screen.getByTestId('dashboard-chart-empty')).toBeDefined();
    expect(screen.getByText(/no hay movimientos en este período/i)).toBeDefined();
    expect(capturedLineProps).toBeNull();
  });

  it('renders empty state when no transactions match the selected month', () => {
    render(<DashboardIncomeExpenseChart data={sampleTransactions} balanceMonth="10/2026" />);

    expect(screen.getByTestId('dashboard-chart-empty')).toBeDefined();
    expect(capturedLineProps).toBeNull();
  });

  it('renders line chart with daily grouping for a specific month (e.g. 09/2026)', () => {
    render(
      <DashboardIncomeExpenseChart
        data={sampleTransactions}
        balanceMonth="09/2026"
        isDark={false}
      />
    );

    expect(screen.getByTestId('dashboard-income-expense-chart')).toBeDefined();
    expect(screen.getByTestId('mock-line-chart')).toBeDefined();
    expect(capturedLineProps).not.toBeNull();

    const { data: chartData } = capturedLineProps!;

    // Chronological days: 01/09, 05/09, 12/09, 20/09
    expect(chartData.labels).toEqual(['01/09', '05/09', '12/09', '20/09']);

    // Datasets
    expect(chartData.datasets).toHaveLength(4);

    const ingresosDataset = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Ingresos');
    const egresosDataset = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Egresos');
    const ahorroDataset = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Ahorro');
    const inversionDataset = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Inversión');

    expect(ingresosDataset).toBeDefined();
    expect(egresosDataset).toBeDefined();
    expect(ahorroDataset).toBeDefined();
    expect(inversionDataset).toBeDefined();

    // Line colors & specs
    expect(ingresosDataset?.borderColor).toBe('#22c55e');
    expect(ingresosDataset?.fill).toBe(true);
    expect(ingresosDataset?.tension).toBe(0.35);
    expect(ingresosDataset?.pointRadius).toBe(3);
    expect(ingresosDataset?.borderWidth).toBe(2.5);

    expect(egresosDataset?.borderColor).toBe('#ef4444');
    expect(egresosDataset?.fill).toBe(true);
    expect(egresosDataset?.tension).toBe(0.35);
    expect(egresosDataset?.pointRadius).toBe(3);
    expect(egresosDataset?.borderWidth).toBe(2.5);

    expect(ahorroDataset?.borderColor).toBe('#3b82f6');
    expect(ahorroDataset?.fill).toBe(true);
    expect(ahorroDataset?.tension).toBe(0.35);

    expect(inversionDataset?.borderColor).toBe('#8b5cf6');
    expect(inversionDataset?.fill).toBe(true);
    expect(inversionDataset?.tension).toBe(0.35);

    // Amounts verification:
    // 01/09: Ingreso 300000, Egreso 0, Ahorro 0, Inversion 0
    // 05/09: Ingreso 0, Egreso 45000, Ahorro 0, Inversion 0
    // 12/09: Ingreso 50000, Egreso 15000, Ahorro 0, Inversion 0
    // 20/09: Ingreso 0, Egreso 20000, Ahorro 0, Inversion 0
    expect(ingresosDataset?.data).toEqual([300000, 0, 50000, 0]);
    expect(egresosDataset?.data).toEqual([0, 45000, 15000, 20000]);
    expect(ahorroDataset?.data).toEqual([0, 0, 0, 0]);
    expect(inversionDataset?.data).toEqual([0, 0, 0, 0]);
  });

  it('renders monthly grouping for full year (e.g. 2025) and Total', () => {
    const multiMonthTransactions = [
      ['tx-1', '10/01/2025', 'Ingreso', 'Sueldo', '', 100000, '', ''],
      ['tx-2', '20/01/2025', 'Egreso', 'Gastos', '', 40000, '', ''],
      ['tx-3', '15/02/2025', 'Ingreso', 'Sueldo', '', 100000, '', ''],
      ['tx-4', '18/02/2025', 'Egreso', 'Gastos', '', 60000, '', ''],
      ['tx-5', '05/05/2025', 'Egreso', 'Gastos', '', 25000, '', ''],
    ];

    render(
      <DashboardIncomeExpenseChart
        data={multiMonthTransactions}
        balanceMonth="2025"
        isDark={true}
      />
    );

    expect(capturedLineProps).not.toBeNull();
    const { data: chartData } = capturedLineProps!;

    // Chronological months in 2025: Ene 25, Feb 25, May 25
    expect(chartData.labels).toEqual(['Ene 25', 'Feb 25', 'May 25']);

    const ingresos = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Ingresos');
    const egresos = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Egresos');

    expect(ingresos?.data).toEqual([100000, 100000, 0]);
    expect(egresos?.data).toEqual([40000, 60000, 25000]);
  });

  it('provides scriptable backgroundColor that generates vertical canvas gradients', () => {
    render(
      <DashboardIncomeExpenseChart
        data={sampleTransactions}
        balanceMonth="09/2026"
        isDark={true}
      />
    );

    const { data: chartData } = capturedLineProps!;
    const ingresosDataset = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Ingresos');
    const egresosDataset = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Egresos');

    const mockGradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
    } as unknown as CanvasRenderingContext2D;
    const mockChartArea = { top: 20, bottom: 220, left: 0, right: 300, width: 300, height: 200 };

    const scriptableContext = {
      chart: {
        ctx: mockCtx,
        chartArea: mockChartArea,
      },
    } as unknown as ScriptableContext<'line'>;

    // Evaluate scriptable background color for Ingresos (green)
    const bgIngresosFn = ingresosDataset?.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
    const bgIngresos = bgIngresosFn(scriptableContext);
    expect(bgIngresos).toBe(mockGradient);
    expect(mockCtx.createLinearGradient).toHaveBeenCalledWith(0, 20, 0, 220);
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(0, expect.stringContaining('rgba(34, 197, 94'));

    // Evaluate scriptable background color for Egresos (red)
    const bgEgresosFn = egresosDataset?.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
    const bgEgresos = bgEgresosFn(scriptableContext);
    expect(bgEgresos).toBe(mockGradient);
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(0, expect.stringContaining('rgba(239, 68, 68'));
  });

  it('correctly populates all 4 global types (Ingreso, Egreso, Ahorro, Inversión) and filters unsupported types', () => {
    const mixedTransactions = [
      ['tx-1', '01/09/2026', 'Ingreso', 'Sueldo', '', 100000, '', ''],
      ['tx-2', '01/09/2026', 'Ahorro', 'Fondo de emergencia', '', 20000, '', ''],
      ['tx-3', '01/09/2026', 'Inversión', 'CEDEARs', '', 30000, '', ''],
      ['tx-4', '02/09/2026', 'Egreso', 'Super', '', 15000, '', ''],
      ['tx-5', '02/09/2026', 'Transferencia', 'Entre cuentas', '', 50000, '', ''],
    ];

    render(
      <DashboardIncomeExpenseChart
        data={mixedTransactions}
        balanceMonth="09/2026"
      />
    );

    const { data: chartData } = capturedLineProps!;
    const ingresos = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Ingresos');
    const egresos = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Egresos');
    const ahorro = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Ahorro');
    const inversion = chartData.datasets.find((d: ChartDataset<'line'>) => d.label === 'Inversión');

    expect(chartData.labels).toEqual(['01/09', '02/09']);
    expect(ingresos?.data).toEqual([100000, 0]);
    expect(egresos?.data).toEqual([0, 15000]);
    expect(ahorro?.data).toEqual([20000, 0]);
    expect(inversion?.data).toEqual([30000, 0]);
  });
});

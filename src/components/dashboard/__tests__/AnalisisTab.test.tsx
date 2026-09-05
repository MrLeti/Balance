import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChartData, ChartOptions, ScriptableContext } from 'chart.js';
import DashboardData from '../DashboardData';

interface LineProps {
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
}

interface PieProps {
  data: any;
  options?: any;
}

let capturedLineCharts: LineProps[] = [];
let capturedPieCharts: PieProps[] = [];

vi.mock('react-chartjs-2', () => ({
  Line: (props: LineProps) => {
    capturedLineCharts.push(props);
    return <div data-testid="mock-line-chart" data-labels={props.data?.labels?.join(',')} />;
  },
  Pie: (props: PieProps) => {
    capturedPieCharts.push(props);
    return (
      <div
        data-testid="mock-pie-chart"
        data-labels={props.data?.labels?.join(',')}
        onClick={(e) => {
          if (props.options?.onClick && props.data?.labels?.length > 0) {
            props.options.onClick(e, [{ index: 0 }]);
          }
        }}
      />
    );
  },
}));

vi.mock('../SankeyChart', () => ({
  default: ({ data, isDark }: { data?: any[]; isDark?: boolean }) => (
    <div
      data-testid="mock-sankey-chart"
      data-count={data?.length}
      data-dark={String(isDark)}
    >
      SankeyChart ({data?.length || 0} items)
    </div>
  ),
}));

describe('Análisis Tab View & Independent Period Management (Milestone 3)', () => {
  const originalFetch = global.fetch;

  const sampleTransactions = [
    // Agosto 2026
    ['tx-1', '05/08/2026', 'Ingreso', 'Salario', 'Blanco', 200000, '', ''],
    ['tx-2', '10/08/2026', 'Egreso', 'Comunes', 'Mercadería', 50000, '', ''],
    ['tx-3', '15/08/2026', 'Egreso', 'Habitacionales', 'Alquiler', 70000, '', ''],

    // Septiembre 2026
    ['tx-4', '01/09/2026', 'Ingreso', 'Salario', 'Blanco', 300000, '', ''],
    ['tx-5', '05/09/2026', 'Egreso', 'Comunes', 'Mercadería', 60000, '', ''],
    ['tx-6', '12/09/2026', 'Egreso', 'Habitacionales', 'Alquiler', 80000, '', ''],
    ['tx-7', '20/09/2026', 'Egreso', 'Ocio', 'Salida', 25000, '', ''],
  ];

  beforeEach(() => {
    capturedLineCharts = [];
    capturedPieCharts = [];
    window.history.replaceState(null, '', '/');

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

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: sampleTransactions }),
        });
      }
      if (url.includes('/api/categories')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url.includes('/api/cuotas')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('renders all 5 designated cards and the independent period header when switching to Análisis tab', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const analisisPanel = screen.getByRole('tabpanel');
    expect(analisisPanel.getAttribute('id')).toBe('tabpanel-analisis');

    // Header with independent period selector
    expect(screen.getByTestId('analysis-header')).toBeDefined();
    expect(screen.getByTestId('analysis-period-select')).toBeDefined();
    expect(screen.getByText(/análisis financiero/i)).toBeDefined();

    // 1. Desglose
    expect(screen.getByTestId('card-desglose')).toBeDefined();
    expect(screen.getByRole('heading', { name: /desglose/i })).toBeDefined();
    expect(screen.getByTestId('mock-pie-chart')).toBeDefined();

    // 2. Balance General
    expect(screen.getByTestId('card-balance-general')).toBeDefined();
    expect(screen.getByRole('heading', { name: /balance general/i })).toBeDefined();

    // 3. Flujo de Dinero (Sankey)
    expect(screen.getByTestId('card-flujo-dinero')).toBeDefined();
    expect(screen.getByRole('heading', { name: /flujo de dinero/i })).toBeDefined();
    expect(screen.getByTestId('mock-sankey-chart')).toBeDefined();

    // 4. Evolución en el Tiempo
    expect(screen.getByTestId('card-evolucion')).toBeDefined();
    expect(screen.getByRole('heading', { name: /evolución en el tiempo/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /comparativo g\/i/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /egresos\/cat/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /acumulado/i })).toBeDefined();

    // 5. Comparativa Personalizada
    expect(screen.getByTestId('card-comparativa')).toBeDefined();
    expect(screen.getByRole('heading', { name: /comparativa personalizada/i })).toBeDefined();
    expect(screen.getByLabelText(/primer ítem de comparación/i)).toBeDefined();
    expect(screen.getByLabelText(/segundo ítem de comparación/i)).toBeDefined();
  });

  it('filters data in the Análisis tab independently from the Dashboard tab', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /dashboard/i })).toBeDefined();
    });

    // In Dashboard: default latest month is 09/2026
    const dashboardSelect = screen.getByRole('combobox', { name: /seleccionar período/i });
    expect(dashboardSelect).toBeDefined();
    expect((dashboardSelect as HTMLSelectElement).value).toBe('09/2026');

    // Switch to Análisis tab
    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const analysisSelect = screen.getByTestId('analysis-period-select') as HTMLSelectElement;
    expect(analysisSelect).toBeDefined();
    expect(analysisSelect.value).toBe('09/2026');

    // For 09/2026: Ingresos 300.000, Egresos 165.000 (60k+80k+25k), Balance 135.000
    const cardBalance = screen.getByTestId('card-balance-general');
    expect(cardBalance.textContent).toContain('$ 300.000,00');
    expect(cardBalance.textContent).toContain('-$ 165.000,00');
    expect(cardBalance.textContent).toContain('$ 135.000,00');

    // Sankey in Análisis has 4 items from September
    const sankeyChart = screen.getByTestId('mock-sankey-chart');
    expect(sankeyChart.getAttribute('data-count')).toBe('4');

    // Change analysisPeriod to 08/2026
    fireEvent.change(analysisSelect, { target: { value: '08/2026' } });
    expect(analysisSelect.value).toBe('08/2026');

    // In 08/2026: Ingresos 200.000, Egresos 120.000 (50k+70k), Balance 80.000
    expect(cardBalance.textContent).toContain('$ 200.000,00');
    expect(cardBalance.textContent).toContain('-$ 120.000,00');
    expect(cardBalance.textContent).toContain('$ 80.000,00');

    // Sankey in Análisis now has 3 items from August
    expect(sankeyChart.getAttribute('data-count')).toBe('3');

    // Switch BACK to Dashboard tab: verify dashboard period is STILL 09/2026!
    fireEvent.click(screen.getByRole('tab', { name: /dashboard/i }));
    const dashboardSelectAfter = screen.getByRole('combobox', { name: /seleccionar período/i }) as HTMLSelectElement;
    expect(dashboardSelectAfter.value).toBe('09/2026');

    // Now change Dashboard period to "Total"
    fireEvent.change(dashboardSelectAfter, { target: { value: 'Total' } });
    expect(dashboardSelectAfter.value).toBe('Total');

    // Switch BACK to Análisis tab: verify analysisPeriod is STILL 08/2026!
    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));
    const analysisSelectAfter = screen.getByTestId('analysis-period-select') as HTMLSelectElement;
    expect(analysisSelectAfter.value).toBe('08/2026');
    expect(cardBalance.textContent).toContain('$ 200.000,00');
  });

  it('applies fill: true and vertical gradient functions to Evolución en el Tiempo (Comparativo)', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // Find the chart for Evolución (contains "Ingresos" and "Egresos Totales")
    const evolucionChart = capturedLineCharts.find((c) =>
      c.data.datasets.some((d) => d.label === 'Ingresos') &&
      c.data.datasets.some((d) => d.label === 'Egresos Totales')
    );

    expect(evolucionChart).toBeDefined();
    const datasets = evolucionChart!.data.datasets;

    const ingresosDataset = datasets.find((d) => d.label === 'Ingresos');
    const egresosDataset = datasets.find((d) => d.label === 'Egresos Totales');

    expect(ingresosDataset).toBeDefined();
    expect(egresosDataset).toBeDefined();

    // Verify fill: true
    expect(ingresosDataset?.fill).toBe(true);
    expect(ingresosDataset?.borderColor).toBe('#22c55e');

    expect(egresosDataset?.fill).toBe(true);
    expect(egresosDataset?.borderColor).toBe('#ef4444');

    // Verify scriptable gradient functions
    const mockGradient = { addColorStop: vi.fn() };
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
    } as unknown as CanvasRenderingContext2D;
    const mockChartArea = { top: 20, bottom: 220, left: 0, right: 300, width: 300, height: 200 };

    const scriptableContext = {
      chart: { ctx: mockCtx, chartArea: mockChartArea },
    } as unknown as ScriptableContext<'line'>;

    const bgIngresosFn = ingresosDataset?.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
    expect(typeof bgIngresosFn).toBe('function');
    const bgIngresos = bgIngresosFn(scriptableContext);
    expect(bgIngresos).toBe(mockGradient);
    expect(mockCtx.createLinearGradient).toHaveBeenCalledWith(0, 20, 0, 220);
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(0, expect.stringContaining('rgba(34, 197, 94'));
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(1, 'rgba(34, 197, 94, 0)');

    const bgEgresosFn = egresosDataset?.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
    expect(typeof bgEgresosFn).toBe('function');
    const bgEgresos = bgEgresosFn(scriptableContext);
    expect(bgEgresos).toBe(mockGradient);
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(0, expect.stringContaining('rgba(239, 68, 68'));
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(1, 'rgba(239, 68, 68, 0)');
  });

  it('applies fill: true and subtle alpha vertical gradient to Evolución en el Tiempo (Categorias)', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // Switch to Categorias tab
    fireEvent.click(screen.getByRole('button', { name: /egresos\/cat/i }));

    // Find the chart for Categorias (contains Comunes or Habitacionales)
    const catChart = capturedLineCharts.find((c) =>
      c.data.datasets.some((d) => d.label === 'Comunes' || d.label === 'Habitacionales')
    );

    expect(catChart).toBeDefined();
    const datasets = catChart!.data.datasets;
    expect(datasets.length).toBeGreaterThan(0);

    const mockGradient = { addColorStop: vi.fn() };
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
    } as unknown as CanvasRenderingContext2D;
    const mockChartArea = { top: 15, bottom: 200, left: 0, right: 300, width: 300, height: 185 };
    const scriptableContext = {
      chart: { ctx: mockCtx, chartArea: mockChartArea },
    } as unknown as ScriptableContext<'line'>;

    datasets.forEach((ds) => {
      expect(ds.fill).toBe(true);
      const bgFn = ds.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
      expect(typeof bgFn).toBe('function');
      const grad = bgFn(scriptableContext);
      expect(grad).toBe(mockGradient);
    });
  });

  it('applies fill: true and blue vertical gradient to Evolución en el Tiempo (Acumulado)', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // Switch to Acumulado tab
    fireEvent.click(screen.getByRole('button', { name: /acumulado/i }));

    const balanceChart = capturedLineCharts.find((c) =>
      c.data.datasets.some((d) => d.label === 'Balance Acumulado')
    );

    expect(balanceChart).toBeDefined();
    const balanceDs = balanceChart!.data.datasets.find((d) => d.label === 'Balance Acumulado');
    expect(balanceDs).toBeDefined();
    expect(balanceDs?.fill).toBe(true);
    expect(balanceDs?.borderColor).toBe('#3b82f6');

    const mockGradient = { addColorStop: vi.fn() };
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
    } as unknown as CanvasRenderingContext2D;
    const mockChartArea = { top: 10, bottom: 180, left: 0, right: 300, width: 300, height: 170 };
    const scriptableContext = {
      chart: { ctx: mockCtx, chartArea: mockChartArea },
    } as unknown as ScriptableContext<'line'>;

    const bgFn = balanceDs?.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
    expect(typeof bgFn).toBe('function');
    const grad = bgFn(scriptableContext);
    expect(grad).toBe(mockGradient);
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(0, expect.stringContaining('rgba(59, 130, 246'));
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(1, 'rgba(59, 130, 246, 0)');
  });

  it('applies fill: true and vertical gradients to Comparativa Personalizada line chart', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // By default: compItem1 is "Salario" and compItem2 is "Alquiler"
    const compChart = capturedLineCharts.find((c) =>
      c.data.datasets.some((d) => d.label === 'Salario') &&
      c.data.datasets.some((d) => d.label === 'Alquiler')
    );

    expect(compChart).toBeDefined();
    const datasets = compChart!.data.datasets;
    expect(datasets).toHaveLength(2);

    const mockGradient = { addColorStop: vi.fn() };
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
    } as unknown as CanvasRenderingContext2D;
    const mockChartArea = { top: 25, bottom: 250, left: 0, right: 300, width: 300, height: 225 };
    const scriptableContext = {
      chart: { ctx: mockCtx, chartArea: mockChartArea },
    } as unknown as ScriptableContext<'line'>;

    datasets.forEach((ds) => {
      expect(ds.fill).toBe(true);
      const bgFn = ds.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
      expect(typeof bgFn).toBe('function');
      const grad = bgFn(scriptableContext);
      expect(grad).toBe(mockGradient);
      expect(mockGradient.addColorStop).toHaveBeenCalledWith(1, expect.stringContaining(', 0)'));
    });
  });

  it('supports drill-down to subcategories on pie sector click with return button', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const pieMock = screen.getByTestId('mock-pie-chart');
    expect(pieMock).toBeDefined();

    // Click on pie slice to trigger drilldown
    fireEvent.click(pieMock);

    // After drilldown: "Volver" button appears
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /volver/i })).toBeDefined();
    });

    // Clicking "Volver" resets drilldown
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(screen.queryByRole('button', { name: /volver/i })).toBeNull();
  });

  it('toggles Desglose filter between Egreso and Ingreso and updates pie labels', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const desgloseSelect = screen.getByLabelText(/tipo de desglose/i) as HTMLSelectElement;
    expect(desgloseSelect.value).toBe('Egreso');

    // Switch to Ingreso
    fireEvent.change(desgloseSelect, { target: { value: 'Ingreso' } });
    expect(desgloseSelect.value).toBe('Ingreso');

    await waitFor(() => {
      const latestPie = capturedPieCharts[capturedPieCharts.length - 1];
      expect(latestPie.data.labels).toContain('Salario');
    });
  });

  it('supports full-year filter (2026) in Análisis independently', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const analysisSelect = screen.getByTestId('analysis-period-select') as HTMLSelectElement;
    fireEvent.change(analysisSelect, { target: { value: '2026' } });
    expect(analysisSelect.value).toBe('2026');

    // All 7 rows are in 2026:
    // Ingresos: 200k + 300k = 500k
    // Egresos: 50k + 70k + 60k + 80k + 25k = 285k
    // Balance: 215k
    const cardBalance = screen.getByTestId('card-balance-general');
    expect(cardBalance.textContent).toContain('$ 500.000,00');
    expect(cardBalance.textContent).toContain('-$ 285.000,00');
    expect(cardBalance.textContent).toContain('$ 215.000,00');

    // Sankey has all 7 rows
    const sankeyChart = screen.getByTestId('mock-sankey-chart');
    expect(sankeyChart.getAttribute('data-count')).toBe('7');
  });

  it('safely returns undefined from gradient callbacks when chartArea is not yet calculated', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const evolucionChart = capturedLineCharts.find((c) =>
      c.data.datasets.some((d) => d.label === 'Ingresos')
    );
    expect(evolucionChart).toBeDefined();

    const ingresosDataset = evolucionChart!.data.datasets.find((d) => d.label === 'Ingresos');
    const bgFn = ingresosDataset?.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient | undefined;

    // Test with undefined chartArea
    const uninitializedContext = {
      chart: {
        ctx: {} as CanvasRenderingContext2D,
        chartArea: undefined,
      },
    } as unknown as ScriptableContext<'line'>;

    expect(bgFn(uninitializedContext)).toBeUndefined();

    // Test with chartArea.bottom <= chartArea.top
    const flatContext = {
      chart: {
        ctx: {} as CanvasRenderingContext2D,
        chartArea: { top: 100, bottom: 100, left: 0, right: 300, width: 300, height: 0 },
      },
    } as unknown as ScriptableContext<'line'>;

    expect(bgFn(flatContext)).toBeUndefined();
  });

  it('handles empty transaction list gracefully without runtime exceptions', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    expect(screen.getByTestId('card-desglose')).toBeDefined();
    expect(screen.getByText(/no hay registros de egreso/i)).toBeDefined();

    expect(screen.getByTestId('card-balance-general')).toBeDefined();
    const balanceCard = screen.getByTestId('card-balance-general');
    expect(balanceCard.textContent).toContain('$ 0,00');

    expect(screen.getByTestId('card-flujo-dinero')).toBeDefined();
    
    const evolucionCard = screen.getByTestId('card-evolucion');
    expect(evolucionCard.textContent).toContain('No hay datos suficientes.');

    const comparativaCard = screen.getByTestId('card-comparativa');
    expect(comparativaCard.textContent).toContain('No hay datos suficientes para comparar en este período.');
  });
});


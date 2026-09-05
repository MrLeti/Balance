import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    return (
      <div
        data-testid="mock-line-chart"
        data-labels={props.data?.labels?.join(',')}
        data-datasets-count={props.data?.datasets?.length || 0}
      />
    );
  },
  Pie: (props: PieProps) => {
    capturedPieCharts.push(props);
    return (
      <div
        data-testid="mock-pie-chart"
        data-labels={props.data?.labels?.join(',')}
        data-dataset-sum={props.data?.datasets?.[0]?.data?.reduce((a: number, b: number) => a + b, 0) || 0}
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

describe('Empirical Challenger M3: Análisis View Cards & Interactions Stress Test', () => {
  const originalFetch = global.fetch;

  // Rich historical dataset covering 2025 and 2026 across multiple categories, types, and edge amounts
  const stressTransactions = [
    // 2025 records
    ['tx-2025-1', '15/11/2025', 'Ingreso', 'Salario', 'Blanco', 150000, 'Sueldo Nov 2025', ''],
    ['tx-2025-2', '20/11/2025', 'Egreso', 'Comunes', 'Mercadería', 45000, 'Supermercado', ''],
    ['tx-2025-3', '10/12/2025', 'Ingreso', 'Salario', 'Aguinaldo B', 75000, 'Aguinaldo Dic 2025', ''],
    ['tx-2025-4', '15/12/2025', 'Egreso', 'Habitacionales', 'Alquiler', 60000, 'Alquiler Dic', ''],

    // 2026 records: Jan
    ['tx-2026-1', '05/01/2026', 'Ingreso', 'Salario', 'Blanco', 220000, 'Sueldo Enero', ''],
    ['tx-2026-2', '12/01/2026', 'Egreso', 'Habitacionales', 'Alquiler', 70000, 'Alquiler Enero', ''],
    ['tx-2026-3', '20/01/2026', 'Egreso', 'Ocio', 'Salida', 30000, 'Cena', ''],

    // 2026 records: Feb
    ['tx-2026-4', '05/02/2026', 'Ingreso', 'Salario', 'Blanco', 230000, 'Sueldo Feb', ''],
    ['tx-2026-5', '14/02/2026', 'Egreso', 'Comunes', 'Mercadería', 55000, 'Super', ''],
    ['tx-2026-6', '18/02/2026', 'Egreso', 'Habitacionales', 'Expensas', 25000, 'Expensas Feb', ''],

    // 2026 records: Mar (Latest month)
    ['tx-2026-7', '02/03/2026', 'Ingreso', 'Salario', 'Blanco', 250000, 'Sueldo Marzo', ''],
    ['tx-2026-8', '08/03/2026', 'Ingreso', 'Extras', 'Honorarios', 50000, 'Freelance', ''],
    ['tx-2026-9', '10/03/2026', 'Egreso', 'Habitacionales', 'Alquiler', 80000, 'Alquiler Marzo', ''],
    ['tx-2026-10', '15/03/2026', 'Egreso', 'Comunes', 'Mercadería', 65000, 'Supermercado', ''],
    ['tx-2026-11', '22/03/2026', 'Egreso', 'Ocio', 'Juegos', 15000, 'Steam Game', ''],
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
          json: () => Promise.resolve({ data: stressTransactions }),
        });
      }
      if (url.includes('/api/categories')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [
            { name: 'Ocio', color: '#8b5cf6' },
            { name: 'Habitacionales', color: '#f59e0b' }
          ] }),
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. RAPID PERIOD SWITCHING & INDEPENDENT CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  it('rapidly switches between Total, single month, and full year; verifies calculation updates at each transition', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const select = screen.getByTestId('analysis-period-select') as HTMLSelectElement;
    const balanceCard = screen.getByTestId('card-balance-general');
    const sankeyChart = screen.getByTestId('mock-sankey-chart');

    // Default latest month is 03/2026
    expect(select.value).toBe('03/2026');
    // In 03/2026:
    // Ingresos: 250k + 50k = 300k
    // Egresos: 80k + 65k + 15k = 160k
    // Balance: 140k
    expect(balanceCard.textContent).toContain('$ 300.000,00');
    expect(balanceCard.textContent).toContain('-$ 160.000,00');
    expect(balanceCard.textContent).toContain('$ 140.000,00');
    expect(sankeyChart.getAttribute('data-count')).toBe('5');

    // Switch 1: Change to "Total" (All 15 transactions across 2025 and 2026)
    // Total Ingresos: 150k + 75k + 220k + 230k + 300k = 975k
    // Total Egresos: 45k + 60k + 70k + 30k + 55k + 25k + 160k = 445k
    // Total Balance: 530k
    fireEvent.change(select, { target: { value: 'Total' } });
    expect(select.value).toBe('Total');
    expect(balanceCard.textContent).toContain('$ 975.000,00');
    expect(balanceCard.textContent).toContain('-$ 445.000,00');
    expect(balanceCard.textContent).toContain('$ 530.000,00');
    expect(sankeyChart.getAttribute('data-count')).toBe('15');

    // Switch 2: Rapid switch to full year "2026" (11 transactions)
    // 2026 Ingresos: 220k + 230k + 300k = 750k
    // 2026 Egresos: 70k + 30k + 55k + 25k + 160k = 340k
    // 2026 Balance: 410k
    fireEvent.change(select, { target: { value: '2026' } });
    expect(select.value).toBe('2026');
    expect(balanceCard.textContent).toContain('$ 750.000,00');
    expect(balanceCard.textContent).toContain('-$ 340.000,00');
    expect(balanceCard.textContent).toContain('$ 410.000,00');
    expect(sankeyChart.getAttribute('data-count')).toBe('11');

    // Switch 3: Rapid switch to full year "2025" (4 transactions)
    // 2025 Ingresos: 150k + 75k = 225k
    // 2025 Egresos: 45k + 60k = 105k
    // 2025 Balance: 120k
    fireEvent.change(select, { target: { value: '2025' } });
    expect(select.value).toBe('2025');
    expect(balanceCard.textContent).toContain('$ 225.000,00');
    expect(balanceCard.textContent).toContain('-$ 105.000,00');
    expect(balanceCard.textContent).toContain('$ 120.000,00');
    expect(sankeyChart.getAttribute('data-count')).toBe('4');

    // Switch 4: Switch to single month "01/2026" (3 transactions)
    // Ingresos: 220k, Egresos: 100k, Balance: 120k
    fireEvent.change(select, { target: { value: '01/2026' } });
    expect(select.value).toBe('01/2026');
    expect(balanceCard.textContent).toContain('$ 220.000,00');
    expect(balanceCard.textContent).toContain('-$ 100.000,00');
    expect(balanceCard.textContent).toContain('$ 120.000,00');
    expect(sankeyChart.getAttribute('data-count')).toBe('3');

    // Switch 5: Back to "Total" immediately
    fireEvent.change(select, { target: { value: 'Total' } });
    expect(select.value).toBe('Total');
    expect(balanceCard.textContent).toContain('$ 975.000,00');
    expect(sankeyChart.getAttribute('data-count')).toBe('15');
  });

  it('proves bi-directional isolation between Dashboard balanceMonth and Análisis analysisPeriod', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      const sel = screen.getByRole('combobox', { name: /seleccionar período/i }) as HTMLSelectElement;
      expect(sel.value).toBe('03/2026');
    });

    // In Dashboard: select 01/2026
    const dashboardSelect = screen.getByRole('combobox', { name: /seleccionar período/i });
    fireEvent.change(dashboardSelect, { target: { value: '01/2026' } });
    expect((dashboardSelect as HTMLSelectElement).value).toBe('01/2026');

    // Switch to Análisis: verify analysisPeriod remains independent (default 03/2026)
    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));
    const analysisSelect = screen.getByTestId('analysis-period-select') as HTMLSelectElement;
    expect(analysisSelect.value).toBe('03/2026');

    // Change analysis to "Total"
    fireEvent.change(analysisSelect, { target: { value: 'Total' } });
    expect(analysisSelect.value).toBe('Total');

    // Switch back to Dashboard: verify dashboard is still 01/2026
    fireEvent.click(screen.getByRole('tab', { name: /dashboard/i }));
    const dashboardSelect2 = screen.getByRole('combobox', { name: /seleccionar período/i }) as HTMLSelectElement;
    expect(dashboardSelect2.value).toBe('01/2026');

    // Change dashboard to "2025"
    fireEvent.change(dashboardSelect2, { target: { value: '2025' } });
    expect(dashboardSelect2.value).toBe('2025');

    // Switch to Análisis: verify analysis is still "Total"
    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));
    const analysisSelect2 = screen.getByTestId('analysis-period-select') as HTMLSelectElement;
    expect(analysisSelect2.value).toBe('Total');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PIE CHART DRILL-DOWN & RETURN STRESS TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  it('drills down into categories, returns via Volver button, and handles period changes while drilled down', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const pieMock = screen.getByTestId('mock-pie-chart');
    expect(pieMock).toBeDefined();

    // Top-level categories in March 2026 for Egresos: "Habitacionales", "Comunes", "Ocio"
    const pieHeader = screen.getByRole('heading', { name: /desglose/i });
    expect(pieHeader.textContent).toBe('Desglose ');

    // Drill down by clicking pie slice
    fireEvent.click(pieMock);

    // "🔙 Volver" button appears and header shows the drilled-down category
    const volverBtn = await screen.findByRole('button', { name: /volver/i });
    expect(volverBtn).toBeDefined();

    // Now test switching analysisPeriod WHILE drilled down to a period where that category may or may not exist
    const select = screen.getByTestId('analysis-period-select') as HTMLSelectElement;
    // Switch to 11/2025 (only has "Comunes", no Habitacionales)
    fireEvent.change(select, { target: { value: '11/2025' } });

    // The UI survives gracefully without crashing
    expect(screen.getByTestId('card-desglose')).toBeDefined();

    // User can click "🔙 Volver" to return to top-level view
    const volverBtnAfter = screen.queryByRole('button', { name: /volver/i });
    if (volverBtnAfter) {
      fireEvent.click(volverBtnAfter);
    }
    expect(screen.queryByRole('button', { name: /volver/i })).toBeNull();
  });

  it('drills down, switches pieFilter between Egreso and Ingreso, and verifies drilldown state resets cleanly', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const pieMock = screen.getByTestId('mock-pie-chart');
    fireEvent.click(pieMock);

    expect(await screen.findByRole('button', { name: /volver/i })).toBeDefined();

    // Switch filter from Egreso to Ingreso
    const typeSelect = screen.getByLabelText(/tipo de desglose/i) as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'Ingreso' } });

    // Drilldown must reset: "Volver" button disappears
    expect(screen.queryByRole('button', { name: /volver/i })).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SCRIPTABLE GRADIENTS EXECUTION & RESILIENCE
  // ─────────────────────────────────────────────────────────────────────────────
  it('executes all scriptable gradient callbacks across all 3 line sub-tabs and comparativa with valid CanvasGradient', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // Mock canvas context and valid chartArea
    const mockAddColorStop = vi.fn();
    const mockLinearGradient = { addColorStop: mockAddColorStop };
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue(mockLinearGradient),
    } as unknown as CanvasRenderingContext2D;
    const validChartArea = { top: 10, bottom: 250, left: 0, right: 400, width: 400, height: 240 };
    const mockScriptableContext = {
      chart: { ctx: mockCtx, chartArea: validChartArea },
    } as unknown as ScriptableContext<'line'>;

    // A) Tab 1: Comparativo G/I
    const comparativoChart = capturedLineCharts.find(c =>
      c.data.datasets.some(d => d.label === 'Ingresos') &&
      c.data.datasets.some(d => d.label === 'Egresos Totales')
    );
    expect(comparativoChart).toBeDefined();

    comparativoChart!.data.datasets.forEach(ds => {
      expect(ds.fill).toBe(true);
      const bgFn = ds.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
      expect(typeof bgFn).toBe('function');
      const result = bgFn(mockScriptableContext);
      expect(result).toBe(mockLinearGradient);
      expect(mockAddColorStop).toHaveBeenCalledWith(1, expect.stringContaining(', 0)'));
    });

    // B) Tab 2: Egresos/Cat
    fireEvent.click(screen.getByRole('button', { name: /egresos\/cat/i }));
    const catChart = capturedLineCharts.find(c =>
      c.data.datasets.some(d => d.label === 'Habitacionales' || d.label === 'Comunes')
    );
    expect(catChart).toBeDefined();
    catChart!.data.datasets.forEach(ds => {
      expect(ds.fill).toBe(true);
      const bgFn = ds.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
      expect(typeof bgFn).toBe('function');
      const result = bgFn(mockScriptableContext);
      expect(result).toBe(mockLinearGradient);
    });

    // C) Tab 3: Acumulado
    fireEvent.click(screen.getByRole('button', { name: /acumulado/i }));
    const balanceChart = capturedLineCharts.find(c =>
      c.data.datasets.some(d => d.label === 'Balance Acumulado')
    );
    expect(balanceChart).toBeDefined();
    const balanceDs = balanceChart!.data.datasets[0];
    expect(balanceDs.fill).toBe(true);
    const balanceBgFn = balanceDs.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
    const balanceResult = balanceBgFn(mockScriptableContext);
    expect(balanceResult).toBe(mockLinearGradient);
    expect(balanceDs.borderColor).toBe('#3b82f6');

    // D) Comparativa Personalizada
    const compChart = capturedLineCharts.find(c =>
      c.data.datasets.some(d => d.label === 'Salario') ||
      c.data.datasets.some(d => d.label === 'Alquiler')
    );
    expect(compChart).toBeDefined();
    compChart!.data.datasets.forEach(ds => {
      expect(ds.fill).toBe(true);
      const bgFn = ds.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
      expect(typeof bgFn).toBe('function');
      const result = bgFn(mockScriptableContext);
      expect(result).toBe(mockLinearGradient);
    });
  });

  it('guarantees scriptable gradient callbacks never throw under degenerated canvas states', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const comparativoChart = capturedLineCharts.find(c =>
      c.data.datasets.some(d => d.label === 'Ingresos')
    );
    expect(comparativoChart).toBeDefined();
    const bgFn = comparativoChart!.data.datasets[0].backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient | undefined;

    // Degenerate State 1: chartArea is undefined
    expect(bgFn({ chart: { ctx: {} as any, chartArea: undefined } } as any)).toBeUndefined();

    // Degenerate State 2: chartArea is null
    expect(bgFn({ chart: { ctx: {} as any, chartArea: null } } as any)).toBeUndefined();

    // Degenerate State 3: chartArea bottom <= top (zero height)
    expect(bgFn({ chart: { ctx: {} as any, chartArea: { top: 100, bottom: 100 } } } as any)).toBeUndefined();

    // Degenerate State 4: inverted height (bottom < top)
    expect(bgFn({ chart: { ctx: {} as any, chartArea: { top: 100, bottom: 50 } } } as any)).toBeUndefined();

    // Degenerate State 5: NaN values
    expect(bgFn({ chart: { ctx: {} as any, chartArea: { top: NaN, bottom: 200 } } } as any)).toBeUndefined();

    // Degenerate State 6: Infinite values
    expect(bgFn({ chart: { ctx: {} as any, chartArea: { top: 0, bottom: Infinity } } } as any)).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. COMPARATIVE CUSTOM ITEMS SWITCHING & EMPTY DATA HANDLING
  // ─────────────────────────────────────────────────────────────────────────────
  it('updates Comparativa Personalizada datasets when changing Item A and Item B', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const item1Select = screen.getByLabelText(/primer ítem de comparación/i) as HTMLSelectElement;
    const item2Select = screen.getByLabelText(/segundo ítem de comparación/i) as HTMLSelectElement;

    expect(item1Select.value).toBe('Salario');
    expect(item2Select.value).toBe('Alquiler');

    // Change Item 1 to "Mercadería"
    fireEvent.change(item1Select, { target: { value: 'Mercadería' } });
    expect(item1Select.value).toBe('Mercadería');

    // Change Item 2 to "Ocio"
    fireEvent.change(item2Select, { target: { value: 'Ocio' } });
    expect(item2Select.value).toBe('Ocio');

    await waitFor(() => {
      const updatedComp = capturedLineCharts[capturedLineCharts.length - 1];
      expect(updatedComp.data.datasets.map(d => d.label)).toEqual(expect.arrayContaining(['Mercadería', 'Ocio']));
    });
  });

  it('safely renders when given malformed transaction records with NaN amounts and invalid dates', async () => {
    const malformedData = [
      ['tx-bad-1', '', 'Ingreso', '', '', 'not-a-number', ''],
      ['tx-bad-2', 'invalid-date', 'Egreso', null, undefined, -500, ''],
      ['tx-bad-3', '99/99/9999', 'Ahorro', 'Retiro', 'Rescate', NaN, ''],
      ['tx-bad-4'], // incomplete row
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: malformedData }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // Verify all 5 cards render without unhandled exceptions
    expect(screen.getByTestId('card-desglose')).toBeDefined();
    expect(screen.getByTestId('card-balance-general')).toBeDefined();
    expect(screen.getByTestId('card-flujo-dinero')).toBeDefined();
    expect(screen.getByTestId('card-evolucion')).toBeDefined();
    expect(screen.getByTestId('card-comparativa')).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. AGGREGATION, TOOLTIPS, AND FORMULA PARITY
  // ─────────────────────────────────────────────────────────────────────────────
  it('switches line chart date grouping from daily (DD/MM/YYYY) for single month to monthly (MM/YYYY) for full year and Total', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const select = screen.getByTestId('analysis-period-select') as HTMLSelectElement;

    // Default period: 03/2026 (single month) -> expect daily format (DD/MM/YYYY)
    await waitFor(() => {
      const evolucion = capturedLineCharts.find(c => c.data.datasets.some(d => d.label === 'Ingresos'));
      expect(evolucion).toBeDefined();
      const labels = evolucion!.data.labels as string[];
      expect(labels.some(l => l.includes('/03/2026') && l.split('/').length === 3)).toBe(true);
    });

    // Change to "2026" (full year) -> expect monthly aggregation (MM/YYYY)
    fireEvent.change(select, { target: { value: '2026' } });
    await waitFor(() => {
      const evolucionYear = capturedLineCharts[capturedLineCharts.length - 1];
      const labels = evolucionYear.data.labels as string[];
      expect(labels).toEqual(expect.arrayContaining(['01/2026', '02/2026', '03/2026']));
      // No 3-part daily date should exist in monthly aggregated labels
      labels.forEach(l => {
        expect(l.split('/').length).toBe(2);
      });
    });

    // Change to "Total" -> expect monthly aggregation covering 2025 and 2026
    fireEvent.change(select, { target: { value: 'Total' } });
    await waitFor(() => {
      const evolucionTotal = capturedLineCharts[capturedLineCharts.length - 1];
      const labels = evolucionTotal.data.labels as string[];
      expect(labels).toEqual(expect.arrayContaining(['11/2025', '12/2025', '01/2026', '02/2026', '03/2026']));
    });
  });

  it('verifies pie chart tooltip callback accurately formats currency and percentages even with zero totals', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const latestPie = capturedPieCharts[capturedPieCharts.length - 1];
    expect(latestPie).toBeDefined();

    const tooltipCallback = latestPie.options?.plugins?.tooltip?.callbacks?.label;
    expect(typeof tooltipCallback).toBe('function');

    // Normal scenario: item of 80000 in total of 160000 -> 50.0%
    const normalCtx = {
      label: 'Alquiler',
      parsed: 80000,
      dataset: { data: [80000, 65000, 15000] },
    };
    const formatted = tooltipCallback(normalCtx);
    expect(formatted).toContain('Alquiler');
    expect(formatted).toContain('50.0%');

    // Zero total scenario
    const zeroCtx = {
      label: 'Vacio',
      parsed: 0,
      dataset: { data: [0, 0] },
    };
    const formattedZero = tooltipCallback(zeroCtx);
    expect(formattedZero).toContain('Vacio');
    expect(formattedZero).toContain('0%');
  });

  it('proves mathematical parity of Balance General calculations between Dashboard and Análisis when set to identical period', async () => {
    render(<DashboardData />);

    await waitFor(() => {
      const sel = screen.getByRole('combobox', { name: /seleccionar período/i }) as HTMLSelectElement;
      expect(sel.value).toBe('03/2026');
    });

    // Set Dashboard to "Total"
    const dashSelect = screen.getByRole('combobox', { name: /seleccionar período/i });
    fireEvent.change(dashSelect, { target: { value: 'Total' } });

    // Switch to Análisis
    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));
    const analysisSelect = screen.getByTestId('analysis-period-select');
    fireEvent.change(analysisSelect, { target: { value: 'Total' } });

    const cardBalance = screen.getByTestId('card-balance-general');
    // Balance card in Análisis:
    expect(cardBalance.textContent).toContain('$ 975.000,00'); // Ingresos
    expect(cardBalance.textContent).toContain('-$ 445.000,00'); // Egresos
    expect(cardBalance.textContent).toContain('$ 530.000,00'); // Net Balance

    // Switch back to Dashboard and verify HealthMetrics has the exact same figures
    fireEvent.click(screen.getByRole('tab', { name: /dashboard/i }));
    // HealthMetrics displays Balance, Ingresos, Egresos
    expect(screen.getByText(/balance neto/i).parentElement?.textContent).toContain('$ 530.000,00');
    expect(screen.getByText(/ingresos: \+/i).textContent).toContain('$ 975.000,00');
    expect(screen.getByText(/egresos: -/i).textContent).toContain('$ 445.000,00');
  });
});

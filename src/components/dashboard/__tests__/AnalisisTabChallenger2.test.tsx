import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChartData, ChartOptions, ScriptableContext } from 'chart.js';
import DashboardData from '../DashboardData';
import SankeyChart from '../SankeyChart';

interface LineProps {
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
}

interface PieProps {
  data: any;
  options?: any;
}

interface GenericChartProps {
  type: string;
  data: any;
  options?: any;
}

let capturedLineCharts: LineProps[] = [];
let capturedPieCharts: PieProps[] = [];
let capturedGenericCharts: GenericChartProps[] = [];

// Mock react-chartjs-2 to capture props passed to Line, Pie, and Chart (used by Sankey)
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
  Chart: (props: GenericChartProps) => {
    capturedGenericCharts.push(props);
    return (
      <div
        data-testid="mock-generic-chart"
        data-chart-type={props.type}
        data-flows-count={props.data?.datasets?.[0]?.data?.length || 0}
      />
    );
  },
}));

describe('Empirical Challenger 2: Milestone 3 (Data Scenarios, Empty Filtering & Gradient Robustness)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    capturedLineCharts = [];
    capturedPieCharts = [];
    capturedGenericCharts = [];
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 1: EMPTY FILTERED DATA & EDGE CASES IN ANÁLISIS VIEW
  // ═════════════════════════════════════════════════════════════════════════════

  it('handles completely empty dataset ([]): all 5 cards in Análisis display safe fallbacks without throwing', async () => {
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

    // 1. Header
    expect(screen.getByTestId('analysis-header')).toBeDefined();

    // 2. Desglose Card
    const desgloseCard = screen.getByTestId('card-desglose');
    expect(desgloseCard).toBeDefined();
    expect(desgloseCard.textContent).toContain('No hay registros de egreso.');

    // 3. Balance General Card: all $0.00
    const balanceCard = screen.getByTestId('card-balance-general');
    expect(balanceCard).toBeDefined();
    expect(balanceCard.textContent).toContain('$ 0,00');

    // 4. Sankey Card: fallback paragraph from unmocked SankeyChart
    const flujoCard = screen.getByTestId('card-flujo-dinero');
    expect(flujoCard).toBeDefined();
    expect(flujoCard.textContent).toContain('No hay datos suficientes para el gráfico Cashflow.');

    // 5. Evolución Card: fallback text
    const evolucionCard = screen.getByTestId('card-evolucion');
    expect(evolucionCard).toBeDefined();
    expect(evolucionCard.textContent).toContain('No hay datos suficientes.');

    // 6. Comparativa Card: fallback text
    const comparativaCard = screen.getByTestId('card-comparativa');
    expect(comparativaCard).toBeDefined();
    expect(comparativaCard.textContent).toContain('No hay datos suficientes para comparar en este período.');
  });

  it('handles period with zero matching transactions while other periods have data', async () => {
    const dataWithPeriods = [
      ['tx-1', '10/05/2026', 'Ingreso', 'Salario', 'Blanco', 100000, '', ''],
      ['tx-2', '15/05/2026', 'Egreso', 'Comunes', 'Mercadería', 30000, '', ''],
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: dataWithPeriods }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const select = screen.getByTestId('analysis-period-select') as HTMLSelectElement;
    expect(select.value).toBe('05/2026');

    // Simulate an empty period option or forced selection via target
    fireEvent.change(select, { target: { value: '01/2025' } });

    // In 01/2025: 0 records match
    expect(screen.getByTestId('card-desglose').textContent).toContain('No hay registros de egreso.');
    expect(screen.getByTestId('card-balance-general').textContent).toContain('$ 0,00');
    expect(screen.getByTestId('card-flujo-dinero').textContent).toContain('No hay datos suficientes para el gráfico Cashflow.');
    expect(screen.getByTestId('card-evolucion').textContent).toContain('No hay datos suficientes.');
    expect(screen.getByTestId('card-comparativa').textContent).toContain('No hay datos suficientes para comparar en este período.');
  });

  it('stress-tests 1-Ingreso-only scenario: verifies Desglose, Evolución, Comparativa, and Sankey survive without crash', async () => {
    const singleIncomeData = [
      ['tx-only-in', '15/07/2026', 'Ingreso', 'Salario', 'Blanco', 350000, '', ''],
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: singleIncomeData }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // A) Desglose default is Egreso -> 0 egresos, should show fallback
    expect(screen.getByTestId('card-desglose').textContent).toContain('No hay registros de egreso.');

    // Switch Desglose to Ingreso -> should show pie with Salario
    const pieSelect = screen.getByLabelText(/tipo de desglose/i);
    fireEvent.change(pieSelect, { target: { value: 'Ingreso' } });
    await waitFor(() => {
      const pieChart = capturedPieCharts[capturedPieCharts.length - 1];
      expect(pieChart.data.labels).toEqual(['Salario']);
      expect(pieChart.data.datasets[0].data).toEqual([350000]);
    });

    // B) Balance General
    const bal = screen.getByTestId('card-balance-general');
    expect(bal.textContent).toContain('$ 350.000,00'); // Ingreso
    expect(bal.textContent).toContain('-$ 0,00');       // Egreso
    expect(bal.textContent).toContain('$ 350.000,00'); // Balance

    // C) Evolución: Comparativo G/I should have Ingresos = 350000, Egresos = 0
    const evolucionChart = capturedLineCharts.find(c =>
      c.data.datasets.some(d => d.label === 'Ingresos') &&
      c.data.datasets.some(d => d.label === 'Egresos Totales')
    );
    expect(evolucionChart).toBeDefined();
    expect(evolucionChart!.data.datasets.find(d => d.label === 'Ingresos')?.data).toEqual([350000]);
    expect(evolucionChart!.data.datasets.find(d => d.label === 'Egresos Totales')?.data).toEqual([0]);

    // Check Egresos/Cat tab: allCategoriesEncountered is empty -> evolucion chart has 0 datasets
    fireEvent.click(screen.getByRole('button', { name: /egresos\/cat/i }));
    await waitFor(() => {
      const evolucionSection = screen.getByTestId('card-evolucion');
      const mockLine = evolucionSection.querySelector('[data-testid="mock-line-chart"]');
      expect(mockLine?.getAttribute('data-datasets-count')).toBe('0');
    });

    // Check Acumulado tab: runningBalance should be 350000
    fireEvent.click(screen.getByRole('button', { name: /acumulado/i }));
    await waitFor(() => {
      const acumChart = capturedLineCharts.find(c =>
        c.data.datasets.some(d => d.label === 'Balance Acumulado')
      );
      expect(acumChart).toBeDefined();
      expect(acumChart!.data.datasets[0].data).toEqual([350000]);
    });

    // D) SankeyChart: should render flows (Salario -> Cash Flow -> Sobrante)
    const sankeyGeneric = capturedGenericCharts.find(c => c.type === 'sankey');
    expect(sankeyGeneric).toBeDefined();
    const flows = sankeyGeneric!.data.datasets[0].data;
    expect(flows.length).toBeGreaterThan(0);
    expect(flows.some((f: any) => f.to === 'Sobrante' && f.flow === 350000)).toBe(true);
  });

  it('stress-tests 1-Egreso-only scenario: verifies Deficit flow and zero-income states', async () => {
    const singleExpenseData = [
      ['tx-only-eg', '10/08/2026', 'Egreso', 'Habitacionales', 'Alquiler', 90000, '', ''],
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: singleExpenseData }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // A) Desglose shows Habitacionales
    await waitFor(() => {
      const pie = capturedPieCharts[capturedPieCharts.length - 1];
      expect(pie.data.labels).toEqual(['Habitacionales']);
      expect(pie.data.datasets[0].data).toEqual([90000]);
    });

    // B) Balance General
    const bal = screen.getByTestId('card-balance-general');
    expect(bal.textContent).toContain('$ 0,00');        // Ingreso
    expect(bal.textContent).toContain('-$ 90.000,00');  // Egreso
    expect(bal.textContent).toContain('-$ 90.000,00');  // Balance

    // C) SankeyChart: should include Déficit flow (surplus < 0)
    const sankeyGeneric = capturedGenericCharts.find(c => c.type === 'sankey');
    expect(sankeyGeneric).toBeDefined();
    const flows = sankeyGeneric!.data.datasets[0].data;
    expect(flows.some((f: any) => f.from === 'Déficit' && f.to === 'Cash Flow' && f.flow === 90000)).toBe(true);
  });

  it('handles zero amounts ($0.00) and negative parsed amounts gracefully without crashing', async () => {
    const zeroAndNegativeData = [
      ['tx-z1', '01/09/2026', 'Ingreso', 'Salario', 'Blanco', 0, '', ''],
      ['tx-z2', '02/09/2026', 'Egreso', 'Comunes', 'Mercadería', '0,00', '', ''],
      ['tx-z3', '03/09/2026', 'Egreso', 'Ocio', 'Juegos', -100, '', ''], // negative amount
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: zeroAndNegativeData }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // Verify all cards render safely
    expect(screen.getByTestId('card-desglose')).toBeDefined();
    expect(screen.getByTestId('card-balance-general')).toBeDefined();
    expect(screen.getByTestId('card-flujo-dinero')).toBeDefined();
    expect(screen.getByTestId('card-evolucion')).toBeDefined();
    expect(screen.getByTestId('card-comparativa')).toBeDefined();
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 2: STANDALONE SANKEY CHART EMPIRICAL STRESS TESTS
  // ═════════════════════════════════════════════════════════════════════════════

  it('SankeyChart standalone: renders empty paragraph when given empty array', () => {
    render(<SankeyChart data={[]} isDark={false} />);
    expect(screen.getByText('No hay datos suficientes para el gráfico Cashflow.')).toBeDefined();
  });

  it('SankeyChart standalone: renders empty paragraph when all amounts are <= 0', () => {
    const zeroData = [
      ['tx-1', '01/01/2026', 'Ingreso', 'Salario', 'Blanco', 0],
      ['tx-2', '02/01/2026', 'Egreso', 'Comunes', 'Super', -500],
    ];
    render(<SankeyChart data={zeroData} isDark={false} />);
    expect(screen.getByText('No hay datos suficientes para el gráfico Cashflow.')).toBeDefined();
  });

  it('SankeyChart standalone: renders empty paragraph when rows have length < 6', () => {
    const corruptData = [
      ['tx-1', '01/01/2026'],
      ['tx-2'],
    ];
    render(<SankeyChart data={corruptData} isDark={false} />);
    expect(screen.getByText('No hay datos suficientes para el gráfico Cashflow.')).toBeDefined();
  });

  it('SankeyChart standalone: correctly computes multi-category flows with Inversión and Ahorros', () => {
    const complexData = [
      ['tx-1', '01/01/2026', 'Ingreso', 'Salario', 'Blanco', 500000, '', ''],
      ['tx-2', '02/01/2026', 'Egreso', 'Habitacionales', 'Alquiler', 150000, '', ''],
      ['tx-3', '03/01/2026', 'Egreso', 'Comunes', 'Super', 80000, '', ''],
      ['tx-4', '04/01/2026', 'Inversión', 'Activos Financieros', 'CEDEARs', 100000, '', ''],
      ['tx-5', '05/01/2026', 'Ahorro', 'Aporte', 'Fondo de Emergencia', 50000, '', ''],
      ['tx-6', '06/01/2026', 'Ahorro', 'Retiro', 'Rescate', 30000, '', ''], // Retiro increases entrada
    ];

    render(<SankeyChart data={complexData} isDark={true} />);

    const sankeyChart = capturedGenericCharts.find(c => c.type === 'sankey');
    expect(sankeyChart).toBeDefined();
    const dataset = sankeyChart!.data.datasets[0];
    const flows = dataset.data;

    // Total entradas = 500k + 30k = 530k
    // Total salidas = 150k + 80k + 100k + 50k = 380k
    // Surplus = 150k -> Cash Flow -> Sobrante
    expect(flows.some((f: any) => f.from === 'Cash Flow' && f.to === 'Sobrante' && f.flow === 150000)).toBe(true);

    // Flow from Inversión: Cash Flow -> INV_CAT_Activos Financieros (100k)
    expect(flows.some((f: any) => f.from === 'Cash Flow' && f.to === 'INV_CAT_Activos Financieros' && f.flow === 100000)).toBe(true);

    // Flow from Ahorro Aporte: Cash Flow -> AH_CAT_Ahorro (50k)
    expect(flows.some((f: any) => f.from === 'Cash Flow' && f.to === 'AH_CAT_Ahorro' && f.flow === 50000)).toBe(true);

    // Flow from Ahorro Retiro: AH_RET_CAT_Retiro -> Cash Flow (30k)
    expect(flows.some((f: any) => f.from === 'AH_RET_CAT_Retiro' && f.to === 'Cash Flow' && f.flow === 30000)).toBe(true);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 3: EMPIRICAL VERIFICATION OF FILL: TRUE & SCRIPTABLE GRADIENTS
  // ═════════════════════════════════════════════════════════════════════════════

  it('empirically verifies fill: true and scriptable gradient functions for ALL datasets in Evolución (Comparativo, Categorias, Acumulado)', async () => {
    const multiCatData = [
      ['tx-1', '01/04/2026', 'Ingreso', 'Salario', 'Blanco', 300000, '', ''],
      ['tx-2', '05/04/2026', 'Egreso', 'Comunes', 'Super', 50000, '', ''],
      ['tx-3', '10/04/2026', 'Egreso', 'Habitacionales', 'Alquiler', 80000, '', ''],
      ['tx-4', '15/04/2026', 'Egreso', 'Ocio', 'Cine', 20000, '', ''],
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: multiCatData }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // Mock canvas context
    const mockAddColorStop = vi.fn();
    const mockGradient = { addColorStop: mockAddColorStop };
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
    } as unknown as CanvasRenderingContext2D;
    const validChartArea = { top: 10, bottom: 250, left: 0, right: 300, width: 300, height: 240 };
    const mockScriptableContext = {
      chart: { ctx: mockCtx, chartArea: validChartArea },
    } as unknown as ScriptableContext<'line'>;

    // ─────────────────────────────────────────────────────────────────
    // Sub-tab 1: Comparativo G/I
    // ─────────────────────────────────────────────────────────────────
    const compGIChart = capturedLineCharts.find(c =>
      c.data.datasets.some(d => d.label === 'Ingresos') &&
      c.data.datasets.some(d => d.label === 'Egresos Totales')
    );
    expect(compGIChart).toBeDefined();
    expect(compGIChart!.data.datasets).toHaveLength(2);

    for (const ds of compGIChart!.data.datasets) {
      expect(ds.fill).toBe(true);
      expect(typeof ds.backgroundColor).toBe('function');
      const bgFn = ds.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
      const grad = bgFn(mockScriptableContext);
      expect(grad).toBe(mockGradient);
    }

    // ─────────────────────────────────────────────────────────────────
    // Sub-tab 2: Egresos/Cat
    // ─────────────────────────────────────────────────────────────────
    fireEvent.click(screen.getByRole('button', { name: /egresos\/cat/i }));
    await waitFor(() => {
      const catChart = capturedLineCharts.find(c =>
        c.data.datasets.some(d => d.label === 'Comunes' || d.label === 'Habitacionales' || d.label === 'Ocio')
      );
      expect(catChart).toBeDefined();
      expect(catChart!.data.datasets.length).toBe(3);

      for (const ds of catChart!.data.datasets) {
        expect(ds.fill).toBe(true);
        expect(typeof ds.backgroundColor).toBe('function');
        const bgFn = ds.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
        const grad = bgFn(mockScriptableContext);
        expect(grad).toBe(mockGradient);
      }
    });

    // ─────────────────────────────────────────────────────────────────
    // Sub-tab 3: Acumulado
    // ─────────────────────────────────────────────────────────────────
    fireEvent.click(screen.getByRole('button', { name: /acumulado/i }));
    await waitFor(() => {
      const acumChart = capturedLineCharts.find(c =>
        c.data.datasets.some(d => d.label === 'Balance Acumulado')
      );
      expect(acumChart).toBeDefined();
      const ds = acumChart!.data.datasets[0];
      expect(ds.fill).toBe(true);
      expect(ds.borderColor).toBe('#3b82f6');
      expect(typeof ds.backgroundColor).toBe('function');
      const bgFn = ds.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
      const grad = bgFn(mockScriptableContext);
      expect(grad).toBe(mockGradient);
    });
  });

  it('empirically verifies fill: true and scriptable gradient functions for Comparativa Personalizada', async () => {
    const compData = [
      ['tx-1', '01/04/2026', 'Ingreso', 'Salario', 'Blanco', 300000, '', ''],
      ['tx-2', '05/04/2026', 'Egreso', 'Habitacionales', 'Alquiler', 80000, '', ''],
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: compData }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const compChart = capturedLineCharts.find(c =>
      c.data.datasets.some(d => d.label === 'Salario') &&
      c.data.datasets.some(d => d.label === 'Alquiler')
    );
    expect(compChart).toBeDefined();
    expect(compChart!.data.datasets).toHaveLength(2);

    const mockAddColorStop = vi.fn();
    const mockGradient = { addColorStop: mockAddColorStop };
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
    } as unknown as CanvasRenderingContext2D;
    const validChartArea = { top: 20, bottom: 200, left: 0, right: 300, width: 300, height: 180 };
    const mockScriptableContext = {
      chart: { ctx: mockCtx, chartArea: validChartArea },
    } as unknown as ScriptableContext<'line'>;

    for (const ds of compChart!.data.datasets) {
      expect(ds.fill).toBe(true);
      expect(typeof ds.backgroundColor).toBe('function');
      const bgFn = ds.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
      const grad = bgFn(mockScriptableContext);
      expect(grad).toBe(mockGradient);
      expect(mockAddColorStop).toHaveBeenCalledWith(1, expect.stringContaining(', 0)'));
    }
  });

  it('verifies scriptable gradient functions adapt properly between light and dark modes without black-halo artifact', async () => {
    const testData = [
      ['tx-1', '01/04/2026', 'Ingreso', 'Salario', 'Blanco', 200000, '', ''],
      ['tx-2', '05/04/2026', 'Egreso', 'Comunes', 'Super', 50000, '', ''],
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: testData }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const compGIChart = capturedLineCharts.find(c =>
      c.data.datasets.some(d => d.label === 'Ingresos')
    );
    expect(compGIChart).toBeDefined();
    const ingresosDs = compGIChart!.data.datasets.find(d => d.label === 'Ingresos')!;

    const mockAddColorStop = vi.fn();
    const mockGradient = { addColorStop: mockAddColorStop };
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
    } as unknown as CanvasRenderingContext2D;
    const chartArea = { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 };
    const scriptableCtx = { chart: { ctx: mockCtx, chartArea } } as unknown as ScriptableContext<'line'>;

    const bgFn = ingresosDs.backgroundColor as (ctx: ScriptableContext<'line'>) => CanvasGradient;
    bgFn(scriptableCtx);

    // Stop 0 must have positive alpha
    expect(mockAddColorStop).toHaveBeenCalledWith(0, expect.stringMatching(/rgba\(34, 197, 94, 0\.\d+\)/));
    // Stop 1 must be strictly transparent with matching RGB to avoid black halo: rgba(34, 197, 94, 0)
    expect(mockAddColorStop).toHaveBeenCalledWith(1, 'rgba(34, 197, 94, 0)');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 4: ADVERSARIAL EDGE CASES & STRESS BOUNDARIES
  // ═════════════════════════════════════════════════════════════════════════════

  it('Comparativa Personalizada: handles identical items selected (Item A === Item B) without crashing', async () => {
    const identicalData = [
      ['tx-1', '01/04/2026', 'Ingreso', 'Salario', 'Blanco', 300000, '', ''],
      ['tx-2', '05/04/2026', 'Egreso', 'Habitacionales', 'Alquiler', 80000, '', ''],
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: identicalData }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const item1Select = screen.getByLabelText(/primer ítem de comparación/i);
    const item2Select = screen.getByLabelText(/segundo ítem de comparación/i);

    // Set BOTH to "Salario"
    fireEvent.change(item1Select, { target: { value: 'Salario' } });
    fireEvent.change(item2Select, { target: { value: 'Salario' } });

    await waitFor(() => {
      const compChart = capturedLineCharts.find(c =>
        c.data.datasets.every(d => d.label === 'Salario')
      );
      expect(compChart).toBeDefined();
      expect(compChart!.data.datasets).toHaveLength(2);
      expect(compChart!.data.datasets[0].fill).toBe(true);
      expect(compChart!.data.datasets[1].fill).toBe(true);
    });
  });

  it('Comparativa Personalizada: renders fallback text when active period has 0 transactions, and plots 0-spend on active days', async () => {
    const periodData = [
      // Only Salario and Alquiler in 04/2026
      ['tx-1', '01/04/2026', 'Ingreso', 'Salario', 'Blanco', 300000, '', ''],
      ['tx-2', '05/04/2026', 'Egreso', 'Habitacionales', 'Alquiler', 80000, '', ''],
      // Ocio and Comunes only in 05/2026
      ['tx-3', '05/05/2026', 'Egreso', 'Ocio', 'Salida', 50000, '', ''],
      ['tx-4', '10/05/2026', 'Egreso', 'Comunes', 'Super', 40000, '', ''],
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: periodData }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    // Case A: Select period 04/2026, and choose items not spent in 04/2026 (Ocio vs Comunes).
    // The chart plots daily points at 0 for active dates without crashing.
    const analysisSelect = screen.getByTestId('analysis-period-select');
    fireEvent.change(analysisSelect, { target: { value: '04/2026' } });

    const item1Select = screen.getByLabelText(/primer ítem de comparación/i);
    const item2Select = screen.getByLabelText(/segundo ítem de comparación/i);
    fireEvent.change(item1Select, { target: { value: 'Ocio' } });
    fireEvent.change(item2Select, { target: { value: 'Comunes' } });

    await waitFor(() => {
      const compChart = capturedLineCharts.find(c =>
        c.data.datasets.some(d => d.label === 'Ocio') &&
        c.data.datasets.some(d => d.label === 'Comunes')
      );
      expect(compChart).toBeDefined();
      // Values are 0 for both dates in 04/2026
      expect(compChart!.data.datasets[0].data).toEqual([0, 0]);
      expect(compChart!.data.datasets[1].data).toEqual([0, 0]);
    });

    // Case B: Select a period with ZERO transactions (e.g. 01/2025)
    // Now labels is empty ([]), and fallback text MUST be displayed
    fireEvent.change(analysisSelect, { target: { value: '01/2025' } });

    await waitFor(() => {
      const compCard = screen.getByTestId('card-comparativa');
      expect(compCard.textContent).toContain('No hay datos suficientes para comparar en este período.');
    });
  });

  it('verifies accessibility compliance: role="tabpanel", id, aria-labelledby, and distinct labels on all interactive controls', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [
            ['tx-1', '01/06/2026', 'Ingreso', 'Salario', 'Blanco', 100000, '', '']
          ] }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    });

    render(<DashboardData />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));

    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('id')).toBe('tabpanel-analisis');
    expect(panel.getAttribute('aria-labelledby')).toBe('tab-analisis');

    expect(screen.getByLabelText('Filtro de Período')).toBeDefined();
    expect(screen.getByLabelText('Tipo de desglose')).toBeDefined();
    expect(screen.getByLabelText('Primer ítem de comparación')).toBeDefined();
    expect(screen.getByLabelText('Segundo ítem de comparación')).toBeDefined();
  });
});

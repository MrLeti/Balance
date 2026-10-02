import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CostoVidaBarChart from "../CostoVidaBarChart";
import SingleCategoryLineChart from "../SingleCategoryLineChart";
import CategoryDistributionCard from "../CategoryDistributionCard";
import DashboardData from "../DashboardData";

interface MockChartProps {
    data?: any;
    options?: any;
}

vi.mock("react-chartjs-2", () => ({
    Bar: (props: MockChartProps) => (
        <div
            data-testid="mock-bar-chart"
            data-labels={props.data?.labels?.join(",")}
            data-values={props.data?.datasets?.[0]?.data?.join(",")}
        />
    ),
    Line: (props: MockChartProps) => (
        <div
            data-testid="mock-line-chart"
            data-labels={props.data?.labels?.join(",")}
            data-datasets-count={props.data?.datasets?.length || 0}
            data-dataset-labels={props.data?.datasets?.map((d: any) => d.label).join(",")}
            data-values={props.data?.datasets?.[0]?.data?.join(",")}
        />
    ),
    Pie: (props: MockChartProps) => (
        <div
            data-testid="mock-pie-chart"
            data-labels={props.data?.labels?.join(",")}
        />
    ),
}));

vi.mock("../SankeyChart", () => ({
    default: () => <div data-testid="mock-sankey-chart" />,
}));

beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
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

describe("New Análisis Tab Features", () => {
    const sampleData = [
        // Abril 2026
        ["tx-1", "10/04/2026", "Egreso", "Comunes", "Mercadería", 50000, "", ""],
        ["tx-2", "15/04/2026", "Egreso", "Habitacionales", "Alquiler", 100000, "", ""],
        ["tx-3", "20/04/2026", "Egreso", "Puntuales", "Ropa", 80000, "", ""], // Should be EXCLUDED from costo de vida!
        // Mayo 2026
        ["tx-4", "10/05/2026", "Egreso", "Comunes", "Mercadería", 60000, "", ""],
        ["tx-5", "12/05/2026", "Egreso", "Ocio", "Salida", 20000, "", ""],
        // Junio 2026
        ["tx-6", "05/06/2026", "Egreso", "Comunes", "Limpieza", 30000, "", ""],
        ["tx-7", "20/06/2026", "Egreso", "Puntuales", "Bicicleta", 150000, "", ""], // Should be EXCLUDED!
        // Julio 2026
        ["tx-8", "08/07/2026", "Egreso", "Habitacionales", "Expensas", 40000, "", ""],
        // Agosto 2026
        ["tx-9", "12/08/2026", "Egreso", "Comunes", "Delivery", 25000, "", ""],
        // Septiembre 2026
        ["tx-10", "01/09/2026", "Egreso", "Comunes", "Mercadería", 70000, "", ""],
        ["tx-11", "02/09/2026", "Ingreso", "Salario", "Blanco", 300000, "", ""],
        ["tx-12", "03/09/2026", "Ahorro", "Aporte", "Fondo de Emergencia", 45000, "", ""],
        ["tx-13", "04/09/2026", "Inversión", "Activos Financieros", "Cedears", 55000, "", ""],
    ];

    describe("1. Costo de Vida Bar Chart (sin gastos puntuales)", () => {
        it("strictly excludes expenses in the Puntuales category and computes 6-month monthly sums", () => {
            render(<CostoVidaBarChart data={sampleData} isDark={false} />);

            const card = screen.getByTestId("card-costo-vida");
            expect(card).toBeDefined();
            expect(screen.getByText(/Costo de Vida \(Últimos 6 meses\)/i)).toBeDefined();
            expect(screen.getByText(/Excluye categoría Puntuales/i)).toBeDefined();

            const barChart = screen.getByTestId("mock-bar-chart");
            expect(barChart).toBeDefined();

            // Abril to Septiembre 2026 = 6 months
            const labels = barChart.getAttribute("data-labels");
            expect(labels).toContain("Abr 26");
            expect(labels).toContain("Sep 26");

            // Check values:
            // Abr: 50k (Comunes) + 100k (Habitacionales) = 150000 (excluding 80k Puntuales!)
            // May: 60k + 20k = 80000
            // Jun: 30k (excluding 150k Puntuales!) = 30000
            // Jul: 40k = 40000
            // Ago: 25k = 25000
            // Sep: 70k = 70000
            const values = barChart.getAttribute("data-values")?.split(",");
            expect(values).toEqual(["150000", "80000", "30000", "40000", "25000", "70000"]);

            // Total 6 months: 150k + 80k + 30k + 40k + 25k + 70k = 395000
            expect(card.textContent).toContain("$ 395.000,00");
            // Average over 6 active months: 395000 / 6 = 65833.33
            expect(card.textContent).toContain("$ 65.833,33");
        });

        it("renders graceful empty state when there are no expenses or data is empty", () => {
            render(<CostoVidaBarChart data={[]} isDark={false} />);
            expect(screen.getByText(/No hay suficientes registros de egresos/i)).toBeDefined();
        });

        it("correctly anchors the 6-month window to the latest month even if it only contains Puntual expenses or Ingresos", () => {
            // Data where September 2026 has ONLY Puntuales (laptop), and earlier months have normal expenses
            const dataWithPuntualLatest = [
                ["tx-1", "10/04/2026", "Egreso", "Comunes", "Mercadería", 50000, "", ""],
                ["tx-2", "15/05/2026", "Egreso", "Comunes", "Mercadería", 60000, "", ""],
                ["tx-3", "15/06/2026", "Egreso", "Comunes", "Mercadería", 70000, "", ""],
                ["tx-4", "15/07/2026", "Egreso", "Comunes", "Mercadería", 80000, "", ""],
                ["tx-5", "15/08/2026", "Egreso", "Comunes", "Mercadería", 90000, "", ""],
                ["tx-6", "25/09/2026", "Egreso", "Puntuales", "Notebook", 500000, "", ""], // Only puntual in Sep!
            ];

            render(<CostoVidaBarChart data={dataWithPuntualLatest} isDark={false} />);
            const barChart = screen.getByTestId("mock-bar-chart");
            expect(barChart).toBeDefined();

            // The window MUST end at Sep 26 (with Sep 26 having 0 non-puntual cost)
            const labels = barChart.getAttribute("data-labels");
            expect(labels).toContain("Sep 26");
            expect(labels).toContain("Abr 26");

            const values = barChart.getAttribute("data-values")?.split(",");
            // Abr: 50k, May: 60k, Jun: 70k, Jul: 80k, Ago: 90k, Sep: 0 (500k notebook excluded!)
            expect(values).toEqual(["50000", "60000", "70000", "80000", "90000", "0"]);
        });
    });

    describe("2. Single Category / Subcategory Line Chart", () => {
        const groupedCompItems = [
            { category: "Comunes", subCategories: ["Mercadería", "Limpieza", "Delivery"] },
            { category: "Habitacionales", subCategories: ["Alquiler", "Expensas"] },
        ];
        const subCatToCatMap = { Mercadería: "Comunes", Limpieza: "Comunes", Delivery: "Comunes", Alquiler: "Habitacionales", Expensas: "Habitacionales" };
        const itemTypeMap = { Comunes: "Egreso", Habitacionales: "Egreso" };
        const dynamicColorMap = { Comunes: "#f59e0b", Habitacionales: "#e0726b" };

        it("renders line chart for default category and allows switching to a subcategory", () => {
            render(
                <SingleCategoryLineChart
                    data={sampleData}
                    analysisPeriod="Total"
                    isDark={false}
                    groupedCompItems={groupedCompItems}
                    subCatToCatMap={subCatToCatMap}
                    itemTypeMap={itemTypeMap}
                    dynamicColorMap={dynamicColorMap}
                />
            );

            const card = screen.getByTestId("card-linea-categoria");
            expect(card).toBeDefined();
            expect(screen.getByText(/Evolución por Categoría o Subcategoría/i)).toBeDefined();

            const select = screen.getByLabelText(/Seleccionar categoría o subcategoría/i) as HTMLSelectElement;
            expect(select.value).toBe("Comunes");

            // Comunes total across all sampleData: 50k + 60k + 30k + 25k + 70k = 235000 in 5 movements
            expect(card.textContent).toContain("$ 235.000,00");
            expect(card.textContent).toContain("5 movimientos");

            // Switch to Mercadería subcategory
            fireEvent.change(select, { target: { value: "Mercadería" } });
            expect(select.value).toBe("Mercadería");

            // Mercadería total: 50k (Abr) + 60k (May) + 70k (Sep) = 180000 in 3 movements
            expect(card.textContent).toContain("$ 180.000,00");
            expect(card.textContent).toContain("3 movimientos");
        });

        it("shows empty state when selected item has no transactions in the period", () => {
            render(
                <SingleCategoryLineChart
                    data={[]}
                    analysisPeriod="Total"
                    isDark={false}
                    groupedCompItems={groupedCompItems}
                    subCatToCatMap={subCatToCatMap}
                    itemTypeMap={itemTypeMap}
                    dynamicColorMap={dynamicColorMap}
                />
            );

            expect(screen.getByText(/No hay movimientos registrados para/i)).toBeDefined();
        });

        it("strictly sorts x-axis labels chronologically even when data rows are in reverse or jumbled date order", () => {
            // Rows deliberately out of chronological order
            const jumbledData = [
                ["tx-a", "28/09/2026", "Egreso", "Comunes", "Mercadería", 5000, "", ""],
                ["tx-b", "02/09/2026", "Egreso", "Comunes", "Mercadería", 1000, "", ""],
                ["tx-c", "15/09/2026", "Egreso", "Comunes", "Mercadería", 3000, "", ""],
                ["tx-d", "08/09/2026", "Egreso", "Comunes", "Mercadería", 2000, "", ""],
            ];

            render(
                <SingleCategoryLineChart
                    data={jumbledData}
                    analysisPeriod="09/2026"
                    isDark={false}
                    groupedCompItems={groupedCompItems}
                    subCatToCatMap={subCatToCatMap}
                    itemTypeMap={itemTypeMap}
                    dynamicColorMap={dynamicColorMap}
                />
            );

            const lineChart = screen.getByTestId("mock-line-chart");
            expect(lineChart).toBeDefined();

            const labels = lineChart.getAttribute("data-labels")?.split(",");
            // Must be strictly chronological from oldest to newest: 02/09, 08/09, 15/09, 28/09
            expect(labels).toEqual(["02/09/2026", "08/09/2026", "15/09/2026", "28/09/2026"]);

            const values = lineChart.getAttribute("data-values")?.split(",");
            expect(values).toEqual(["1000", "2000", "3000", "5000"]);
        });

        it("renders clean select labels without decorative emojis per GEMINI.md rule 2", () => {
            render(
                <SingleCategoryLineChart
                    data={sampleData}
                    analysisPeriod="Total"
                    isDark={false}
                    groupedCompItems={groupedCompItems}
                    subCatToCatMap={subCatToCatMap}
                    itemTypeMap={itemTypeMap}
                    dynamicColorMap={dynamicColorMap}
                />
            );

            const select = screen.getByLabelText(/Seleccionar categoría o subcategoría/i);
            // Neither optgroups nor options should have 📁 or ↳
            expect(select.innerHTML).not.toContain("📁");
            expect(select.innerHTML).not.toContain("↳");
        });
    });

    describe("3. Category Distribution Card (matching reference image)", () => {
        it("renders range preset pills (3 meses, 6 meses, Todo) and displays category progress bars", () => {
            render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

            const card = screen.getByTestId("card-distribucion-categoria");
            expect(card).toBeDefined();
            expect(screen.getByText(/Distribución por categoría/i)).toBeDefined();

            // Check 3 presets
            expect(screen.getByRole("button", { name: "3 meses" })).toBeDefined();
            expect(screen.getByRole("button", { name: "6 meses" })).toBeDefined();
            expect(screen.getByRole("button", { name: "Todo" })).toBeDefined();

            // Total egresos in sampleData: 50k+100k+80k+60k+20k+30k+150k+40k+25k+70k = 625000 in 10 movements
            expect(card.textContent).toContain("$ 625.000,00 en 10 movimientos");

            // Categories visible in list
            const comunesRow = screen.getByTitle("Ver desglose de Comunes");
            expect(comunesRow).toBeDefined();
            expect(screen.getByTitle("Ver desglose de Puntuales")).toBeDefined();
            expect(screen.getByTitle("Ver desglose de Habitacionales")).toBeDefined();
            expect(screen.getByTitle("Ver desglose de Ocio")).toBeDefined();

            // Drill down into "Comunes" by clicking the row
            fireEvent.click(comunesRow);

            // After drill down, back button should appear
            expect(screen.getByText(/← Ver todas las categorías/i)).toBeDefined();

            // Subcategories under Comunes should be listed
            expect(screen.getByText("Mercadería")).toBeDefined();
            expect(screen.getByText("Limpieza")).toBeDefined();
            expect(screen.getByText("Delivery")).toBeDefined();

            // Click back button
            fireEvent.click(screen.getByText(/← Ver todas las categorías/i));
            expect(screen.getByTitle("Ver desglose de Comunes")).toBeDefined();
        });

        it("filters correctly when clicking 3 meses preset", () => {
            render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

            const btn3m = screen.getByRole("button", { name: "3 meses" });
            fireEvent.click(btn3m);

            // Last 3 months in sampleData are Jul, Ago, Sep 2026:
            // Jul: 40k (Habitacionales)
            // Ago: 25k (Comunes)
            // Sep: 70k (Comunes)
            // Total = 135000 in 3 movements
            const card = screen.getByTestId("card-distribucion-categoria");
            expect(card.textContent).toContain("$ 135.000,00 en 3 movimientos");
        });

        it("supports switching to Ahorros and Inversiones movement types", () => {
            render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

            const typeSelect = screen.getByLabelText(/Tipo de movimiento/i) as HTMLSelectElement;

            const card = screen.getByTestId("card-distribucion-categoria");

            // Switch to Ahorros
            fireEvent.change(typeSelect, { target: { value: "Ahorro" } });
            expect(typeSelect.value).toBe("Ahorro");
            // In sampleData: tx-12 has Ahorro / Aporte / Fondo de Emergencia 45000
            expect(screen.getAllByText("Aporte").length).toBeGreaterThanOrEqual(1);
            expect(card.textContent).toContain("45.000");

            // Switch to Inversiones
            fireEvent.change(typeSelect, { target: { value: "Inversión" } });
            expect(typeSelect.value).toBe("Inversión");
            // In sampleData: tx-13 has Inversión / Activos Financieros / Cedears 55000
            expect(screen.getAllByText("Activos Financieros").length).toBeGreaterThanOrEqual(1);
            expect(card.textContent).toContain("55.000");
        });

        it("supports keyboard drill-down using Enter key and renders timeline track", () => {
            render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

            // Timeline slider track must exist (matching reference image)
            const timelineTrack = screen.getByTestId("timeline-track");
            expect(timelineTrack).toBeDefined();

            // Category row keyboard drill-down
            const comunesRow = screen.getByTitle("Ver desglose de Comunes");
            fireEvent.keyDown(comunesRow, { key: "Enter", code: "Enter" });

            // Should be drilled down into Comunes
            expect(screen.getByText(/← Ver todas las categorías/i)).toBeDefined();
            expect(screen.getByText("Mercadería")).toBeDefined();
        });

        it("supports custom date range via Personalizado button", () => {
            render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

            const customBtn = screen.getByRole("button", { name: /Personalizado/i });
            fireEvent.click(customBtn);

            const fromInput = screen.getByLabelText(/Desde:/i) as HTMLInputElement;
            const toInput = screen.getByLabelText(/Hasta:/i) as HTMLInputElement;
            expect(fromInput).toBeDefined();
            expect(toInput).toBeDefined();

            // Set custom range for Mayo only: 2026-05-01 to 2026-05-31
            fireEvent.change(fromInput, { target: { value: "2026-05-01" } });
            fireEvent.change(toInput, { target: { value: "2026-05-31" } });

            // Mayo egresos in sampleData: tx-4 (60k) + tx-5 (20k) = 80000 in 2 movements
            const card = screen.getByTestId("card-distribucion-categoria");
            expect(card.textContent).toContain("$ 80.000,00 en 2 movimientos");
        });
    });

    describe("4. Balance General with Ahorro and Inversión", () => {
        it("displays Ahorro and Inversión rows in Balance General when present in the period", async () => {
            // Mock fetch for DashboardData
            const originalFetch = global.fetch;
            global.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes("/api/init")) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            transactions: sampleData,
                            categories: [],
                            cuotas: [],
                            savingsGoals: [],
                        }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: sampleData }),
                });
            });

            render(<DashboardData />);

            // Switch to Análisis tab
            await waitFor(() => {
                expect(screen.getByRole("tab", { name: /análisis/i })).toBeDefined();
            });
            fireEvent.click(screen.getByRole("tab", { name: /análisis/i }));

            const balanceCard = screen.getByTestId("card-balance-general");
            expect(balanceCard).toBeDefined();

            // For September 2026 (the active month with tx-10, tx-11, tx-12, tx-13):
            // Ingresos: 300.000
            // Egresos: 70.000
            // Ahorros: 45.000 (with target emoji 🎯)
            // Inversiones: 55.000 (with chart emoji 📈)
            // Balance: 300k - 70k - 45k - 55k = 130.000
            expect(balanceCard.textContent).toContain("$ 300.000,00");
            expect(balanceCard.textContent).toContain("-$ 70.000,00");
            expect(balanceCard.textContent).toContain("Ahorros");
            expect(balanceCard.textContent).toContain("🎯 $ 45.000,00");
            expect(balanceCard.textContent).toContain("Inversiones");
            expect(balanceCard.textContent).toContain("📈 $ 55.000,00");
            expect(balanceCard.textContent).toContain("$ 130.000,00");

            global.fetch = originalFetch;
        });
    });
});

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CategoryDistributionCard from "../CategoryDistributionCard";
import DashboardData from "../DashboardData";

interface MockChartProps {
    data?: any;
    options?: any;
}

vi.mock("react-chartjs-2", () => ({
    Bar: (props: MockChartProps) => <div data-testid="mock-bar-chart" />,
    Line: (props: MockChartProps) => <div data-testid="mock-line-chart" />,
    Pie: (props: MockChartProps) => <div data-testid="mock-pie-chart" />,
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

describe("CategoryDistributionCard - In-situ Drill Down & Global Percentages", () => {
    const sampleData = [
        // Total egresos: 625.000 across 10 movements
        ["tx-1", "10/04/2026", "Egreso", "Comunes", "Mercadería", 50000, "", ""],
        ["tx-2", "15/04/2026", "Egreso", "Habitacionales", "Alquiler", 100000, "", ""],
        ["tx-3", "20/04/2026", "Egreso", "Puntuales", "Ropa", 80000, "", ""],
        ["tx-4", "10/05/2026", "Egreso", "Comunes", "Mercadería", 60000, "", ""],
        ["tx-5", "12/05/2026", "Egreso", "Ocio", "Salida", 20000, "", ""],
        ["tx-6", "05/06/2026", "Egreso", "Comunes", "Limpieza", 30000, "", ""],
        ["tx-7", "20/06/2026", "Egreso", "Puntuales", "Bicicleta", 150000, "", ""],
        ["tx-8", "08/07/2026", "Egreso", "Habitacionales", "Expensas", 40000, "", ""],
        ["tx-9", "12/08/2026", "Egreso", "Comunes", "Delivery", 25000, "", ""],
        ["tx-10", "01/09/2026", "Egreso", "Comunes", "Mercadería", 70000, "", ""],
        // Ingreso, Ahorro, Inversión
        ["tx-11", "02/09/2026", "Ingreso", "Salario", "Blanco", 300000, "", ""],
        ["tx-12", "03/09/2026", "Ahorro", "Aporte", "Fondo de Emergencia", 45000, "", ""],
        ["tx-13", "04/09/2026", "Inversión", "Activos Financieros", "Cedears", 55000, "", ""],
    ];

    it("drills down into a category WITHOUT hiding the other categories", () => {
        render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

        const card = screen.getByTestId("card-distribucion-categoria");
        expect(card).toBeDefined();

        // Initial check: all 4 categories exist
        expect(screen.getByTitle("Ver desglose de Comunes")).toBeDefined();
        expect(screen.getByTitle("Ver desglose de Habitacionales")).toBeDefined();
        expect(screen.getByTitle("Ver desglose de Puntuales")).toBeDefined();
        expect(screen.getByTitle("Ver desglose de Ocio")).toBeDefined();

        // Click Comunes to drill down
        const comunesRow = screen.getByTitle("Ver desglose de Comunes");
        fireEvent.click(comunesRow);

        // Subcategories of Comunes appear
        expect(screen.getByText("Mercadería")).toBeDefined();
        expect(screen.getByText("Limpieza")).toBeDefined();
        expect(screen.getByText("Delivery")).toBeDefined();

        // CRITICAL REQUIREMENT: "que no desaparezca el resto"
        // Other categories must still be present!
        expect(screen.getByTitle("Ver desglose de Habitacionales")).toBeDefined();
        expect(screen.getByTitle("Ver desglose de Puntuales")).toBeDefined();
        expect(screen.getByTitle("Ver desglose de Ocio")).toBeDefined();

        // Toggling Comunes again collapses it
        fireEvent.click(screen.getByTitle("Contraer desglose de Comunes"));
        expect(screen.queryByText("Limpieza")).toBeNull();
        expect(screen.queryByText("Delivery")).toBeNull();
        expect(screen.getByTitle("Ver desglose de Habitacionales")).toBeDefined();
    });

    it("strictly computes subcategory percentages relative to the overall total (user example: 20% cat with 50/50 subcats = 10% each)", () => {
        // Mock dataset matching the user prompt's exact mathematical example:
        // Total = 1000. Cat A = 200 (20%). Cat B = 800 (80%).
        // Cat A has 2 subcategories of 100 each (50% of Cat A).
        // Percentage of each subcategory must be 10% (100 / 1000 = 10%).
        const promptExampleData = [
            ["tx-1", "01/01/2026", "Egreso", "CategoriaA", "Sub1", 100, "", ""],
            ["tx-2", "02/01/2026", "Egreso", "CategoriaA", "Sub2", 100, "", ""],
            ["tx-3", "03/01/2026", "Egreso", "CategoriaB", "Otros", 800, "", ""],
        ];

        render(<CategoryDistributionCard data={promptExampleData} dynamicColorMap={{}} />);

        // Click CategoriaA to expand
        const catARow = screen.getByTitle("Ver desglose de CategoriaA");
        fireEvent.click(catARow);

        // CategoriaA row should show 20%
        expect(catARow.textContent).toContain("20%");

        // Subcategories Sub1 and Sub2 should each show 10% (NOT 50%!)
        const sub1Text = screen.getByText("Sub1").closest("[class*='subcategoryRow']")?.textContent;
        const sub2Text = screen.getByText("Sub2").closest("[class*='subcategoryRow']")?.textContent;

        expect(sub1Text).toContain("10%");
        expect(sub2Text).toContain("10%");

        // And CategoriaB is still visible
        expect(screen.getByTitle("Ver desglose de CategoriaB")).toBeDefined();
    });

    it("verifies subcategory percentages in sampleData sum up to category percentage of overall total", () => {
        render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

        // Expand Comunes: total = 625.000.
        // Mercadería = 70k + 60k + 50k = 180k -> 180k / 625k = 28.8% -> 29%
        // Limpieza = 30k -> 30k / 625k = 4.8% -> 5%
        // Delivery = 25k -> 25k / 625k = 4%
        // Total Comunes = 180 + 30 + 25 = 235k / 625k = 37.6% -> 38%
        const comunesRow = screen.getByTitle("Ver desglose de Comunes");
        fireEvent.click(comunesRow);

        expect(comunesRow.textContent).toContain("38%");

        const mercaderiaText = screen.getByText("Mercadería").closest("[class*='subcategoryRow']")?.textContent;
        const limpiezaText = screen.getByText("Limpieza").closest("[class*='subcategoryRow']")?.textContent;
        const deliveryText = screen.getByText("Delivery").closest("[class*='subcategoryRow']")?.textContent;

        expect(mercaderiaText).toContain("29%");
        expect(limpiezaText).toContain("5%");
        expect(deliveryText).toContain("4%");
        // 29 + 5 + 4 = 38%!
    });
});

describe("CategoryDistributionCard - Interactive Draggable Range Slider", () => {
    const sampleData = [
        ["tx-1", "01/01/2026", "Egreso", "Comunes", "Super", 10000, "", ""],
        ["tx-2", "01/03/2026", "Egreso", "Comunes", "Super", 20000, "", ""],
        ["tx-3", "01/06/2026", "Egreso", "Comunes", "Super", 30000, "", ""],
        ["tx-4", "01/09/2026", "Egreso", "Comunes", "Super", 40000, "", ""],
        ["tx-5", "01/12/2026", "Egreso", "Comunes", "Super", 50000, "", ""],
    ];

    it("renders dual handles with accessible slider roles and attributes", () => {
        render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

        const startHandle = screen.getByRole("slider", { name: /fecha desde/i });
        const endHandle = screen.getByRole("slider", { name: /fecha hasta/i });

        expect(startHandle).toBeDefined();
        expect(endHandle).toBeDefined();

        expect(startHandle.getAttribute("aria-valuemin")).toBe("0");
        expect(startHandle.getAttribute("aria-valuemax")).toBe("100");
        expect(endHandle.getAttribute("aria-valuemin")).toBe("0");
        expect(endHandle.getAttribute("aria-valuemax")).toBe("100");
    });

    it("allows dragging the start handle with pointer events, switching to custom range", () => {
        render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

        const track = screen.getByTestId("timeline-track");
        // Mock getBoundingClientRect
        vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
            left: 0,
            top: 0,
            right: 1000,
            bottom: 20,
            width: 1000,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
        });

        const startHandle = screen.getByRole("slider", { name: /fecha desde/i });

        // Start drag on startHandle at x = 0
        fireEvent.pointerDown(startHandle, { clientX: 0, pointerId: 1 });

        // Drag to 50% (x = 500)
        fireEvent.pointerMove(startHandle, { clientX: 500, pointerId: 1 });

        // Release drag
        fireEvent.pointerUp(startHandle, { pointerId: 1 });

        // Preset button "Personalizado" should now be active
        const customBtn = screen.getByRole("button", { name: "Personalizado" });
        expect(customBtn.className).toContain("activePill");

        // The date inputs should be visible and customFrom set to ~mid year (around June 2026)
        const fromInput = screen.getByLabelText(/desde:/i) as HTMLInputElement;
        expect(fromInput.value).toContain("2026-06");
    });

    it("supports mobile touch dragging via touch pointerType", () => {
        render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

        const track = screen.getByTestId("timeline-track");
        vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
            left: 100,
            top: 50,
            right: 1100,
            bottom: 70,
            width: 1000,
            height: 20,
            x: 100,
            y: 50,
            toJSON: () => {},
        });

        const endHandle = screen.getByRole("slider", { name: /fecha hasta/i });

        // Touch down on end handle
        fireEvent.pointerDown(endHandle, {
            clientX: 1100,
            pointerId: 2,
            pointerType: "touch",
        });

        // Touch drag left to 300px (20% of track)
        fireEvent.pointerMove(endHandle, {
            clientX: 300,
            pointerId: 2,
            pointerType: "touch",
        });

        // Touch up
        fireEvent.pointerUp(endHandle, { pointerId: 2, pointerType: "touch" });

        // End date should be around March 2026
        const toInput = screen.getByLabelText(/hasta:/i) as HTMLInputElement;
        expect(toInput.value).toContain("2026-03");
    });

    it("adjusts slider handle via keyboard Arrow keys", () => {
        render(<CategoryDistributionCard data={sampleData} dynamicColorMap={{}} />);

        const track = screen.getByTestId("timeline-track");
        vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
            left: 0,
            top: 0,
            right: 1000,
            bottom: 20,
            width: 1000,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
        });

        const startHandle = screen.getByRole("slider", { name: /fecha desde/i });

        // Press ArrowRight to move start date forward
        fireEvent.keyDown(startHandle, { key: "ArrowRight", code: "ArrowRight" });

        // Mode switches to custom
        expect(screen.getByRole("button", { name: "Personalizado" }).className).toContain("activePill");
    });

    it("preserves the preset start date when dragging the end handle from 3m preset (prevents jump to minIso)", () => {
        // Multi-year data from 2024 to 2026
        const multiYearData = [
            ["tx-0", "01/01/2024", "Egreso", "Comunes", "Old", 10000, "", ""], // minIso: 2024-01-01
            ["tx-1", "01/06/2026", "Egreso", "Comunes", "Super", 20000, "", ""],
            ["tx-2", "15/07/2026", "Egreso", "Comunes", "Super", 30000, "", ""],
            ["tx-3", "10/08/2026", "Egreso", "Comunes", "Super", 40000, "", ""],
            ["tx-4", "20/09/2026", "Egreso", "Comunes", "Super", 50000, "", ""], // maxIso: 2026-09-20
        ];

        render(<CategoryDistributionCard data={multiYearData} dynamicColorMap={{}} />);

        // Switch to "3 meses" preset (Jul, Ago, Sep 2026)
        const btn3m = screen.getByRole("button", { name: "3 meses" });
        fireEvent.click(btn3m);

        const track = screen.getByTestId("timeline-track");
        vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
            left: 0,
            top: 0,
            right: 1000,
            bottom: 20,
            width: 1000,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
        });

        const endHandle = screen.getByRole("slider", { name: /fecha hasta/i });

        // Drag end handle slightly left (to ~85%)
        fireEvent.pointerDown(endHandle, { clientX: 950, pointerId: 10 });
        fireEvent.pointerMove(endHandle, { clientX: 850, pointerId: 10 });
        fireEvent.pointerUp(endHandle, { pointerId: 10 });

        // Crucial check: customFrom MUST NOT be 2024-01-01! It must be 2026-07-01 (the 3m cutoff start)
        const fromInput = screen.getByLabelText(/desde:/i) as HTMLInputElement;
        expect(fromInput.value).toBe("2026-07-01");
        expect(fromInput.value).not.toBe("2024-01-01");
    });

    it("correctly synchronizes selectedCategory dropdown when expanding and collapsing multiple categories", () => {
        const multiCatData = [
            ["tx-1", "01/09/2026", "Egreso", "Comunes", "Super", 10000, "", ""],
            ["tx-2", "02/09/2026", "Egreso", "Habitacionales", "Luz", 20000, "", ""],
            ["tx-3", "03/09/2026", "Egreso", "Ocio", "Cine", 5000, "", ""],
        ];

        render(<CategoryDistributionCard data={multiCatData} dynamicColorMap={{}} />);

        const catSelect = screen.getByLabelText(/filtrar por categoría/i) as HTMLSelectElement;
        expect(catSelect.value).toBe("ALL");

        // Click Comunes -> opens Comunes, select becomes "Comunes"
        const comunesRow = screen.getByTitle("Ver desglose de Comunes");
        fireEvent.click(comunesRow);
        expect(catSelect.value).toBe("Comunes");

        // Click Habitacionales -> opens Habitacionales as well, select becomes "ALL" (multiple expanded)
        const habRow = screen.getByTitle("Ver desglose de Habitacionales");
        fireEvent.click(habRow);
        expect(catSelect.value).toBe("ALL");

        // Collapse Habitacionales -> Comunes is still open! Select should reflect "Comunes"
        fireEvent.click(screen.getByTitle("Contraer desglose de Habitacionales"));
        expect(catSelect.value).toBe("Comunes");
        expect(screen.getByText("Super")).toBeDefined();
    });
});

describe("DashboardData - Balance General Structure & Naming", () => {
    const sampleFinancialData = [
        ["tx-1", "01/09/2026", "Ingreso", "Salario", "Sueldo", 500000, "", ""],
        ["tx-2", "05/09/2026", "Egreso", "Alquiler", "Casa", 200000, "", ""],
        ["tx-3", "10/09/2026", "Ahorro", "Aporte", "Metas", 50000, "", ""],
        ["tx-4", "15/09/2026", "Inversión", "Cedears", "SPY", 100000, "", ""],
    ];

    it("displays standard accounting balance: Ingresos, Egresos -> Resultado Operativo, then Ahorro, Inversión -> Saldo Disponible (Resto)", async () => {
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("/api/init")) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            transactions: sampleFinancialData,
                            categories: [],
                            cuotas: [],
                            savingsGoals: [],
                        }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: sampleFinancialData }),
            });
        });

        render(<DashboardData />);

        await waitFor(() => {
            expect(screen.getByRole("tab", { name: /análisis/i })).toBeDefined();
        });
        fireEvent.click(screen.getByRole("tab", { name: /análisis/i }));

        const balanceCard = screen.getByTestId("card-balance-general");
        expect(balanceCard).toBeDefined();

        // 1. Ingresos: $ 500.000,00
        expect(balanceCard.textContent).toContain("Ingresos");
        expect(balanceCard.textContent).toContain("$ 500.000,00");

        // 2. Egresos: -$ 200.000,00
        expect(balanceCard.textContent).toContain("Egresos");
        expect(balanceCard.textContent).toContain("-$ 200.000,00");

        // 3. Subtotal: Resultado Operativo = 500k - 200k = 300.000,00 ("cuánta plata efectivamente gano")
        expect(balanceCard.textContent).toContain("Resultado Operativo");
        expect(balanceCard.textContent).toContain("$ 300.000,00");

        // 4. Ahorros: 🎯 $ 50.000,00
        expect(balanceCard.textContent).toContain("Ahorros");
        expect(balanceCard.textContent).toContain("🎯 $ 50.000,00");

        // 5. Inversiones: 📈 $ 100.000,00
        expect(balanceCard.textContent).toContain("Inversiones");
        expect(balanceCard.textContent).toContain("📈 $ 100.000,00");

        // 6. Resto / Saldo Disponible = 300k - 50k - 100k = 150.000,00 ("cuánta queda disponible o líquida")
        expect(balanceCard.textContent).toContain("Saldo Disponible (Resto)");
        expect(balanceCard.textContent).toContain("$ 150.000,00");

        global.fetch = originalFetch;
    });

    it("displays negative savings (withdrawals) and investment liquidations accurately without hiding them", async () => {
        // Data with a savings withdrawal: Category contains 'retiro'
        const withdrawalData = [
            ["tx-1", "01/09/2026", "Ingreso", "Salario", "Sueldo", 200000, "", ""],
            ["tx-2", "05/09/2026", "Egreso", "Alquiler", "Casa", 150000, "", ""],
            ["tx-3", "10/09/2026", "Ahorro", "Retiro de Ahorro", "Emergencia", 50000, "", ""], // Retiro -> a = -50k, b increases by 50k
        ];

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("/api/init")) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            transactions: withdrawalData,
                            categories: [],
                            cuotas: [],
                            savingsGoals: [],
                        }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: withdrawalData }),
            });
        });

        render(<DashboardData />);

        await waitFor(() => {
            expect(screen.getByRole("tab", { name: /análisis/i })).toBeDefined();
        });
        fireEvent.click(screen.getByRole("tab", { name: /análisis/i }));

        const balanceCard = screen.getByTestId("card-balance-general");

        // Resultado Operativo = 200k - 150k = 50.000
        expect(balanceCard.textContent).toContain("Resultado Operativo");
        expect(balanceCard.textContent).toContain("$ 50.000,00");

        // Ahorros should show -$ 50.000,00 (NOT $ 0,00!)
        expect(balanceCard.textContent).toContain("-$ 50.000,00");

        // Saldo Disponible = 50.000 - (-50.000) = 100.000,00
        expect(balanceCard.textContent).toContain("$ 100.000,00");

        global.fetch = originalFetch;
    });

    it("displays percentage values for each row in Balance General with 100% as ingresos and matching colors", async () => {
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("/api/init")) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            transactions: sampleFinancialData,
                            categories: [],
                            cuotas: [],
                            savingsGoals: [],
                        }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: sampleFinancialData }),
            });
        });

        render(<DashboardData />);

        await waitFor(() => {
            expect(screen.getByRole("tab", { name: /análisis/i })).toBeDefined();
        });
        fireEvent.click(screen.getByRole("tab", { name: /análisis/i }));

        const balanceCard = screen.getByTestId("card-balance-general");

        // Ingresos: 500k -> 100%
        expect(balanceCard.textContent).toContain("$ 500.000,00 (100%)");

        // Egresos: 200k -> 40% (200k / 500k)
        expect(balanceCard.textContent).toContain("-$ 200.000,00 (40%)");

        // Resultado Operativo: 300k -> 60% (300k / 500k)
        expect(balanceCard.textContent).toContain("$ 300.000,00 (60%)");

        // Ahorros: 50k -> 10% (50k / 500k)
        expect(balanceCard.textContent).toContain("🎯 $ 50.000,00 (10%)");

        // Inversiones: 100k -> 20% (100k / 500k)
        expect(balanceCard.textContent).toContain("📈 $ 100.000,00 (20%)");

        // Saldo Disponible (Resto): 150k -> 30% (150k / 500k)
        expect(balanceCard.textContent).toContain("$ 150.000,00 (30%)");

        // Verify color consistency: each percentage span is nested within the colored container
        const incomeValueSpan = balanceCard.querySelector("[class*='successText']");
        expect(incomeValueSpan).not.toBeNull();
        expect(incomeValueSpan!.textContent).toContain("(100%)");

        const expenseValueSpan = balanceCard.querySelector("[class*='dangerText']");
        expect(expenseValueSpan).not.toBeNull();
        expect(expenseValueSpan!.textContent).toContain("(40%)");

        global.fetch = originalFetch;
    });

    it("handles zero income scenario safely displaying 0% fallback without NaN or error", async () => {
        const zeroIncomeData = [
            ["tx-1", "01/09/2026", "Egreso", "Alquiler", "Casa", 100000, "", ""],
        ];

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("/api/init")) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            transactions: zeroIncomeData,
                            categories: [],
                            cuotas: [],
                            savingsGoals: [],
                        }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: zeroIncomeData }),
            });
        });

        render(<DashboardData />);

        await waitFor(() => {
            expect(screen.getByRole("tab", { name: /análisis/i })).toBeDefined();
        });
        fireEvent.click(screen.getByRole("tab", { name: /análisis/i }));

        const balanceCard = screen.getByTestId("card-balance-general");

        // Ingresos is 0 -> 0%
        expect(balanceCard.textContent).toContain("$ 0,00 (0%)");

        // Egresos: 100k -> 0% fallback when base <= 0
        expect(balanceCard.textContent).toContain("-$ 100.000,00 (0%)");

        // No NaN should appear anywhere in the balance card
        expect(balanceCard.textContent).not.toContain("NaN");

        global.fetch = originalFetch;
    });
});

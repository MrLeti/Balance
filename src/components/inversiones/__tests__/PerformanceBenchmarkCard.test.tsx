import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PerformanceBenchmarkCard from "../PerformanceBenchmarkCard";
import type { InvestmentTransaction } from "@/lib/utils/investments";

// Mock react-chartjs-2 Line chart
vi.mock("react-chartjs-2", () => ({
    Line: (props: any) => (
        <div
            data-testid="mock-line-chart"
            data-labels={props.data?.labels?.join(",")}
            data-datasets-count={props.data?.datasets?.length || 0}
            data-dataset-labels={props.data?.datasets?.map((d: any) => d.label).join(" | ")}
            data-points={props.data?.datasets?.[0]?.data?.join(",")}
            data-point-colors={props.data?.datasets?.[0]?.pointBackgroundColor?.join(",")}
        />
    ),
}));

describe("PerformanceBenchmarkCard", () => {
    const sampleTransactions: InvestmentTransaction[] = [
        {
            id: "tx-1",
            date: "01/01/2024",
            type: "Compra",
            asset: "AAPL",
            assetType: "Cedears",
            quantity: 10,
            unitPrice: 150,
            commission: 0,
            cartera: "General",
            currency: "USD",
        },
        {
            id: "tx-2",
            date: "15/02/2024",
            type: "Compra",
            asset: "BTC",
            assetType: "Cripto",
            quantity: 0.1,
            unitPrice: 50000,
            commission: 0,
            cartera: "Cripto",
            currency: "USD",
        },
        {
            id: "tx-3",
            date: "10/03/2024",
            type: "Venta",
            asset: "AAPL",
            assetType: "Cedears",
            quantity: 5,
            unitPrice: 180,
            commission: 0,
            cartera: "General",
            currency: "USD",
        },
    ];

    const samplePrices = {
        AAPL: 190,
        BTC: 65000,
    };

    const sampleBenchmarks = {
        sp500: [
            { date: "2024-01-01", price: 470, timestamp: new Date("2024-01-01").getTime() / 1000 },
            { date: "2024-02-15", price: 500, timestamp: new Date("2024-02-15").getTime() / 1000 },
            { date: "2024-03-10", price: 510, timestamp: new Date("2024-03-10").getTime() / 1000 },
        ],
        ccl: [
            { date: "2024-01-01", rate: 900 },
            { date: "2024-02-15", rate: 1050 },
            { date: "2024-03-10", rate: 1100 },
        ],
        inflation: [
            { date: "2024-01-01", rate: 20.6 },
            { date: "2024-02-01", rate: 13.2 },
            { date: "2024-03-01", rate: 11.0 },
        ],
    };

    it("renders scope selector with All, Asset Classes, and Individual Assets", () => {
        render(
            <PerformanceBenchmarkCard
                transactions={sampleTransactions}
                activePrices={samplePrices}
                displayCurrency="USD"
                cclRate={1100}
                mepRate={1050}
                benchmarkData={sampleBenchmarks}
            />
        );

        const select = screen.getByLabelText(/alcance del rendimiento/i) as HTMLSelectElement;
        expect(select).toBeDefined();

        // Check options
        const options = Array.from(select.querySelectorAll("option")).map(o => o.value);
        expect(options).toContain("all");
        expect(options).toContain("type:Cedears");
        expect(options).toContain("type:Cripto");
        expect(options).toContain("asset:AAPL");
        expect(options).toContain("asset:BTC");
    });

    it("allows changing scope to a specific asset type and updates chart labels", () => {
        render(
            <PerformanceBenchmarkCard
                transactions={sampleTransactions}
                activePrices={samplePrices}
                displayCurrency="USD"
                cclRate={1100}
                mepRate={1050}
                benchmarkData={sampleBenchmarks}
            />
        );

        const select = screen.getByLabelText(/alcance del rendimiento/i);
        fireEvent.change(select, { target: { value: "type:Cedears" } });

        const chart = screen.getByTestId("mock-line-chart");
        expect(chart.getAttribute("data-dataset-labels")).toContain("Cedears");
    });

    it("allows changing scope to a specific asset", () => {
        render(
            <PerformanceBenchmarkCard
                transactions={sampleTransactions}
                activePrices={samplePrices}
                displayCurrency="USD"
                cclRate={1100}
                mepRate={1050}
                benchmarkData={sampleBenchmarks}
            />
        );

        const select = screen.getByLabelText(/alcance del rendimiento/i);
        fireEvent.change(select, { target: { value: "asset:BTC" } });

        const chart = screen.getByTestId("mock-line-chart");
        expect(chart.getAttribute("data-dataset-labels")).toContain("BTC");
    });

    it("toggles benchmark datasets when clicking chips", () => {
        render(
            <PerformanceBenchmarkCard
                transactions={sampleTransactions}
                activePrices={samplePrices}
                displayCurrency="ARS"
                cclRate={1100}
                mepRate={1050}
                benchmarkData={sampleBenchmarks}
            />
        );

        const spBtn = screen.getByRole("button", { name: /s&p 500/i });
        const cclBtn = screen.getByRole("button", { name: /dólar ccl/i });
        const infBtn = screen.getByRole("button", { name: /inflación/i });

        // By default all are enabled
        let chart = screen.getByTestId("mock-line-chart");
        expect(chart.getAttribute("data-dataset-labels")).toContain("S&P 500");
        expect(chart.getAttribute("data-dataset-labels")).toContain("Dólar CCL");
        expect(chart.getAttribute("data-dataset-labels")).toContain("Inflación");

        // Toggle S&P 500 off
        fireEvent.click(spBtn);
        chart = screen.getByTestId("mock-line-chart");
        expect(chart.getAttribute("data-dataset-labels")).not.toContain("S&P 500");

        // Toggle CCL off
        fireEvent.click(cclBtn);
        chart = screen.getByTestId("mock-line-chart");
        expect(chart.getAttribute("data-dataset-labels")).not.toContain("Dólar CCL");

        // Toggle Inflation off
        fireEvent.click(infBtn);
        chart = screen.getByTestId("mock-line-chart");
        expect(chart.getAttribute("data-dataset-labels")).not.toContain("Inflación");
    });

    it("renders green and red point markers for purchases and sales", () => {
        render(
            <PerformanceBenchmarkCard
                transactions={sampleTransactions}
                activePrices={samplePrices}
                displayCurrency="USD"
                cclRate={1100}
                mepRate={1050}
                benchmarkData={sampleBenchmarks}
            />
        );

        const chart = screen.getByTestId("mock-line-chart");
        const pointColors = chart.getAttribute("data-point-colors");
        // Must contain green (#22c55e) for buy and red (#ef4444) for sell
        expect(pointColors).toContain("#22c55e");
        expect(pointColors).toContain("#ef4444");
    });

    it("handles empty transactions gracefully", () => {
        render(
            <PerformanceBenchmarkCard
                transactions={[]}
                activePrices={{}}
                displayCurrency="USD"
                cclRate={1100}
                mepRate={1050}
                benchmarkData={{}}
            />
        );

        expect(screen.getByText(/no se encontraron operaciones registradas/i)).toBeDefined();
    });

    it("filters history according to lowercase dateRangePreset and custom dates", () => {
        const { rerender } = render(
            <PerformanceBenchmarkCard
                transactions={sampleTransactions}
                activePrices={samplePrices}
                displayCurrency="USD"
                cclRate={1100}
                mepRate={1050}
                benchmarkData={sampleBenchmarks}
                dateRangePreset="all"
            />
        );

        let chart = screen.getByTestId("mock-line-chart");
        const allLabels = chart.getAttribute("data-labels");
        expect(allLabels).toBeDefined();

        // Rerender with custom date range
        rerender(
            <PerformanceBenchmarkCard
                transactions={sampleTransactions}
                activePrices={samplePrices}
                displayCurrency="USD"
                cclRate={1100}
                mepRate={1050}
                benchmarkData={sampleBenchmarks}
                dateRangePreset="custom"
                customDateFrom="2024-02-01"
                customDateTo="2024-03-15"
            />
        );

        chart = screen.getByTestId("mock-line-chart");
        const customLabels = chart.getAttribute("data-labels") || "";
        // 01/01/2024 is before 2024-02-01, so it shouldn't be included directly (anchor point is 01/02/2024)
        expect(customLabels).toContain("15/02/2024");
        expect(customLabels).toContain("10/03/2024");
        expect(customLabels).not.toContain("01/01/2024");
    });
});

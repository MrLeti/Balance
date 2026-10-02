"use client";

import React, { useMemo, useState, useEffect } from "react";
import styles from "./SingleCategoryLineChart.module.css";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ScriptableContext,
    ChartOptions,
} from "chart.js";
import { Line as ReactChartJsLine } from "react-chartjs-2";
import { createVerticalGradient } from "@/lib/utils/chartGradients";
import { fmt, fmtCompact, parseSafeAmount, roundMoney } from "@/lib/utils/format";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const Line = ReactChartJsLine || ((props: any) => (
    <div
        data-testid="mock-line-chart"
        data-labels={props.data?.labels?.join(",")}
        data-datasets-count={props.data?.datasets?.length || 0}
    />
));

export interface GroupedItem {
    category: string;
    subCategories: string[];
}

export interface SingleCategoryLineChartProps {
    data: (string | number)[][];
    analysisPeriod?: string;
    isDark?: boolean;
    groupedCompItems: GroupedItem[];
    subCatToCatMap: Record<string, string>;
    itemTypeMap: Record<string, string>;
    dynamicColorMap: Record<string, string>;
}

export default function SingleCategoryLineChart({
    data = [],
    analysisPeriod = "Total",
    isDark = false,
    groupedCompItems = [],
    subCatToCatMap = {},
    itemTypeMap = {},
    dynamicColorMap = {},
}: SingleCategoryLineChartProps) {
    // Default selection: first available category or subcategory
    const [selectedItem, setSelectedItem] = useState<string>(() => {
        if (groupedCompItems.length > 0) {
            return groupedCompItems[0].category;
        }
        return "Comunes";
    });

    // Auto-select valid item if current selection isn't available
    useEffect(() => {
        if (groupedCompItems.length > 0) {
            const allItems = new Set<string>();
            groupedCompItems.forEach((g) => {
                allItems.add(g.category);
                g.subCategories.forEach((s) => allItems.add(s));
            });
            if (!allItems.has(selectedItem)) {
                setSelectedItem(groupedCompItems[0].category);
            }
        }
    }, [groupedCompItems, selectedItem]);

    const isMonthlyAggregated = analysisPeriod === "Total" || analysisPeriod.length === 4;

    const { chartPoints, totalAmount, movementCount, lineColor } = useMemo(() => {
        const pointsMap: Record<string, number> = {};
        let total = 0;
        let count = 0;

        const isKnownCategory = groupedCompItems.some((g) => g.category === selectedItem);

        data.forEach((row) => {
            if (!row || row.length < 6) return;
            const cat = String(row[3] || "").trim();
            const subCat = String(row[4] || "").trim();

            let isMatch = false;
            if (isKnownCategory) {
                isMatch = cat === selectedItem;
            } else if (subCatToCatMap[selectedItem]) {
                isMatch = subCat === selectedItem && cat === subCatToCatMap[selectedItem];
            } else {
                isMatch = cat === selectedItem || subCat === selectedItem;
            }
            if (!isMatch) return;

            const rawDate = String(row[1] || "").trim();
            const parts = rawDate.includes("/") ? rawDate.split("/") : rawDate.split("-");
            if (parts.length < 3) return;

            let day = 0;
            let month = 0;
            let year = 0;
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                day = parseInt(parts[2], 10);
            } else {
                // DD/MM/YYYY
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                year = parseInt(parts[2], 10);
            }

            if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12) return;

            const dayPad = String(day).padStart(2, "0");
            const monthPad = String(month).padStart(2, "0");

            const dateKey = isMonthlyAggregated
                ? `${monthPad}/${year}`
                : `${dayPad}/${monthPad}/${year}`;

            const amount = Math.abs(parseSafeAmount(row[5]));
            pointsMap[dateKey] = (pointsMap[dateKey] || 0) + amount;
            total += amount;
            count++;
        });

        // Determine line color
        const parentCat = subCatToCatMap[selectedItem] || selectedItem;
        let color = dynamicColorMap[selectedItem] || dynamicColorMap[parentCat];
        if (!color) {
            const type = itemTypeMap[selectedItem] || itemTypeMap[parentCat];
            if (type === "Ingreso") color = "#22c55e";
            else if (type === "Egreso") color = "#ef4444";
            else if (type === "Ahorro") color = "#3b82f6";
            else if (type === "Inversión") color = "#8b5cf6";
            else color = "#3b82f6";
        }
        const validHex = color && color.startsWith("#") ? color : "#3b82f6";

        // Sort labels strictly chronologically from left to right (oldest to newest)
        const labels = Object.keys(pointsMap).sort((a, b) => {
            const partsA = a.split("/").map(Number);
            const partsB = b.split("/").map(Number);
            if (isMonthlyAggregated) {
                // [MM, YYYY]
                const [mA, yA] = partsA;
                const [mB, yB] = partsB;
                if (yA !== yB) return yA - yB;
                return mA - mB;
            } else {
                // [DD, MM, YYYY]
                const [dA, mA, yA] = partsA;
                const [dB, mB, yB] = partsB;
                if (yA !== yB) return yA - yB;
                if (mA !== mB) return mA - mB;
                return dA - dB;
            }
        });
        const dataValues = labels.map((l) => roundMoney(pointsMap[l]));

        return {
            chartPoints: { labels, dataValues },
            totalAmount: roundMoney(total),
            movementCount: count,
            lineColor: validHex,
        };
    }, [data, selectedItem, isMonthlyAggregated, subCatToCatMap, dynamicColorMap, itemTypeMap, groupedCompItems]);

    const chartTextColor = isDark ? "#e2e8f0" : "#475569";
    const chartGridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";

    const chartData = {
        labels: chartPoints.labels,
        datasets: [
            {
                label: `Tendencia: ${selectedItem}`,
                data: chartPoints.dataValues,
                borderColor: lineColor,
                backgroundColor: (context: ScriptableContext<"line">) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, lineColor, isDark, 0.35);
                },
                fill: true,
                tension: 0.35,
                pointRadius: 3.5,
                pointHoverRadius: 6,
                pointBackgroundColor: lineColor,
                borderWidth: 2.5,
            },
        ],
    };

    const options: ChartOptions<"line"> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)",
                titleColor: isDark ? "#f8fafc" : "#0f172a",
                bodyColor: isDark ? "#e2e8f0" : "#334155",
                borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)",
                borderWidth: 1,
                padding: 12,
                callbacks: {
                    label: (context) => ` ${selectedItem}: ${fmt(Number(context.parsed.y) || 0)}`,
                },
            },
        },
        scales: {
            x: {
                grid: {
                    color: chartGridColor,
                },
                ticks: {
                    color: chartTextColor,
                    maxRotation: 45,
                },
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: chartGridColor,
                },
                ticks: {
                    color: chartTextColor,
                    callback: (val) => fmtCompact(Number(val)),
                },
            },
        },
    };

    const hasData = chartPoints.labels.length > 0;

    return (
        <section
            className={`glass-panel ${styles.card} ${styles.colSpanFull}`}
            data-testid="card-linea-categoria"
        >
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h3 className={styles.title}>Evolución por Categoría o Subcategoría</h3>
                    <p className={styles.subtitle}>
                        Seguimiento individual de tendencia temporal con degradado
                    </p>
                </div>
                <div className={styles.headerControls}>
                    <select
                        className={styles.miniSelect}
                        value={selectedItem}
                        onChange={(e) => setSelectedItem(e.target.value)}
                        aria-label="Seleccionar categoría o subcategoría"
                    >
                        {groupedCompItems.map((group) => (
                            <optgroup key={`single-g-${group.category}`} label={group.category}>
                                <option value={group.category}>Toda la categoría ({group.category})</option>
                                {group.subCategories.map((sub) => (
                                    <option key={`single-s-${sub}`} value={sub}>
                                        {sub}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    {hasData && (
                        <>
                            <span className={styles.badge}>
                                Total: <strong>{fmt(totalAmount)}</strong>
                            </span>
                            <span className={styles.badge}>
                                <strong>{movementCount}</strong> {movementCount === 1 ? "movimiento" : "movimientos"}
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div className={styles.chartContainer}>
                {hasData ? (
                    <Line data={chartData} options={options} />
                ) : (
                    <div className={styles.emptyState}>
                        <p>No hay movimientos registrados para &quot;{selectedItem}&quot; en este período.</p>
                    </div>
                )}
            </div>
        </section>
    );
}

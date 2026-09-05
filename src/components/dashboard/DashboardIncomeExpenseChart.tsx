"use client";

import React, { useMemo, useState, useEffect } from "react";
import styles from "./DashboardIncomeExpenseChart.module.css";
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
import { Line } from "react-chartjs-2";
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

const MONTH_NAMES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

export interface DashboardIncomeExpenseChartProps {
    data?: (string | number)[][];
    filteredData?: (string | number)[][];
    balanceMonth?: string;
    isDark?: boolean;
}

interface PointAggregation {
    sortKey: number;
    label: string;
    ingreso: number;
    egreso: number;
    ahorro: number;
    inversion: number;
}

export default function DashboardIncomeExpenseChart({
    data = [],
    filteredData,
    balanceMonth = "Total",
    isDark,
}: DashboardIncomeExpenseChartProps) {
    const [systemDark, setSystemDark] = useState<boolean>(() => {
        if (typeof document !== "undefined") {
            return (
                document.documentElement.getAttribute("data-theme") === "dark" ||
                (!document.documentElement.hasAttribute("data-theme") &&
                    typeof window !== "undefined" &&
                    window.matchMedia?.("(prefers-color-scheme: dark)").matches)
            );
        }
        return false;
    });

    useEffect(() => {
        if (typeof isDark === "boolean") return;

        const updateTheme = () => {
            const dark =
                document.documentElement.getAttribute("data-theme") === "dark" ||
                (!document.documentElement.hasAttribute("data-theme") &&
                    window.matchMedia?.("(prefers-color-scheme: dark)").matches);
            setSystemDark(dark);
        };

        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        const mq = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : null;
        mq?.addEventListener?.("change", updateTheme);

        return () => {
            observer.disconnect();
            mq?.removeEventListener?.("change", updateTheme);
        };
    }, [isDark]);

    const themeDark = typeof isDark === "boolean" ? isDark : systemDark;

    // Determine target rows
    const rowsToProcess = useMemo(() => {
        if (filteredData) return filteredData;
        if (!data || data.length === 0) return [];
        if (!balanceMonth || balanceMonth === "Total") return data;

        return data.filter((row) => {
            if (!row || row.length < 6) return false;
            const dateStr = row[1];
            if (typeof dateStr === "string") {
                const parts = dateStr.split("/");
                if (parts.length >= 3) {
                    if (balanceMonth.length === 4) {
                        return parts[2] === balanceMonth;
                    } else {
                        return `${parts[1]}/${parts[2]}` === balanceMonth;
                    }
                }
            }
            return false;
        });
    }, [data, filteredData, balanceMonth]);

    const isMonthly = !balanceMonth || balanceMonth === "Total" || balanceMonth.length === 4;

    // Aggregate transactions by period
    const chartDataPoints = useMemo(() => {
        const pointsMap = new Map<number, PointAggregation>();

        rowsToProcess.forEach((row) => {
            if (!row || row.length < 6) return;
            const rawDateStr = String(row[1] || "").trim();
            const parts = rawDateStr.split("/");
            if (parts.length < 3) return;

            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12) return;

            const type = String(row[2] || "").trim();
            const isIngreso = type === "Ingreso";
            const isEgreso = type === "Egreso";
            const isAhorro = type === "Ahorro";
            const isInversion = type === "Inversión" || type === "Inversion";

            if (!isIngreso && !isEgreso && !isAhorro && !isInversion) return;

            const amount = Math.abs(parseSafeAmount(row[5]));
            if (amount <= 0) return;

            const sortKey = isMonthly
                ? year * 100 + month
                : year * 10000 + month * 100 + day;

            const label = isMonthly
                ? `${MONTH_NAMES[month - 1]} ${String(year).slice(-2)}`
                : `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;

            const existing = pointsMap.get(sortKey) || {
                sortKey,
                label,
                ingreso: 0,
                egreso: 0,
                ahorro: 0,
                inversion: 0,
            };

            if (isIngreso) {
                existing.ingreso += amount;
            } else if (isEgreso) {
                existing.egreso += amount;
            } else if (isAhorro) {
                existing.ahorro += amount;
            } else if (isInversion) {
                existing.inversion += amount;
            }

            pointsMap.set(sortKey, existing);
        });

        return Array.from(pointsMap.values()).sort((a, b) => a.sortKey - b.sortKey);
    }, [rowsToProcess, isMonthly]);

    const chartTextColor = themeDark ? "#e2e8f0" : "#475569";
    const chartGridColor = themeDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";

    const periodLabel = useMemo(() => {
        if (!balanceMonth || balanceMonth === "Total") return "Histórico Completo";
        if (balanceMonth.length === 4) return `Año ${balanceMonth}`;
        return balanceMonth;
    }, [balanceMonth]);

    if (chartDataPoints.length === 0) {
        return (
            <section
                className={`glass-panel ${styles.card} ${styles.colSpanFull}`}
                data-testid="dashboard-chart-empty"
            >
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <span className={styles.icon}>📊</span>
                        <div>
                            <h3 className={styles.title}>Distribución</h3>
                            <p className={styles.subtitle}>Evolución en el tiempo ({periodLabel})</p>
                        </div>
                    </div>
                    <span className={styles.badge}>{periodLabel}</span>
                </div>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📊</div>
                    <h4 className={styles.emptyTitle}>No hay movimientos en este período</h4>
                    <p className={styles.emptyDescription}>
                        No se registraron movimientos en el período seleccionado. Seleccioná otro mes o cargá nuevos movimientos con el botón (+).
                    </p>
                </div>
            </section>
        );
    }

    const labels = chartDataPoints.map((p) => p.label);
    const ingresosData = chartDataPoints.map((p) => roundMoney(p.ingreso));
    const egresosData = chartDataPoints.map((p) => roundMoney(p.egreso));
    const ahorrosData = chartDataPoints.map((p) => roundMoney(p.ahorro));
    const inversionesData = chartDataPoints.map((p) => roundMoney(p.inversion));

    const chartData = {
        labels,
        datasets: [
            {
                label: "Ingresos",
                data: ingresosData,
                borderColor: "#22c55e",
                backgroundColor: (context: ScriptableContext<"line">) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, "#22c55e", themeDark);
                },
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: "#22c55e",
                borderWidth: 2.5,
            },
            {
                label: "Egresos",
                data: egresosData,
                borderColor: "#ef4444",
                backgroundColor: (context: ScriptableContext<"line">) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, "#ef4444", themeDark);
                },
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: "#ef4444",
                borderWidth: 2.5,
            },
            {
                label: "Ahorro",
                data: ahorrosData,
                borderColor: "#3b82f6",
                backgroundColor: (context: ScriptableContext<"line">) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, "#3b82f6", themeDark);
                },
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: "#3b82f6",
                borderWidth: 2.5,
            },
            {
                label: "Inversión",
                data: inversionesData,
                borderColor: "#8b5cf6",
                backgroundColor: (context: ScriptableContext<"line">) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, "#8b5cf6", themeDark);
                },
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: "#8b5cf6",
                borderWidth: 2.5,
            },
        ],
    };

    const options: ChartOptions<"line"> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "index",
            intersect: false,
        },
        plugins: {
            legend: {
                position: "bottom",
                labels: {
                    color: chartTextColor,
                    usePointStyle: true,
                    pointStyle: "circle",
                    padding: 16,
                    font: {
                        size: 12,
                        weight: 500,
                    },
                },
            },
            tooltip: {
                backgroundColor: themeDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)",
                titleColor: themeDark ? "#f8fafc" : "#0f172a",
                bodyColor: themeDark ? "#e2e8f0" : "#334155",
                borderColor: themeDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)",
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true,
                callbacks: {
                    label: (context) => {
                        const datasetLabel = context.dataset.label || "";
                        const val = Number(context.parsed.y) || 0;
                        return ` ${datasetLabel}: ${fmt(val)}`;
                    },
                    afterBody: (tooltipItems) => {
                        if (tooltipItems.length >= 2) {
                            const ingresoItem = tooltipItems.find((t) => t.dataset.label === "Ingresos");
                            const egresoItem = tooltipItems.find((t) => t.dataset.label === "Egresos");
                            if (ingresoItem && egresoItem) {
                                const diff =
                                    (Number(ingresoItem.parsed.y) || 0) -
                                    (Number(egresoItem.parsed.y) || 0);
                                const sign = diff >= 0 ? "+" : "";
                                return `\nNeto: ${sign}${fmt(diff)}`;
                            }
                        }
                        return "";
                    },
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
                    autoSkip: true,
                    maxTicksLimit: 12,
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

    return (
        <section
            className={`glass-panel ${styles.card} ${styles.colSpanFull}`}
            data-testid="dashboard-income-expense-chart"
        >
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <span className={styles.icon}>📊</span>
                    <div>
                        <h3 className={styles.title}>Distribución</h3>
                        <p className={styles.subtitle}>Evolución en el tiempo ({periodLabel})</p>
                    </div>
                </div>
                <span className={styles.badge}>{periodLabel}</span>
            </div>
            <div className={styles.chartContainer}>
                <Line data={chartData} options={options} />
            </div>
        </section>
    );
}

export { DashboardIncomeExpenseChart };

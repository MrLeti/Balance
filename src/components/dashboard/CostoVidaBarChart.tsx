"use client";

import React, { useMemo } from "react";
import styles from "./CostoVidaBarChart.module.css";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { fmt, fmtCompact, parseSafeAmount, roundMoney } from "@/lib/utils/format";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MONTH_NAMES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

export interface CostoVidaBarChartProps {
    data: (string | number)[][];
    isDark?: boolean;
}

export default function CostoVidaBarChart({ data = [], isDark = false }: CostoVidaBarChartProps) {
    const chartTextColor = isDark ? "#e2e8f0" : "#475569";
    const chartGridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";

    const { monthsList, monthlyTotals, average, total6Months } = useMemo(() => {
        // 1. Find the latest month present across ALL data transactions to anchor the 6-month window
        let latestYear = 0;
        let latestMonth = 0;

        data.forEach((row) => {
            if (!row || row.length < 2) return;
            const rawDate = String(row[1] || "").trim();
            const parts = rawDate.includes("/") ? rawDate.split("/") : rawDate.split("-");
            if (parts.length < 3) return;

            // Handle DD/MM/YYYY or YYYY-MM-DD
            let m = 0;
            let y = 0;
            if (parts[0].length === 4) {
                y = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10);
            } else {
                m = parseInt(parts[1], 10);
                y = parseInt(parts[2], 10);
            }

            if (!isNaN(m) && !isNaN(y) && m >= 1 && m <= 12) {
                if (y > latestYear || (y === latestYear && m > latestMonth)) {
                    latestYear = y;
                    latestMonth = m;
                }
            }
        });

        if (latestYear === 0) {
            return { monthsList: [], monthlyTotals: [], average: 0, total6Months: 0 };
        }

        // 2. Collect all non-puntual expenses grouped by year-month
        const expensesByMonth: Record<string, number> = {};

        data.forEach((row) => {
            if (!row || row.length < 6) return;
            const type = String(row[2] || "").trim();
            if (type !== "Egreso") return;

            const category = String(row[3] || "").trim().toLowerCase();
            const subCategory = String(row[4] || "").trim().toLowerCase();
            // Exclude "Puntuales" (costo de vida is strictly without puntual expenses)
            if (
                category === "puntuales" ||
                category === "puntual" ||
                category.startsWith("puntual") ||
                subCategory.includes("puntual")
            ) {
                return;
            }

            const rawDate = String(row[1] || "").trim();
            const parts = rawDate.includes("/") ? rawDate.split("/") : rawDate.split("-");
            if (parts.length < 3) return;

            let m = 0;
            let y = 0;
            if (parts[0].length === 4) {
                y = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10);
            } else {
                m = parseInt(parts[1], 10);
                y = parseInt(parts[2], 10);
            }
            if (isNaN(m) || isNaN(y) || m < 1 || m > 12) return;

            const mKey = `${y}-${String(m).padStart(2, "0")}`;
            const amount = Math.abs(parseSafeAmount(row[5]));
            expensesByMonth[mKey] = (expensesByMonth[mKey] || 0) + amount;
        });

        // Generate exactly the 6 consecutive calendar months ending at the latest month
        const targetMonths: { key: string; label: string; year: number; month: number }[] = [];
        for (let offset = 5; offset >= 0; offset--) {
            let m = latestMonth - offset;
            let y = latestYear;
            while (m <= 0) {
                m += 12;
                y -= 1;
            }
            const key = `${y}-${String(m).padStart(2, "0")}`;
            targetMonths.push({
                key,
                label: `${MONTH_NAMES[m - 1]} ${String(y).slice(-2)}`,
                year: y,
                month: m,
            });
        }

        const totals = targetMonths.map((tm) => roundMoney(expensesByMonth[tm.key] || 0));
        const sum = totals.reduce((acc, curr) => acc + curr, 0);
        // Average over months that have data or all 6 months if overall sum > 0
        const activeMonths = totals.filter((t) => t > 0).length;
        const avg = activeMonths > 0 ? roundMoney(sum / activeMonths) : 0;

        return {
            monthsList: targetMonths,
            monthlyTotals: totals,
            average: avg,
            total6Months: sum,
        };
    }, [data]);

    const chartData = {
        labels: monthsList.map((m) => m.label),
        datasets: [
            {
                label: "Costo de Vida",
                data: monthlyTotals,
                backgroundColor: "rgba(239, 68, 68, 0.8)",
                hoverBackgroundColor: "#ef4444",
                borderColor: "#ef4444",
                borderWidth: 1.5,
                borderRadius: 8,
                borderSkipped: false,
            },
        ],
    };

    const options: ChartOptions<"bar"> = {
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
                    label: (context) => ` Costo de Vida: ${fmt(Number(context.parsed.y) || 0)}`,
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
                    font: { weight: "bold" },
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

    const hasData = monthlyTotals.some((t) => t > 0);

    return (
        <section
            className={`glass-panel ${styles.card} ${styles.colSpanFull}`}
            data-testid="card-costo-vida"
        >
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h3 className={styles.title}>Costo de Vida (Últimos 6 meses)</h3>
                    <p className={styles.subtitle}>
                        Gastos corrientes y esenciales · Excluye categoría Puntuales
                    </p>
                </div>
                {hasData && (
                    <div className={styles.headerRight}>
                        <span className={styles.badge} title="Promedio mensual de costo de vida">
                            💡 Promedio: <strong>{fmt(average)}/mes</strong>
                        </span>
                        <span className={styles.badge} title="Total acumulado en los últimos 6 meses">
                            Total: <strong>{fmt(total6Months)}</strong>
                        </span>
                    </div>
                )}
            </div>

            <div className={styles.chartContainer}>
                {hasData ? (
                    <Bar data={chartData} options={options} />
                ) : (
                    <div className={styles.emptyState}>
                        <p>No hay suficientes registros de egresos para calcular el costo de vida de los últimos 6 meses.</p>
                    </div>
                )}
            </div>
        </section>
    );
}

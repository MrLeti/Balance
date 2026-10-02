"use client";

import React, { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
    Currency,
    InvestmentTransaction,
    HistoricalPriceMap,
    getPortfolioHistory,
    PortfolioHistoryPoint,
} from "@/lib/utils/investments";
import styles from "./PerformanceBenchmarkCard.module.css";

interface PerformanceBenchmarkCardProps {
    transactions: InvestmentTransaction[];
    activePrices: Record<string, number>;
    displayCurrency: Currency;
    cclRate: number;
    mepRate: number;
    benchmarkData: {
        sp500: { timestamp: number; price: number }[];
        ccl: { date: string; rate: number }[];
        mep: { date: string; rate: number }[];
        inflation: { date: string; rate: number }[];
    };
    historicalPrices?: HistoricalPriceMap;
    dateRangePreset?: string;
    customDateFrom?: string;
    customDateTo?: string;
}

export default function PerformanceBenchmarkCard({
    transactions,
    activePrices,
    displayCurrency,
    cclRate,
    mepRate,
    benchmarkData,
    historicalPrices = {},
    dateRangePreset = "all",
    customDateFrom = "",
    customDateTo = "",
}: PerformanceBenchmarkCardProps) {
    // Filtro de alcance: "all" (consolidado), "type:<Tipo>", o "asset:<Ticker>"
    const [selectedScope, setSelectedScope] = useState<string>("all");

    // Toggles de visibilidad de benchmarks
    const [showSP500, setShowSP500] = useState(true);
    const [showCclBenchmark, setShowCclBenchmark] = useState(true);
    const [showInflationBenchmark, setShowInflationBenchmark] = useState(true);

    const effectiveFx = mepRate > 0 ? mepRate : (cclRate > 0 ? cclRate : 1);

    // Listas únicas para el selector agrupado
    const uniqueTypes = useMemo(() => {
        return Array.from(new Set(transactions.map(t => t.assetType))).filter(Boolean).sort();
    }, [transactions]);

    const uniqueAssets = useMemo(() => {
        return Array.from(new Set(transactions.map(t => t.asset))).filter(Boolean).sort();
    }, [transactions]);

    // Transacciones filtradas según la selección
    const filteredTransactions = useMemo(() => {
        if (selectedScope === "all") return transactions;
        if (selectedScope.startsWith("type:")) {
            const targetType = selectedScope.slice(5);
            return transactions.filter(t => t.assetType === targetType);
        }
        if (selectedScope.startsWith("asset:")) {
            const targetAsset = selectedScope.slice(6);
            return transactions.filter(t => t.asset === targetAsset);
        }
        return transactions;
    }, [transactions, selectedScope]);

    // Historial específico para el alcance seleccionado
    const rawHistory = useMemo(() => {
        if (filteredTransactions.length === 0) return [];
        return getPortfolioHistory(
            filteredTransactions,
            historicalPrices,
            activePrices,
            displayCurrency,
            effectiveFx
        );
    }, [filteredTransactions, historicalPrices, activePrices, displayCurrency, effectiveFx]);

    const history = useMemo(() => {
        if (rawHistory.length <= 1) return rawHistory;
        const normalizedPreset = (dateRangePreset || "all").toLowerCase();
        if (normalizedPreset === "all" && !customDateFrom && !customDateTo) {
            return rawHistory;
        }

        const toDateObj = (dStr: string): Date => {
            if (!dStr) return new Date();
            const clean = dStr.trim();
            if (clean.includes("-")) {
                const parts = clean.split("-").map(Number);
                if (parts.length === 3) {
                    if (parts[0] > 1000) {
                        return new Date(parts[0], parts[1] - 1, parts[2]);
                    }
                    const y = parts[2] < 100 ? (parts[2] < 70 ? 2000 + parts[2] : 1900 + parts[2]) : parts[2];
                    return new Date(y, parts[1] - 1, parts[0]);
                }
            }
            if (clean.includes("/")) {
                const parts = clean.split("/").map(Number);
                if (parts.length === 3) {
                    if (parts[0] > 1000) {
                        return new Date(parts[0], parts[1] - 1, parts[2]);
                    }
                    const y = parts[2] < 100 ? (parts[2] < 70 ? 2000 + parts[2] : 1900 + parts[2]) : parts[2];
                    return new Date(y, parts[1] - 1, parts[0]);
                }
            }
            const d = new Date(clean);
            return isNaN(d.getTime()) ? new Date() : d;
        };

        const formatToDDMMYYYY = (d: Date): string => {
            const dd = String(d.getDate()).padStart(2, "0");
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        };

        const now = new Date();
        now.setHours(23, 59, 59, 999);
        let startDate: Date;
        let endDate: Date = now;

        if (normalizedPreset === "custom") {
            if (!customDateFrom && !customDateTo) return rawHistory;
            startDate = customDateFrom ? toDateObj(customDateFrom) : toDateObj(rawHistory[0].date);
            startDate.setHours(0, 0, 0, 0);
            endDate = customDateTo ? toDateObj(customDateTo) : now;
            endDate.setHours(23, 59, 59, 999);
        } else if (normalizedPreset === "1m") {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0);
        } else if (normalizedPreset === "3m") {
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0, 0);
        } else if (normalizedPreset === "6m") {
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0, 0);
        } else if (normalizedPreset === "ytd") {
            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        } else if (normalizedPreset === "1y") {
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
        } else {
            return rawHistory;
        }

        const startTime = startDate.getTime();
        const endTime = endDate.getTime();

        const inRange = rawHistory.filter((p) => {
            const t = toDateObj(p.date).getTime();
            return t >= startTime && t <= endTime;
        });

        const prevPoint = [...rawHistory].reverse().find(p => toDateObj(p.date).getTime() < startTime);

        if (inRange.length === 0) {
            if (prevPoint) {
                const pStart: PortfolioHistoryPoint = {
                    ...prevPoint,
                    date: formatToDDMMYYYY(startDate),
                    hasBuy: false,
                    hasSell: false,
                };
                const pEnd: PortfolioHistoryPoint = {
                    ...prevPoint,
                    date: formatToDDMMYYYY(endDate),
                    hasBuy: false,
                    hasSell: false,
                };
                return [pStart, pEnd];
            }
            return rawHistory;
        }

        const firstPointTime = toDateObj(inRange[0].date).getTime();
        let result = [...inRange];

        if (prevPoint && firstPointTime > startTime) {
            const pStart: PortfolioHistoryPoint = {
                ...prevPoint,
                date: formatToDDMMYYYY(startDate),
                hasBuy: false,
                hasSell: false,
            };
            result = [pStart, ...result];
        }

        if (result.length < 2 && prevPoint) {
            result = [prevPoint, ...result];
        }

        return result.length > 0 ? result : rawHistory;
    }, [rawHistory, dateRangePreset, customDateFrom, customDateTo]);

    // Helper para obtener cotización CCL más cercana a una fecha
    const getClosestCclRate = (targetDateStr: string, fallbackRate: number = 1): number => {
        const series = (benchmarkData.ccl && benchmarkData.ccl.length > 0)
            ? benchmarkData.ccl
            : (benchmarkData.mep || []);
        if (series.length === 0) return fallbackRate;
        const [d, m, y] = targetDateStr.split("/").map(Number);
        const isoi = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const targetTime = new Date(isoi).getTime();
        let closest = series[0].rate;
        let minDiff = Infinity;
        for (const item of series) {
            const diff = Math.abs(new Date(item.date).getTime() - targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                closest = item.rate;
            }
        }
        return closest > 0 ? closest : fallbackRate;
    };

    // Datos del gráfico comparativo
    const chartData = useMemo(() => {
        if (history.length === 0) return { labels: [], datasets: [] };

        const labels = history.map(p => p.date);

        // 1. Rendimiento del activo / portafolio seleccionado
        const baseTwr = history[0].twrPercent;
        const baseInvested = history[0].invested;
        const baseValue = history[0].value;

        const portfolioReturns = history.map((p, idx) => {
            if (idx === 0) return 0;
            if (p.twrPercent !== undefined && baseTwr !== undefined) {
                const factor0 = 1 + (baseTwr / 100);
                const factorT = 1 + (p.twrPercent / 100);
                if (factor0 > 0) {
                    return Number((((factorT / factor0) - 1) * 100).toFixed(2));
                }
            }
            if (baseValue > 0) {
                return Number((((p.value - baseValue) / baseValue) * 100).toFixed(2));
            }
            if (p.invested > 0) {
                return Number((((p.value - p.invested) / p.invested) * 100).toFixed(2));
            }
            return 0;
        });

        const [d0, m0, y0] = history[0].date.split("/").map(Number);
        const t0 = new Date(y0, m0 - 1, d0).getTime() / 1000;
        const baseCcl = getClosestCclRate(history[0].date, cclRate || mepRate || 1);

        // 2. Rendimiento acumulado del S&P 500 (%) - Total Return (adjclose)
        let sp500Returns: number[] = [];
        if (benchmarkData.sp500 && benchmarkData.sp500.length > 0) {
            let baseSPPriceUSD = benchmarkData.sp500[0].price;
            let minDiff0 = Infinity;
            for (const b of benchmarkData.sp500) {
                const diff = Math.abs(b.timestamp - t0);
                if (diff < minDiff0) {
                    minDiff0 = diff;
                    baseSPPriceUSD = b.price;
                }
            }

            const baseSPPrice = displayCurrency === "ARS" ? baseSPPriceUSD * baseCcl : baseSPPriceUSD;

            sp500Returns = history.map(p => {
                const [d, m, y] = p.date.split("/").map(Number);
                const ts = new Date(y, m - 1, d).getTime() / 1000;
                let closestUSD = baseSPPriceUSD;
                let minDiff = Infinity;
                for (const b of benchmarkData.sp500) {
                    const diff = Math.abs(b.timestamp - ts);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestUSD = b.price;
                    }
                }

                const currentCcl = getClosestCclRate(p.date, baseCcl);
                const currentSPPrice = displayCurrency === "ARS" ? closestUSD * currentCcl : closestUSD;

                if (baseSPPrice <= 0) return 0;
                return Number((((currentSPPrice - baseSPPrice) / baseSPPrice) * 100).toFixed(2));
            });
        }

        // 3. Rendimiento acumulado del Dólar CCL (%)
        let cclReturns: number[] = [];
        const cclSeries = (benchmarkData.ccl && benchmarkData.ccl.length > 0) ? benchmarkData.ccl : benchmarkData.mep;
        if (cclSeries && cclSeries.length > 0) {
            cclReturns = history.map(p => {
                if (displayCurrency === "USD") {
                    return 0; // En USD la variación nominal de la divisa es 0%
                }
                const currentCcl = getClosestCclRate(p.date, baseCcl);
                if (baseCcl <= 0) return 0;
                return Number((((currentCcl - baseCcl) / baseCcl) * 100).toFixed(2));
            });
        }

        // 4. Rendimiento acumulado de la Inflación IPC (%)
        let inflationReturns: number[] = [];
        if (benchmarkData.inflation && benchmarkData.inflation.length > 0) {
            const date0 = new Date(y0, m0 - 1, d0);
            const sortedInf = [...benchmarkData.inflation].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            inflationReturns = history.map((p, idx) => {
                if (idx === 0) return 0;

                const [d, m, y] = p.date.split("/").map(Number);
                const targetDate = new Date(y, m - 1, d);

                let cumFactor = 1.0;
                for (const item of sortedInf) {
                    const itemDate = new Date(item.date);
                    if (itemDate > date0 && itemDate <= targetDate) {
                        cumFactor *= (1 + (item.rate / 100));
                    }
                }

                if (displayCurrency === "USD") {
                    const currentCcl = getClosestCclRate(p.date, baseCcl);
                    const fxDevaluationFactor = baseCcl > 0 ? (currentCcl / baseCcl) : 1;
                    const usdInflationFactor = fxDevaluationFactor > 0 ? (cumFactor / fxDevaluationFactor) : cumFactor;
                    return Number(((usdInflationFactor - 1) * 100).toFixed(2));
                }

                return Number(((cumFactor - 1) * 100).toFixed(2));
            });
        }

        // Etiqueta de la curva principal según alcance
        let mainLabel = `Portafolio TWR (${displayCurrency})`;
        if (selectedScope.startsWith("type:")) {
            mainLabel = `${selectedScope.slice(5)} (${displayCurrency})`;
        } else if (selectedScope.startsWith("asset:")) {
            mainLabel = `${selectedScope.slice(6)} (${displayCurrency})`;
        }

        // Datasets
        const datasets: any[] = [
            {
                label: mainLabel,
                data: portfolioReturns,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                fill: true,
                tension: 0.35,
                pointRadius: history.map(p => (p.hasBuy || p.hasSell) ? 6 : 2),
                pointHoverRadius: history.map(p => (p.hasBuy || p.hasSell) ? 8 : 4),
                pointBackgroundColor: history.map(p => p.hasBuy && p.hasSell ? "#f59e0b" : p.hasBuy ? "#22c55e" : p.hasSell ? "#ef4444" : "#3b82f6"),
                pointBorderColor: history.map(p => p.hasBuy && p.hasSell ? "#b45309" : p.hasBuy ? "#15803d" : p.hasSell ? "#b91c1c" : "#2563eb"),
                pointBorderWidth: history.map(p => (p.hasBuy || p.hasSell) ? 2 : 1),
            },
        ];

        if (showSP500 && sp500Returns.length > 0) {
            datasets.push({
                label: `S&P 500 (${displayCurrency})`,
                data: sp500Returns,
                borderColor: "#f59e0b",
                backgroundColor: "transparent",
                fill: false,
                tension: 0.35,
                pointRadius: 2,
                pointBackgroundColor: "#f59e0b",
                borderDash: [4, 4],
            });
        }

        if (showCclBenchmark && displayCurrency === "ARS" && cclReturns.length > 0) {
            datasets.push({
                label: "Dólar CCL (ARS)",
                data: cclReturns,
                borderColor: "#10b981",
                backgroundColor: "transparent",
                fill: false,
                tension: 0.35,
                pointRadius: 2,
                pointBackgroundColor: "#10b981",
                borderDash: [6, 3],
            });
        }

        if (showInflationBenchmark && inflationReturns.length > 0) {
            datasets.push({
                label: displayCurrency === "USD" ? "Inflación en USD (%)" : "Inflación IPC (ARS)",
                data: inflationReturns,
                borderColor: "#ef4444",
                backgroundColor: "transparent",
                fill: false,
                tension: 0.35,
                pointRadius: 2,
                pointBackgroundColor: "#ef4444",
                borderDash: [2, 2],
            });
        }

        return { labels, datasets };
    }, [
        history,
        benchmarkData,
        displayCurrency,
        mepRate,
        cclRate,
        selectedScope,
        showSP500,
        showCclBenchmark,
        showInflationBenchmark,
    ]);

    // Opciones del gráfico con optimización de eje X (autoSkip + maxTicksLimit)
    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "index" as const,
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: "bottom" as const,
                labels: { font: { size: 12 }, usePointStyle: true, padding: 16 },
            },
            tooltip: {
                mode: "index" as const,
                intersect: false,
                callbacks: {
                    label: (context: any) => `${context.dataset.label}: ${context.raw >= 0 ? "+" : ""}${context.raw}%`,
                    afterBody: (tooltipItems: any[]) => {
                        const index = tooltipItems[0]?.dataIndex;
                        if (index !== undefined && history[index]) {
                            const pt = history[index];
                            if (pt.hasBuy && pt.hasSell) return ["\n📌 Operaciones: ▲ Compra y ▼ Venta"];
                            if (pt.hasBuy) return ["\n📌 Operación: ▲ Compra"];
                            if (pt.hasSell) return ["\n📌 Operación: ▼ Venta"];
                        }
                        return [];
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    font: { size: 11 },
                    autoSkip: true,
                    maxTicksLimit: 10,
                    maxRotation: 45,
                    minRotation: 0,
                    callback: function(this: any, val: string | number) {
                        const label = this.getLabelForValue(Number(val));
                        if (!label || typeof label !== "string") return label;
                        const parts = label.split("/");
                        if (parts.length === 3) {
                            return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
                        }
                        return label;
                    }
                }
            },
            y: {
                grid: { color: "rgba(148,163,184,0.1)" },
                ticks: {
                    font: { size: 11 },
                    callback: (v: string | number) => `${Number(v) >= 0 ? "+" : ""}${v}%`,
                },
            },
        },
    }), [history]);

    // Métricas para badge de resumen
    const currentReturn = history.length > 0 ? (history[history.length - 1].twrPercent ?? 0) : 0;
    const buysCount = filteredTransactions.filter(t => t.type === "Compra").length;
    const sellsCount = filteredTransactions.filter(t => t.type === "Venta").length;
    const dateRangeStr = history.length > 0 ? `${history[0].date} — ${history[history.length - 1].date}` : "";

    return (
        <section className={`glass-panel ${styles.card}`}>
            <div className={styles.header}>
                <div className={styles.titleArea}>
                    <h3 className={styles.title}>Rendimiento Acumulado (% vs. Benchmarks)</h3>
                    
                    {/* Selector de alcance (Scope) */}
                    <div className={styles.scopeSelectWrapper}>
                        <select
                            className={styles.scopeSelect}
                            value={selectedScope}
                            onChange={e => setSelectedScope(e.target.value)}
                            id="perf-scope-select"
                            aria-label="Alcance del rendimiento"
                        >
                            <option value="all">🌐 Portafolio Consolidado (Todos)</option>

                            {uniqueTypes.length > 0 && (
                                <optgroup label="Por Clase de Activo">
                                    {uniqueTypes.map(t => (
                                        <option key={t} value={`type:${t}`}>
                                            📁 {t}
                                        </option>
                                    ))}
                                </optgroup>
                            )}

                            {uniqueAssets.length > 0 && (
                                <optgroup label="Por Activo Individual">
                                    {uniqueAssets.map(a => (
                                        <option key={a} value={`asset:${a}`}>
                                            🪙 {a}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>

                    {/* Badge de rendimiento del activo o selección */}
                    {history.length > 0 && (
                        <div className={`${styles.statBadge} ${currentReturn > 0 ? styles.badgePositive : currentReturn < 0 ? styles.badgeNegative : styles.badgeNeutral}`}>
                            <span>{currentReturn >= 0 ? "▲" : "▼"}</span>
                            <span>{currentReturn >= 0 ? `+${currentReturn.toFixed(2)}%` : `${currentReturn.toFixed(2)}%`}</span>
                        </div>
                    )}

                    {history.length > 0 && (
                        <span className={styles.subMeta}>
                            ({buysCount} {buysCount === 1 ? "compra" : "compras"}{sellsCount > 0 ? `, ${sellsCount} ${sellsCount === 1 ? "venta" : "ventas"}` : ""} · {dateRangeStr})
                        </span>
                    )}
                </div>

                {/* Chips de benchmarks */}
                <div className={styles.benchmarkToggles}>
                    <button
                        type="button"
                        className={`${styles.benchmarkChip} ${showSP500 ? styles.benchmarkChipActive : ""}`}
                        onClick={() => setShowSP500(!showSP500)}
                    >
                        <span className={styles.chipDot} style={{ backgroundColor: "#f59e0b" }} />
                        S&P 500
                    </button>
                    <button
                        type="button"
                        className={`${styles.benchmarkChip} ${showCclBenchmark ? styles.benchmarkChipActive : ""}`}
                        onClick={() => setShowCclBenchmark(!showCclBenchmark)}
                    >
                        <span className={styles.chipDot} style={{ backgroundColor: "#10b981" }} />
                        Dólar CCL
                    </button>
                    <button
                        type="button"
                        className={`${styles.benchmarkChip} ${showInflationBenchmark ? styles.benchmarkChipActive : ""}`}
                        onClick={() => setShowInflationBenchmark(!showInflationBenchmark)}
                    >
                        <span className={styles.chipDot} style={{ backgroundColor: "#ef4444" }} />
                        Inflación IPC
                    </button>
                </div>
            </div>

            {/* Contenedor del gráfico */}
            {history.length > 0 ? (
                <div className={styles.chartContainer}>
                    <Line
                        key={`bm-line-${dateRangePreset}-${customDateFrom}-${customDateTo}-${selectedScope}-${history.length}`}
                        data={chartData}
                        options={chartOptions}
                    />
                </div>
            ) : (
                <div className={styles.emptyState}>
                    <p>No se encontraron operaciones registradas para el activo o clase seleccionada.</p>
                </div>
            )}
        </section>
    );
}

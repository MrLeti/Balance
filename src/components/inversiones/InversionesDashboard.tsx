"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import styles from "./InversionesDashboard.module.css";
import TransactionForm from "./TransactionForm";
import ConfirmDialog from "@/components/layout/ConfirmDialog";
import EditableTable, { ColumnDef, FilterDef } from "@/components/shared/EditableTable";
import AdvancedToolsModal from "./AdvancedToolsModal";
import ImportPortfolioModal from "./ImportPortfolioModal";
import PerformanceBenchmarkCard from "./PerformanceBenchmarkCard";
import {
    parseSheetRow,
    buildPortfolio,
    getPortfolioSummary,
    getPortfolioHistory,
    ASSET_TYPE_COLORS,
    CARTERAS,
    type InvestmentTransaction,
    type PortfolioHolding,
    type PortfolioSummary,
    type PortfolioHistoryPoint,
    type Cartera,
    type Currency,
} from "@/lib/utils/investments";

import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Filler);

/* ─── Helpers ─── */
const fmt = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtCompact = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return fmt(n);
};

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

export default function InversionesDashboard() {
    const [displayCurrency, setDisplayCurrency] = useState<Currency>("ARS");
    const [cclRate, setCclRate] = useState<number>(0);
    const [mepRate, setMepRate] = useState<number>(0);
    const [pricesARS, setPricesARS] = useState<Record<string, number>>({});
    const [pricesUSD, setPricesUSD] = useState<Record<string, number>>({});

    const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
    const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
    
    // Benchmark state
    const [benchmarkData, setBenchmarkData] = useState<{
        sp500: { timestamp: number; price: number }[];
        ccl: { date: string; rate: number }[];
        mep: { date: string; rate: number }[];
        inflation: { date: string; rate: number }[];
    }>({ sp500: [], ccl: [], mep: [], inflation: [] });

    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [dialogDeleteId, setDialogDeleteId] = useState<string | null>(null);

    // Filters
    const [filterType, setFilterType] = useState<"all" | "Compra" | "Venta" | "Split">("all");
    const [filterAsset, setFilterAsset] = useState<string>("");
    const [filterCartera, setFilterCartera] = useState<string>("all");

    // Line charts date range state
    const [lineChartRange, setLineChartRange] = useState<"all" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "custom">("all");
    const [customDateFrom, setCustomDateFrom] = useState<string>("");
    const [customDateTo, setCustomDateTo] = useState<string>("");

    // Bar chart mode: "amounts" (Invertido vs Actual) vs "pnl" (Rendimiento %)
    const [barChartMode, setBarChartMode] = useState<"amounts" | "pnl">("amounts");

    // UI state
    const [showForm, setShowForm] = useState(false);
    const [editingPrice, setEditingPrice] = useState<string | null>(null);
    const [priceInput, setPriceInput] = useState("");
    const priceInputRef = useRef<HTMLInputElement>(null);
    const [priceSources, setPriceSources] = useState<Record<string, string>>({});

    // Modal de Herramientas Avanzadas e Importación
    const [showAdvancedTools, setShowAdvancedTools] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    const handleExportCSV = () => {
        if (!transactions || transactions.length === 0) {
            alert("No hay transacciones registradas para exportar.");
            return;
        }

        const headers = [
            "ID",
            "Fecha",
            "Tipo",
            "Activo",
            "TipoActivo",
            "Cantidad",
            "PrecioUnitario",
            "Comision",
            "Cartera",
            "Comentario",
            "Moneda",
            "Tipo de Cambio"
        ];

        const escapeCSV = (val: unknown) => {
            if (val === null || val === undefined) return '""';
            const s = String(val).replace(/"/g, '""');
            return `"${s}"`;
        };

        const rows = transactions.map(t => {
            return [
                escapeCSV(t.id),
                escapeCSV(t.date),
                escapeCSV(t.type),
                escapeCSV(t.asset),
                escapeCSV(t.assetType),
                escapeCSV(t.quantity),
                escapeCSV(t.unitPrice),
                escapeCSV(t.commission || 0),
                escapeCSV(t.cartera || "Inversión General"),
                escapeCSV(t.comment || ""),
                escapeCSV(t.currency || "ARS"),
                escapeCSV(t.fxRate || "")
            ].join(",");
        });

        // BOM UTF-8 para apertura correcta de caracteres y acentos en Excel
        const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `inversiones_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const activePrices = useMemo(() => {
        return displayCurrency === "USD" ? pricesUSD : pricesARS;
    }, [displayCurrency, pricesUSD, pricesARS]);

    const curSymbol = displayCurrency === "USD" ? "USD $" : "$";

    /* ─── Data Fetching ─── */
    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/investments");
            if (!res.ok) throw new Error("Error al cargar inversiones");
            const json = await res.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rows: any[][] = json.data || [];
            const txs = rows.map(parseSheetRow);

            const allAssets = [...new Set(txs.map(t => t.asset))];
            const allTypes = allAssets.map(a => {
                const tx = txs.find(t => t.asset === a);
                return tx?.assetType ?? "Acciones";
            });
            const allCurrencies = allAssets.map(a => {
                const tx = txs.find(t => t.asset === a);
                return tx?.currency ?? "ARS";
            });

            if (allAssets.length > 0) {
                try {
                    const priceRes = await fetch(
                        `/api/investments/prices?assets=${allAssets.join(",")}&types=${allTypes.join(",")}&currencies=${allCurrencies.join(",")}`
                    );

                    if (priceRes.ok) {
                        const priceJson = await priceRes.json();
                        const liveARS: Record<string, number> = {};
                        const liveUSD: Record<string, number> = {};
                        const liveSources: Record<string, string> = {};

                        if (priceJson.cclRate) setCclRate(priceJson.cclRate);
                        if (priceJson.mepRate) setMepRate(priceJson.mepRate);

                        for (const [ticker, data] of Object.entries(priceJson.prices)) {
                            const p = data as { ars: number; usd: number; source: string };
                            if (p.ars > 0) liveARS[ticker] = p.ars;
                            if (p.usd > 0) liveUSD[ticker] = p.usd;
                            liveSources[ticker] = p.source;
                        }

                        setPricesARS(liveARS);
                        setPricesUSD(liveUSD);
                        setPriceSources(liveSources);
                    }
                } catch {
                    // Handled gracefully
                }
            }

            // Benchmark (S&P 500, CCL, Inflación)
            try {
                const bmRes = await fetch("/api/investments/benchmark");
                if (bmRes.ok) {
                    const bmJson = await bmRes.json();
                    setBenchmarkData({
                        sp500: bmJson.sp500 || [],
                        ccl: bmJson.ccl || bmJson.mep || [],
                        mep: bmJson.mep || bmJson.ccl || [],
                        inflation: bmJson.inflation || [],
                    });
                }
            } catch (err) {
                console.warn("No se pudo cargar benchmark:", err);
            }

            setTransactions(txs);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /** Recalculate portfolio whenever transactions, prices, currency, or FX change */
    useEffect(() => {
        if (transactions.length === 0) {
            setHoldings([]);
            setSummary(null);
            setHistory([]);
            return;
        }
        const effectiveFx = mepRate > 0 ? mepRate : (cclRate > 0 ? cclRate : 1);
        const h = buildPortfolio(transactions, activePrices, displayCurrency, effectiveFx);
        setHoldings(h);
        setSummary(getPortfolioSummary(h, transactions, activePrices, displayCurrency, effectiveFx));
        setHistory(getPortfolioHistory(transactions, activePrices, displayCurrency, effectiveFx));
    }, [transactions, activePrices, displayCurrency, mepRate, cclRate]);

    /* ─── Handlers ─── */
    const handleDelete = (id: string) => {
        if (deleting) return;
        setDialogDeleteId(id);
    };

    const handleConfirmDelete = async () => {
        const id = dialogDeleteId;
        setDialogDeleteId(null);
        if (!id) return;
        setDeleting(id);
        try {
            const res = await fetch(`/api/investments/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Error al eliminar");
            await fetchData();
        } catch (err) {
            console.error(err);
            alert("Error al eliminar la transacción.");
        } finally {
            setDeleting(null);
        }
    };

    const handleEditInvestment = async (id: string, field: string, value: unknown) => {
        await fetch(`/api/investments/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ field, value }),
        }).then(res => {
            if (!res.ok) throw new Error("Error al actualizar la inversión.");
            fetchData();
        });
    };


    const handlePriceEdit = (asset: string) => {
        setEditingPrice(asset);
        setPriceInput(String(activePrices[asset] || ""));
        setTimeout(() => priceInputRef.current?.focus(), 50);
    };

    const handlePriceSave = async (asset: string) => {
        const val = parseFloat(priceInput);
        const effectiveFx = mepRate > 0 ? mepRate : (cclRate > 0 ? cclRate : 1);
        if (!isNaN(val) && val >= 0) {
            if (displayCurrency === "USD") {
                setPricesUSD(prev => ({ ...prev, [asset]: val }));
                const arsVal = effectiveFx > 0 ? Math.round(val * effectiveFx * 100) / 100 : val;
                setPricesARS(prev => ({ ...prev, [asset]: arsVal }));
                fetch("/api/investments/prices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ asset, price_usd: val, price_ars: arsVal }),
                }).catch(err => console.warn("Failed to persist manual price:", err));
            } else {
                setPricesARS(prev => ({ ...prev, [asset]: val }));
                const usdVal = effectiveFx > 0 ? Math.round((val / effectiveFx) * 100) / 100 : 0;
                setPricesUSD(prev => ({ ...prev, [asset]: usdVal }));
                fetch("/api/investments/prices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ asset, price_ars: val, price_usd: usdVal }),
                }).catch(err => console.warn("Failed to persist manual price:", err));
            }
        }
        setEditingPrice(null);
    };


    const uniqueAssets = useMemo(() => [...new Set(transactions.map(t => t.asset))], [transactions]);

    const investmentRows = useMemo(() => {
        return transactions.map(tx => ({
            id: tx.id,
            date: tx.date,
            operation: tx.type,
            asset: tx.asset,
            asset_type: tx.assetType,
            quantity: tx.quantity,
            unit_price: tx.unitPrice,
            commission: tx.commission,
            cartera: tx.cartera,
            comment: tx.comment || "",
            currency: tx.currency || "ARS",
            fx_rate: tx.fxRate || 0,
        }));
    }, [transactions]);

    const investmentColumns: ColumnDef[] = useMemo(() => [
        { key: "date", header: "Fecha", editable: true, type: "date", width: "110px" },
        {
            key: "operation",
            header: "Op.",
            editable: true,
            type: "select",
            options: ["Compra", "Venta", "Split"],
            width: "100px",
            render: (val) => {
                const op = String(val);
                const isSplit = op === "Split";
                const isBuy = op === "Compra";
                return (
                    <span className={`${styles.txTypeBadge} ${isSplit ? styles.txSplit : isBuy ? styles.txBuy : styles.txSell}`}>
                        {isSplit ? "➗ Split" : isBuy ? "▲ Compra" : "▼ Venta"}
                    </span>
                );
            }
        },
        { key: "asset", header: "Activo", editable: true, type: "text", width: "90px" },
        { key: "asset_type", header: "Tipo", editable: true, type: "text", width: "110px" },
        {
            key: "quantity",
            header: "Cant.",
            editable: true,
            type: "number",
            width: "90px",
            render: (val, row) => {
                const q = Number(val) || 0;
                if (row.operation === "Split") return `Factor ${q}:1`;
                return q < 1 ? q.toFixed(6) : fmt(q);
            }
        },
        {
            key: "unit_price",
            header: "Precio Unit.",
            editable: true,
            type: "number",
            width: "120px",
            render: (val, row) => {
                if (row.operation === "Split") return "-";
                const sym = row.currency === "USD" ? "USD $" : "$";
                return `${sym}${fmt(Number(val) || 0)}`;
            }
        },
        {
            key: "commission",
            header: "Comisión",
            editable: true,
            type: "number",
            width: "100px",
            render: (val, row) => {
                const c = Number(val) || 0;
                if (c <= 0) return "-";
                const sym = row.currency === "USD" ? "USD $" : "$";
                return `${sym}${fmt(c)}`;
            }
        },
        {
            key: "total",
            header: "Total",
            editable: false,
            type: "readonly",
            width: "120px",
            render: (_val, row) => {
                if (row.operation === "Split") return "Split";
                const q = Number(row.quantity) || 0;
                const p = Number(row.unit_price) || 0;
                const c = Number(row.commission) || 0;
                const isBuy = row.operation === "Compra";
                const total = isBuy ? (q * p + c) : Math.max(0, (q * p - c));
                const sym = row.currency === "USD" ? "USD $" : "$";
                return <span style={{ fontWeight: 600 }}>{sym}{fmt(total)}</span>;
            }
        },
        {
            key: "cartera",
            header: "Cartera",
            editable: true,
            type: "select",
            options: ["Crecimiento", "Jubilación"],
            width: "120px",
            render: (val) => {
                const isJub = val === "Jubilación";
                return (
                    <span className={`${styles.carteraBadge} ${isJub ? styles.carteraJubilacion : styles.carteraCrecimiento}`}>
                        {isJub ? "🏦" : "🚀"} {String(val)}
                    </span>
                );
            }
        },
        {
            key: "currency",
            header: "Moneda",
            editable: true,
            type: "select",
            options: ["ARS", "USD"],
            width: "80px",
            render: (val) => val === "USD" ? <span className={styles.currencyBadge}>USD</span> : "ARS"
        },
        {
            key: "fx_rate",
            header: "Dólar MEP",
            editable: true,
            type: "number",
            width: "100px",
            render: (val) => {
                const rate = Number(val) || 0;
                if (rate <= 0) return "-";
                return `$${fmt(rate)}`;
            }
        },

        { key: "comment", header: "Notas", editable: true, type: "text" },
    ], []);

    const investmentFilters: FilterDef[] = useMemo(() => [
        {
            key: "operation",
            label: "Operación",
            options: [
                { value: "", label: "Todas" },
                { value: "Compra", label: "▲ Compras" },
                { value: "Venta", label: "▼ Ventas" },
                { value: "Split", label: "➗ Splits" },
            ]
        },
        {
            key: "asset",
            label: "Activo",
            options: [
                { value: "", label: "Todos los activos" },
                ...uniqueAssets.map(a => ({ value: a, label: a })),
            ]
        },
        {
            key: "cartera",
            label: "Cartera",
            options: [
                { value: "", label: "Todas las carteras" },
                ...CARTERAS.map(c => ({ value: c, label: c })),
            ]
        },
    ], [uniqueAssets]);

    /* ─── Chart Configs ─── */
    const activeHoldings = holdings.filter(h => h.totalQuantity > 0);


    const doughnutData = {
        labels: summary?.diversification.map(d => d.label) || [],
        datasets: [
            {
                data: summary?.diversification.map(d => d.value) || [],
                backgroundColor: summary?.diversification.map(d => d.color) || [],
                borderWidth: 0,
                hoverOffset: 6,
            },
        ],
    };

    const currencyDoughnutData = {
        labels: summary?.currencyDiversification.map(d => d.label) || [],
        datasets: [
            {
                data: summary?.currencyDiversification.map(d => d.value) || [],
                backgroundColor: summary?.currencyDiversification.map(d => d.color) || [],
                borderWidth: 0,
                hoverOffset: 6,
            },
        ],
    };

    const filteredHistory = useMemo(() => {
        if (history.length <= 1) return history;
        const normalizedRange = (lineChartRange || "all").toLowerCase();
        if (normalizedRange === "all" && !customDateFrom && !customDateTo) {
            return history;
        }

        const now = new Date();
        now.setHours(23, 59, 59, 999);
        let startDate: Date;
        let endDate: Date = now;

        if (normalizedRange === "custom") {
            if (!customDateFrom && !customDateTo) return history;
            startDate = customDateFrom ? toDateObj(customDateFrom) : toDateObj(history[0].date);
            startDate.setHours(0, 0, 0, 0);
            endDate = customDateTo ? toDateObj(customDateTo) : now;
            endDate.setHours(23, 59, 59, 999);
        } else if (normalizedRange === "1m") {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0);
        } else if (normalizedRange === "3m") {
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0, 0);
        } else if (normalizedRange === "6m") {
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0, 0);
        } else if (normalizedRange === "ytd") {
            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        } else if (normalizedRange === "1y") {
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
        } else {
            return history;
        }

        const startTime = startDate.getTime();
        const endTime = endDate.getTime();

        const inRange = history.filter((p) => {
            const t = toDateObj(p.date).getTime();
            return t >= startTime && t <= endTime;
        });

        // Buscar el último punto anterior a startDate para anclar la serie al inicio del período
        const prevPoint = [...history].reverse().find(p => toDateObj(p.date).getTime() < startTime);

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
            return history;
        }

        // Si el primer punto dentro de inRange es posterior a startDate y teníamos un punto anterior,
        // sintetizamos el punto de inicio para que la gráfica arranque exactamente en startDate
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

        return result.length > 0 ? result : history;
    }, [history, lineChartRange, customDateFrom, customDateTo]);

    const barData = useMemo(() => {
        const labels = activeHoldings.map(h => h.asset);
        if (barChartMode === "amounts") {
            return {
                labels,
                datasets: [
                    {
                        label: "Invertido",
                        data: activeHoldings.map(h => h.totalInvested),
                        backgroundColor: "rgba(59, 130, 246, 0.75)",
                        borderColor: "#3b82f6",
                        borderWidth: 1,
                        borderRadius: 6,
                    },
                    {
                        label: "Valor Actual",
                        data: activeHoldings.map(h => h.currentValue),
                        backgroundColor: activeHoldings.map(h =>
                            h.currentValue >= h.totalInvested
                                ? "rgba(34, 197, 94, 0.75)"
                                : "rgba(239, 68, 68, 0.75)"
                        ),
                        borderColor: activeHoldings.map(h =>
                            h.currentValue >= h.totalInvested
                                ? "#22c55e"
                                : "#ef4444"
                        ),
                        borderWidth: 1,
                        borderRadius: 6,
                    },
                ],
            };
        } else {
            return {
                labels,
                datasets: [
                    {
                        label: "Rendimiento (%)",
                        data: activeHoldings.map(h => h.pnlPercent),
                        backgroundColor: activeHoldings.map(h =>
                            h.pnlPercent >= 0
                                ? "rgba(34, 197, 94, 0.75)"
                                : "rgba(239, 68, 68, 0.75)"
                        ),
                        borderColor: activeHoldings.map(h =>
                            h.pnlPercent >= 0
                                ? "#22c55e"
                                : "#ef4444"
                        ),
                        borderWidth: 1,
                        borderRadius: 6,
                    }
                ],
            };
        }
    }, [activeHoldings, barChartMode]);

    const barOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                display: barChartMode === "amounts",
                position: "bottom" as const,
                labels: { font: { size: 12 }, usePointStyle: true, padding: 16 },
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: (context: any) => {
                        const index = context.dataIndex;
                        const h = activeHoldings[index];
                        if (!h) return `${context.dataset.label}: ${context.raw}`;
                        if (barChartMode === "pnl") {
                            const sign = h.pnlPercent >= 0 ? "+" : "";
                            return ` Rendimiento: ${sign}${h.pnlPercent.toFixed(2)}% (${sign}${curSymbol}${fmt(h.pnl)})`;
                        }
                        const val = Number(context.raw);
                        return ` ${context.dataset.label}: ${curSymbol}${fmt(val)}`;
                    },
                    afterBody: (items: any[]) => {
                        if (barChartMode === "pnl") return [];
                        const index = items[0]?.dataIndex;
                        const h = activeHoldings[index];
                        if (!h) return [];
                        const sign = h.pnlPercent >= 0 ? "+" : "";
                        const emoji = h.pnlPercent >= 0 ? "🟢" : "🔴";
                        return [
                            ` `,
                            `${emoji} Resultado Neto: ${sign}${curSymbol}${fmt(h.pnl)} (${sign}${h.pnlPercent.toFixed(2)}%)`
                        ];
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    font: { size: 11 },
                }
            },
            y: {
                grid: { color: "rgba(148,163,184,0.1)" },
                ticks: {
                    font: { size: 11 },
                    callback: (v: string | number) =>
                        barChartMode === "pnl"
                            ? `${Number(v) >= 0 ? "+" : ""}${v}%`
                            : `${curSymbol}${fmtCompact(Number(v))}`
                }
            }
        }
    }), [barChartMode, activeHoldings, curSymbol]);

    const historyData = {
        labels: filteredHistory.map(p => p.date),
        datasets: [
            {
                label: "Valor del Portafolio",
                data: filteredHistory.map(p => p.value),
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.08)",
                fill: true,
                tension: 0.35,
                pointRadius: filteredHistory.map(p => (p.hasBuy || p.hasSell) ? 6 : 2),
                pointHoverRadius: filteredHistory.map(p => (p.hasBuy || p.hasSell) ? 8 : 4),
                pointBackgroundColor: filteredHistory.map(p => p.hasBuy && p.hasSell ? "#f59e0b" : p.hasBuy ? "#22c55e" : p.hasSell ? "#ef4444" : "#3b82f6"),
                pointBorderColor: filteredHistory.map(p => p.hasBuy && p.hasSell ? "#b45309" : p.hasBuy ? "#15803d" : p.hasSell ? "#b91c1c" : "#2563eb"),
                pointBorderWidth: filteredHistory.map(p => (p.hasBuy || p.hasSell) ? 2 : 1),
            },
            {
                label: "Capital Invertido",
                data: filteredHistory.map(p => p.invested),
                borderColor: "#94a3b8",
                backgroundColor: "rgba(148, 163, 184, 0.05)",
                fill: true,
                tension: 0.35,
                borderDash: [6, 3],
                pointRadius: 2,
                pointBackgroundColor: "#94a3b8",
            },
        ],
    };


    const historyCarteraData = {
        labels: filteredHistory.map(p => p.date),
        datasets: CARTERAS.map((c, i) => {
            const colors = ["#22c55e", "#f59e0b", "#3b82f6", "#ef4444"];
            const color = colors[i % colors.length];
            return {
                label: `Valor en ${c}`,
                data: filteredHistory.map(p => p.valueByCartera?.[c] || 0),
                borderColor: color,
                backgroundColor: color + "15",
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: color,
            };
        })
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: "bottom" as const,
                labels: { font: { size: 12 }, usePointStyle: true, padding: 16 },
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    afterBody: (tooltipItems: any[]) => {
                        const index = tooltipItems[0]?.dataIndex;
                        if (index !== undefined && filteredHistory[index]) {
                            const pt = filteredHistory[index];
                            if (pt.hasBuy && pt.hasSell) return [`\n📌 Operaciones: ▲ Compra y ▼ Venta`];
                            if (pt.hasBuy) return [`\n📌 Operación: ▲ Compra`];
                            if (pt.hasSell) return [`\n📌 Operación: ▼ Venta`];
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
                        const label = this.getLabelForValue(val as number);
                        if (typeof label === "string" && label.length >= 8) {
                            const parts = label.split("/");
                            if (parts.length === 3) {
                                return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
                            }
                        }
                        return label;
                    }
                }
            },
            y: {
                grid: { color: "rgba(148,163,184,0.1)" },
                ticks: {
                    font: { size: 11 },
                    callback: (v: string | number) => `${curSymbol}${fmtCompact(Number(v))}`,
                },
            },
        },
    };

    const chartOptionsStacked = {
        ...chartOptions,
        scales: {
            ...chartOptions.scales,
            y: {
                ...chartOptions.scales.y,
                stacked: true,
            }
        }
    };

    /* ─── Render ─── */
    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner} />
                <p>Cargando inversiones...</p>
            </div>
        );
    }

    return (
        <div className={styles.dashboard} id="inversiones-dashboard">
            <ConfirmDialog
                isOpen={!!dialogDeleteId}
                title="Eliminar transacción"
                message="¿Eliminar esta transacción? Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                cancelLabel="Cancelar"
                danger
                onConfirm={handleConfirmDelete}
                onCancel={() => setDialogDeleteId(null)}
            />

            {/* ── Top Bar with Currency Selector ── */}
            <div className={styles.topBar}>
                <div className={styles.topBarTitle}>
                    <span>Portafolio de Inversiones</span>
                </div>

                <div className={styles.currencyToggle}>
                    <button
                        type="button"
                        className={`${styles.currencyBtn} ${displayCurrency === "ARS" ? styles.currencyBtnActive : ""}`}
                        onClick={() => setDisplayCurrency("ARS")}
                        id="btn-currency-ars"
                    >
                        🇦🇷 ARS
                    </button>
                    <button
                        type="button"
                        className={`${styles.currencyBtn} ${displayCurrency === "USD" ? styles.currencyBtnActive : ""}`}
                        onClick={() => setDisplayCurrency("USD")}
                        id="btn-currency-usd"
                    >
                        🇺🇸 USD
                    </button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className={styles.summaryGrid}>
                <div className={`glass-panel ${styles.summaryCard}`}>
                    <span className={styles.cardLabel}>Balance Total ({displayCurrency})</span>
                    <span className={styles.cardValue}>
                        {curSymbol}{fmt(summary?.totalCurrentValue || 0)}
                    </span>
                    <span className={styles.cardSmall}>
                        Invertido: {curSymbol}{fmt(summary?.totalInvested || 0)}
                    </span>
                </div>

                <div className={`glass-panel ${styles.summaryCard}`}>
                    <span className={styles.cardLabel}>P&L No Realizado</span>
                    <span
                        className={`${styles.cardValue} ${
                            (summary?.totalPnl || 0) >= 0 ? styles.positive : styles.negative
                        }`}
                    >
                        {(summary?.totalPnl || 0) >= 0 ? "+" : ""}
                        {curSymbol}{fmt(summary?.totalPnl || 0)}
                    </span>
                    <span
                        className={`${styles.cardSmall} ${
                            (summary?.totalPnlPercent || 0) >= 0 ? styles.positive : styles.negative
                        }`}
                    >
                        {(summary?.totalPnlPercent || 0) >= 0 ? "▲" : "▼"}{" "}
                        {Math.abs(summary?.totalPnlPercent || 0).toFixed(2)}%
                    </span>
                </div>

                <div className={`glass-panel ${styles.summaryCard}`}>
                    <span className={styles.cardLabel}>P&L Realizado</span>
                    <span
                        className={`${styles.cardValue} ${
                            (summary?.totalRealizedPnl || 0) >= 0 ? styles.positive : styles.negative
                        }`}
                    >
                        {(summary?.totalRealizedPnl || 0) >= 0 ? "+" : ""}
                        {curSymbol}{fmt(summary?.totalRealizedPnl || 0)}
                    </span>
                    <span className={styles.cardSmall}>
                        Ganancia consolidada
                    </span>
                </div>

                <div className={`glass-panel ${styles.summaryCard}`}>
                    <span className={styles.cardLabel}>Rendimiento (TWR)</span>
                    <span
                        className={`${styles.cardValue} ${
                            (summary?.twr || 0) >= 0 ? styles.positive : styles.negative
                        }`}
                    >
                        {(summary?.twr || 0) >= 0 ? "+" : ""}
                        {(summary?.twr || 0).toFixed(2)}%
                    </span>
                    <span className={styles.cardSmall}>
                        Time-Weighted Return
                    </span>
                </div>

                <div className={`glass-panel ${styles.summaryCard}`}>
                    <span className={styles.cardLabel}>Dólar MEP</span>
                    <span className={styles.cardValue}>
                        ${fmt(mepRate || cclRate || 0)}
                    </span>
                    <span className={styles.cardSmall}>
                        Tipo de cambio bolsa
                    </span>
                </div>

            </div>

            {/* ── New Transaction Toggle & Sync ── */}
            <section className={`glass-panel ${styles.section}`}>
                <div className={styles.sectionHeader}>
                    <h3>Operaciones de Inversión</h3>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            className={styles.toggleBtn}
                            onClick={() => setShowAdvancedTools(true)}
                            title="Herramientas avanzadas: Sincronización, Mantenimiento y Respaldos"
                            style={{
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid var(--glass-border)",
                                color: "var(--text-main)",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                            }}
                        >
                            <span>⚙️</span>
                            <span>Herramientas</span>
                        </button>
                        <button
                            type="button"
                            className={styles.toggleBtn}
                            onClick={() => setShowForm(!showForm)}
                            id="inv-toggle-form"
                        >
                            {showForm ? "✕ Cerrar" : "+ Registrar"}
                        </button>
                    </div>
                </div>

                {showForm && (
                    <TransactionForm
                        onTransactionAdded={() => {
                            fetchData();
                            setShowForm(false);
                        }}
                    />
                )}
            </section>

            {/* ── Holdings Table ── */}
            {activeHoldings.length > 0 && (
                <section className={`glass-panel ${styles.section}`}>
                    <h3 style={{ marginBottom: 16 }}>Portafolio ({displayCurrency})</h3>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table} id="inv-holdings-table">
                            <thead>
                                <tr>
                                    <th>Activo</th>
                                    <th>Tipo</th>
                                    <th>Cantidad</th>
                                    <th>Avg Cost ({displayCurrency})</th>
                                    <th>Precio Actual ({displayCurrency})</th>
                                    <th>Valor ({displayCurrency})</th>
                                    <th>P&L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeHoldings.map(h => (
                                    <tr key={h.asset}>
                                        <td>
                                            <span className={styles.assetBadge}>
                                                <span
                                                    className={styles.assetDot}
                                                    style={{
                                                        backgroundColor:
                                                            ASSET_TYPE_COLORS[h.assetType] || "#94a3b8",
                                                    }}
                                                />
                                                {h.asset}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={styles.typeBadge}>{h.assetType}</span>
                                        </td>
                                        <td>{h.totalQuantity < 1 ? h.totalQuantity.toFixed(8) : fmt(h.totalQuantity)}</td>
                                        <td>{curSymbol}{fmt(h.averageCost)}</td>
                                        <td>
                                            {editingPrice === h.asset ? (
                                                <div className={styles.priceEditWrapper}>
                                                    <input
                                                        ref={priceInputRef}
                                                        type="number"
                                                        step="any"
                                                        className={styles.priceInput}
                                                        value={priceInput}
                                                        onChange={e => setPriceInput(e.target.value)}
                                                        onBlur={() => handlePriceSave(h.asset)}
                                                        onKeyDown={e => {
                                                            if (e.key === "Enter") handlePriceSave(h.asset);
                                                            if (e.key === "Escape") setEditingPrice(null);
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <button
                                                    className={`${styles.priceBtn} ${h.currentPrice > 0 && priceSources[h.asset] ? styles.priceBtnAuto : ""}`}
                                                    onClick={() => handlePriceEdit(h.asset)}
                                                    title={
                                                        h.currentPrice > 0 && priceSources[h.asset]
                                                            ? `Fuente: ${priceSources[h.asset]} — Click para editar manualmente`
                                                            : `Click para ingresar precio en ${displayCurrency}`
                                                    }
                                                >
                                                    {h.currentPrice > 0
                                                        ? `${curSymbol}${fmt(h.currentPrice)}`
                                                        : `Ingresar ${displayCurrency}`
                                                    }
                                                    {h.currentPrice > 0 && priceSources[h.asset]
                                                        ? <span className={styles.liveIcon} title={priceSources[h.asset]}>●</span>
                                                        : <span className={styles.editIcon}>✎</span>
                                                    }
                                                </button>
                                            )}
                                        </td>
                                        <td>{curSymbol}{fmt(h.currentValue)}</td>
                                        <td>
                                            <span
                                                className={
                                                    h.pnl >= 0 ? styles.positive : styles.negative
                                                }
                                            >
                                                {h.pnl >= 0 ? "+" : ""}{curSymbol}{fmt(h.pnl)}
                                                <br />
                                                <small>
                                                    {h.pnlPercent >= 0 ? "▲" : "▼"}{" "}
                                                    {Math.abs(h.pnlPercent).toFixed(2)}%
                                                </small>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ── Charts Row ── */}
            {activeHoldings.length > 0 && (
                <div className={styles.chartsGrid}>
                    <section className={`glass-panel ${styles.section} ${styles.chartCard}`}>
                        <h3 style={{ marginBottom: 12 }}>Diversificación</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-around' }}>
                            <div className={styles.chartContainer} style={{ width: 220, height: 220, margin: "0 auto" }}>
                                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Por Tipo</p>
                                <Doughnut
                                    data={doughnutData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        cutout: "65%",
                                        plugins: {
                                            legend: {
                                                position: "bottom",
                                                labels: { font: { size: 11 }, usePointStyle: true, padding: 8 },
                                            },
                                        },
                                    }}
                                />
                            </div>
                            <div className={styles.chartContainer} style={{ width: 220, height: 220, margin: "0 auto" }}>
                                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Por Moneda (ARS/USD)</p>
                                <Doughnut
                                    data={currencyDoughnutData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        cutout: "65%",
                                        plugins: {
                                            legend: {
                                                position: "bottom",
                                                labels: { font: { size: 11 }, usePointStyle: true, padding: 8 },
                                            },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </section>

                    <section className={`glass-panel ${styles.section} ${styles.chartCard}`}>
                        <div className={styles.cardHeaderWithControls}>
                            <h3>
                                {barChartMode === "amounts"
                                    ? `Invertido vs. Actual (${displayCurrency})`
                                    : "Rendimiento por Activo (%)"}
                            </h3>
                            <div className={styles.barModeToggle}>
                                <button
                                    type="button"
                                    className={`${styles.modePillBtn} ${barChartMode === "amounts" ? styles.modePillActive : ""}`}
                                    onClick={() => setBarChartMode("amounts")}
                                >
                                    Montos ($)
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.modePillBtn} ${barChartMode === "pnl" ? styles.modePillActive : ""}`}
                                    onClick={() => setBarChartMode("pnl")}
                                >
                                    Rendimiento (%)
                                </button>
                            </div>
                        </div>
                        <div className={styles.chartContainer}>
                            <Bar data={barData} options={barOptions} />
                        </div>
                    </section>
                </div>
            )}

            {/* ── Portfolio Evolution Line Charts ── */}
            {history.length > 1 && (
                <>
                {/* ── Line Charts Date Range Toolbar ── */}
                <div className={styles.dateRangeToolbar}>
                    <div className={styles.dateRangeTitle}>
                        <span>📅 Período de Evolución:</span>
                    </div>
                    <div className={styles.dateRangeControls}>
                        <div className={styles.presetGroup}>
                            {(
                                [
                                    { label: "Todo", value: "all" },
                                    { label: "1M", value: "1m" },
                                    { label: "3M", value: "3m" },
                                    { label: "6M", value: "6m" },
                                    { label: "Este año", value: "ytd" },
                                    { label: "1A", value: "1y" },
                                    { label: "Personalizado", value: "custom" },
                                ] as const
                            ).map(preset => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    className={`${styles.presetBtn} ${lineChartRange === preset.value ? styles.presetBtnActive : ""}`}
                                    onClick={() => setLineChartRange(preset.value)}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {lineChartRange === "custom" && (
                            <div className={styles.customDateInputs}>
                                <div className={styles.dateFieldGroup}>
                                    <label className={styles.dateFieldLabel}>Desde:</label>
                                    <input
                                        type="date"
                                        className={styles.dateInput}
                                        value={customDateFrom}
                                        onChange={e => setCustomDateFrom(e.target.value)}
                                    />
                                </div>
                                <div className={styles.dateFieldGroup}>
                                    <label className={styles.dateFieldLabel}>Hasta:</label>
                                    <input
                                        type="date"
                                        className={styles.dateInput}
                                        value={customDateTo}
                                        onChange={e => setCustomDateTo(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <section className={`glass-panel ${styles.section}`}>
                    <h3 style={{ marginBottom: 12 }}>Evolución del Portafolio ({displayCurrency})</h3>
                    <div className={styles.chartContainerWide}>
                        <Line
                            key={`port-evo-${lineChartRange}-${customDateFrom}-${customDateTo}-${filteredHistory.length}`}
                            data={historyData}
                            options={chartOptions}
                        />
                    </div>
                </section>

                <PerformanceBenchmarkCard
                    transactions={transactions}
                    activePrices={activePrices}
                    displayCurrency={displayCurrency}
                    cclRate={cclRate}
                    mepRate={mepRate}
                    benchmarkData={benchmarkData}
                    dateRangePreset={lineChartRange}
                    customDateFrom={customDateFrom}
                    customDateTo={customDateTo}
                />

                <section className={`glass-panel ${styles.section}`}>
                    <h3 style={{ marginBottom: 12 }}>Evolución por Cartera ({displayCurrency})</h3>
                    <div className={styles.chartContainerWide}>
                        <Line
                            key={`cartera-evo-${lineChartRange}-${customDateFrom}-${customDateTo}-${filteredHistory.length}`}
                            data={historyCarteraData}
                            options={chartOptionsStacked}
                        />
                    </div>
                </section>
                </>
            )}

            {/* ── Transaction History ── */}
            <section className={`glass-panel ${styles.section}`}>
                <div className={styles.sectionHeader} style={{ marginBottom: "16px" }}>
                    <h3>Historial de Operaciones</h3>
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className={styles.toggleBtn}
                        title="Descargar todas las operaciones de inversión en formato CSV (Excel)"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            background: "var(--glass-bg)",
                            border: "1px solid var(--glass-border)",
                            color: "var(--text-main)",
                            fontSize: "0.85rem",
                            padding: "8px 14px",
                            cursor: "pointer",
                            borderRadius: "10px"
                        }}
                    >
                        <span>📥</span>
                        <span>Descargar CSV</span>
                    </button>
                </div>

                <EditableTable
                    columns={investmentColumns}
                    rows={investmentRows}
                    onEdit={handleEditInvestment}
                    onDelete={handleDelete}
                    idField="id"
                    searchable={true}
                    filters={investmentFilters}
                    defaultSortKey="date"
                    defaultSortDir="desc"
                    initialLimit={10}
                    loadMoreLabel="Cargar total"
                    emptyMessage={transactions.length === 0
                        ? "No hay operaciones registradas. ¡Registra tu primera inversión!"
                        : "No se encontraron operaciones con los filtros seleccionados."}
                />

            </section>

            {/* ── Data Sources Footer ── */}
            <footer className={`glass-panel ${styles.sourcesFooter}`}>
                <div className={styles.footerHeader}>
                    <h4>ℹ️ Fuentes de Datos y Cotizaciones</h4>
                    <p className={styles.footerSubtitle}>
                        Valores de activos actualizados en tiempo real y cotizaciones históricas obtenidas de fuentes públicas verificadas:
                    </p>
                </div>
                <div className={styles.sourcesGrid}>
                    <div className={styles.sourceItem}>
                        <span className={styles.sourceTag}>💵 Dólar CCL</span>
                        <p className={styles.sourceDesc}>
                            Cotizaciones en vivo vía <a href="https://dolarapi.com" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>DolarAPI</a> e histórico diario vía <a href="https://argentinadatos.com" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>ArgentinaDatos</a>.
                        </p>
                    </div>
                    <div className={styles.sourceItem}>
                        <span className={styles.sourceTag}>🪙 Criptomonedas</span>
                        <p className={styles.sourceDesc}>
                            Precios spot en USD provistos por <a href="https://www.binance.com" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>Binance API</a> con respaldo de <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>CoinGecko</a>.
                        </p>
                    </div>
                    <div className={styles.sourceItem}>
                        <span className={styles.sourceTag}>📈 Acciones y Bonos (BYMA)</span>
                        <p className={styles.sourceDesc}>
                            Panel local y títulos públicos vía <a href="https://analisistecnico.com.ar" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>AnalisisTecnico (BYMA)</a> y <a href="https://finance.yahoo.com" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>Yahoo Finance (.BA)</a>.
                        </p>
                    </div>
                    <div className={styles.sourceItem}>
                        <span className={styles.sourceTag}>🌎 CEDEARs & ETFs</span>
                        <p className={styles.sourceDesc}>
                            Certificados de depósito y fondos cotizados provistos por <a href="https://www.byma.com.ar" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>BYMA</a> y <a href="https://finance.yahoo.com" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>Yahoo Finance</a>.
                        </p>
                    </div>
                    <div className={styles.sourceItem}>
                        <span className={styles.sourceTag}>📊 Inflación IPC</span>
                        <p className={styles.sourceDesc}>
                            Índice de Precios al Consumidor oficial del <a href="https://www.indec.gob.ar" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>INDEC</a> provisto por <a href="https://argentinadatos.com" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>ArgentinaDatos</a>.
                        </p>
                    </div>
                </div>
            </footer>

            {showAdvancedTools && (
                <AdvancedToolsModal
                    onClose={() => {
                        setShowAdvancedTools(false);
                        fetchData();
                    }}
                    onOpenImport={() => {
                        setShowAdvancedTools(false);
                        setShowImportModal(true);
                    }}
                    onCleanSuccess={fetchData}
                    transactions={transactions}
                />
            )}

            {showImportModal && (
                <ImportPortfolioModal
                    onClose={() => setShowImportModal(false)}
                    onSuccess={() => {
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}





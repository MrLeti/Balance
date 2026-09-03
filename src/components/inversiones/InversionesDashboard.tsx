"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import styles from "./InversionesDashboard.module.css";
import TransactionForm from "./TransactionForm";
import ConfirmDialog from "@/components/layout/ConfirmDialog";
import EditableTable, { ColumnDef, FilterDef } from "@/components/shared/EditableTable";
import AdvancedToolsModal from "./AdvancedToolsModal";
import ImportPortfolioModal from "./ImportPortfolioModal";
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
        mep: { date: string; rate: number }[];
        inflation: { date: string; rate: number }[];
    }>({ sp500: [], mep: [], inflation: [] });

    // Benchmark visibility toggles
    const [showSP500, setShowSP500] = useState(true);
    const [showMepBenchmark, setShowMepBenchmark] = useState(true);
    const [showInflationBenchmark, setShowInflationBenchmark] = useState(true);

    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [dialogDeleteId, setDialogDeleteId] = useState<string | null>(null);

    // Filters
    const [filterType, setFilterType] = useState<"all" | "Compra" | "Venta" | "Split">("all");
    const [filterAsset, setFilterAsset] = useState<string>("");
    const [filterCartera, setFilterCartera] = useState<string>("all");

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

            // Benchmark (S&P 500, MEP, Inflación)
            try {
                const bmRes = await fetch("/api/investments/benchmark");
                if (bmRes.ok) {
                    const bmJson = await bmRes.json();
                    setBenchmarkData({
                        sp500: bmJson.sp500 || [],
                        mep: bmJson.mep || [],
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

    const barData = {
        labels: activeHoldings.map(h => h.asset),
        datasets: [
            {
                label: "Invertido",
                data: activeHoldings.map(h => h.totalInvested),
                backgroundColor: "rgba(59, 130, 246, 0.7)",
                borderRadius: 6,
            },
            {
                label: "Valor Actual",
                data: activeHoldings.map(h => h.currentValue),
                backgroundColor: "rgba(34, 197, 94, 0.7)",
                borderRadius: 6,
            },
        ],
    };

    const historyData = {
        labels: history.map(p => p.date),
        datasets: [
            {
                label: "Valor del Portafolio",
                data: history.map(p => p.value),
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.08)",
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: "#3b82f6",
            },
            {
                label: "Capital Invertido",
                data: history.map(p => p.invested),
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

    // ─── Multi-Benchmark Relative Performance (%) ───
    const relativePerformanceData = React.useMemo(() => {
        if (history.length === 0) return { labels: [], datasets: [] };

        const labels = history.map(p => p.date);
        
        // 1. Rendimiento del portafolio (%) en cada punto usando TWR acumulado
        const portfolioReturns = history.map(p => {
            if (p.twrPercent !== undefined) return p.twrPercent;
            if (p.invested <= 0) return 0;
            return Number((((p.value - p.invested) / p.invested) * 100).toFixed(2));
        });

        // Helper para obtener cotización MEP más cercana a una fecha
        const getClosestMepRate = (targetDateStr: string, fallbackRate: number = 1): number => {
            if (!benchmarkData.mep || benchmarkData.mep.length === 0) return fallbackRate;
            const [d, m, y] = targetDateStr.split("/").map(Number);
            const isoi = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const targetTime = new Date(isoi).getTime();
            let closest = benchmarkData.mep[0].rate;
            let minDiff = Infinity;
            for (const item of benchmarkData.mep) {
                const diff = Math.abs(new Date(item.date).getTime() - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = item.rate;
                }
            }
            return closest > 0 ? closest : fallbackRate;
        };

        const [d0, m0, y0] = history[0].date.split("/").map(Number);
        const t0 = new Date(y0, m0 - 1, d0).getTime() / 1000;
        const baseMep = getClosestMepRate(history[0].date, mepRate || cclRate || 1);

        // 2. Rendimiento acumulado del S&P 500 (%)
        // Si displayCurrency === 'ARS', se multiplica por el tipo de cambio para medir S&P 500 en pesos
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

            const baseSPPrice = displayCurrency === "ARS" ? baseSPPriceUSD * baseMep : baseSPPriceUSD;

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

                const currentMep = getClosestMepRate(p.date, baseMep);
                const currentSPPrice = displayCurrency === "ARS" ? closestUSD * currentMep : closestUSD;

                if (baseSPPrice <= 0) return 0;
                return Number((((currentSPPrice - baseSPPrice) / baseSPPrice) * 100).toFixed(2));
            });
        }

        // 3. Rendimiento acumulado del Dólar MEP (%)
        let mepReturns: number[] = [];
        if (benchmarkData.mep && benchmarkData.mep.length > 0) {
            mepReturns = history.map(p => {
                if (displayCurrency === "USD") {
                    // En dólares, el dólar no tiene variación nominal propia (0%)
                    return 0;
                }
                const currentMep = getClosestMepRate(p.date, baseMep);
                if (baseMep <= 0) return 0;
                return Number((((currentMep - baseMep) / baseMep) * 100).toFixed(2));
            });
        }

        // 4. Rendimiento acumulado de la Inflación IPC (%)
        let inflationReturns: number[] = [];
        if (benchmarkData.inflation && benchmarkData.inflation.length > 0) {
            const date0 = new Date(y0, m0 - 1, d0);
            const sortedInf = [...benchmarkData.inflation].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            inflationReturns = history.map(p => {
                const [d, m, y] = p.date.split("/").map(Number);
                const targetDate = new Date(y, m - 1, d);
                
                let cumFactor = 1.0;
                for (const item of sortedInf) {
                    const itemDate = new Date(item.date);
                    if (itemDate >= date0 && itemDate <= targetDate) {
                        cumFactor *= (1 + (item.rate / 100));
                    }
                }

                if (displayCurrency === "USD") {
                    // Inflación en términos de USD (ajustada por devaluación del MEP)
                    const currentMep = getClosestMepRate(p.date, baseMep);
                    const fxDevaluationFactor = baseMep > 0 ? (currentMep / baseMep) : 1;
                    const usdInflationFactor = fxDevaluationFactor > 0 ? (cumFactor / fxDevaluationFactor) : cumFactor;
                    return Number(((usdInflationFactor - 1) * 100).toFixed(2));
                }

                return Number(((cumFactor - 1) * 100).toFixed(2));
            });
        }

        // Armar datasets según visibilidad
        const datasets: any[] = [
            {
                label: `Portafolio TWR (${displayCurrency})`,
                data: portfolioReturns,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: "#3b82f6",
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

        if (showMepBenchmark && displayCurrency === "ARS" && mepReturns.length > 0) {
            datasets.push({
                label: "Dólar MEP (ARS)",
                data: mepReturns,
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
    }, [history, benchmarkData, displayCurrency, mepRate, cclRate, showSP500, showMepBenchmark, showInflationBenchmark]);

    const historyCarteraData = {
        labels: history.map(p => p.date),
        datasets: CARTERAS.map((c, i) => {
            const colors = ["#22c55e", "#f59e0b", "#3b82f6", "#ef4444"];
            const color = colors[i % colors.length];
            return {
                label: `Valor en ${c}`,
                data: history.map(p => p.valueByCartera?.[c] || 0),
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
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: {
                grid: { color: "rgba(148,163,184,0.1)" },
                ticks: {
                    font: { size: 11 },
                    callback: (v: string | number) => `${curSymbol}${fmtCompact(Number(v))}`,
                },
            },
        },
    };

    const chartOptionsPercent = {
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: (context: any) => `${context.dataset.label}: ${context.raw >= 0 ? '+' : ''}${context.raw}%`
                }
            }
        },
        scales: {
            ...chartOptions.scales,
            y: {
                grid: { color: "rgba(148,163,184,0.1)" },
                ticks: {
                    font: { size: 11 },
                    callback: (v: string | number) => `${Number(v) >= 0 ? '+' : ''}${v}%`,
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
                        <h3 style={{ marginBottom: 12 }}>Invertido vs. Actual ({displayCurrency})</h3>
                        <div className={styles.chartContainer}>
                            <Bar data={barData} options={chartOptions} />
                        </div>
                    </section>
                </div>
            )}

            {/* ── Portfolio Evolution Line Charts ── */}
            {history.length > 1 && (
                <>
                <section className={`glass-panel ${styles.section}`}>
                    <h3 style={{ marginBottom: 12 }}>Evolución del Portafolio ({displayCurrency})</h3>
                    <div className={styles.chartContainerWide}>
                        <Line data={historyData} options={chartOptions} />
                    </div>
                </section>

                <section className={`glass-panel ${styles.section}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                        <h3 style={{ margin: 0 }}>Rendimiento Acumulado (% vs. Benchmarks)</h3>
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
                                className={`${styles.benchmarkChip} ${showMepBenchmark ? styles.benchmarkChipActive : ""}`}
                                onClick={() => setShowMepBenchmark(!showMepBenchmark)}
                            >
                                <span className={styles.chipDot} style={{ backgroundColor: "#10b981" }} />
                                Dólar MEP
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
                    <div className={styles.chartContainerWide}>
                        <Line data={relativePerformanceData} options={chartOptionsPercent} />
                    </div>
                </section>

                <section className={`glass-panel ${styles.section}`}>
                    <h3 style={{ marginBottom: 12 }}>Evolución por Cartera ({displayCurrency})</h3>
                    <div className={styles.chartContainerWide}>
                        <Line data={historyCarteraData} options={chartOptionsStacked} />
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
                        <span className={styles.sourceTag}>💵 Dólar MEP</span>
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





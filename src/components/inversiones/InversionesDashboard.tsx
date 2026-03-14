"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./InversionesDashboard.module.css";
import TransactionForm from "./TransactionForm";
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
    const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
    const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
    const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Filters
    const [filterType, setFilterType] = useState<"all" | "Compra" | "Venta">("all");
    const [filterAsset, setFilterAsset] = useState("");
    const [filterCartera, setFilterCartera] = useState<"all" | Cartera>("all");

    // Show/hide form
    const [showForm, setShowForm] = useState(false);

    // Prices being edited
    const [editingPrice, setEditingPrice] = useState<string | null>(null);
    const [priceInput, setPriceInput] = useState("");
    const priceInputRef = useRef<HTMLInputElement>(null);
    const [priceSources, setPriceSources] = useState<Record<string, string>>({});
    // USD reference prices from Yahoo Finance (equities only — not used for P&L)
    const [priceUSD, setPriceUSD] = useState<Record<string, number>>({});

    /* ─── Data Fetching ─── */
    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/investments");
            if (!res.ok) throw new Error("Error al cargar inversiones");
            const json = await res.json();
            // UNFORMATTED_VALUE rows can contain number | string | boolean cells
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rows: any[][] = json.data || [];
            const txs = rows.map(parseSheetRow);
            setTransactions(txs);

            // Fetch live prices for ALL assets (Cripto via CoinGecko, rest via Yahoo Finance)
            const allAssets = [...new Set(txs.map(t => t.asset))];
            const allTypes = allAssets.map(a => {
                const tx = txs.find(t => t.asset === a);
                return tx?.assetType ?? "Acciones";
            });

            if (allAssets.length > 0) {
                try {
                    const priceRes = await fetch(
                        `/api/investments/prices?assets=${allAssets.join(",")}&types=${allTypes.join(",")}`
                    );
                    if (priceRes.ok) {
                        const priceJson = await priceRes.json();
                        const livePrices: Record<string, number> = {};
                        const liveSources: Record<string, string> = {};
                        for (const [ticker, data] of Object.entries(priceJson.prices)) {
                            const p = data as { ars: number; usd: number; source: string };
                            if (p.ars > 0) {
                                livePrices[ticker] = p.ars;
                                liveSources[ticker] = p.source;
                            }
                        }
                        setCurrentPrices(prev => ({ ...prev, ...livePrices }));
                        setPriceSources(prev => ({ ...prev, ...liveSources }));
                    }
                } catch {
                    // Continue without live prices
                }
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /** Recalculate portfolio whenever transactions or prices change */
    useEffect(() => {
        if (transactions.length === 0) {
            setHoldings([]);
            setSummary(null);
            setHistory([]);
            return;
        }
        const h = buildPortfolio(transactions, currentPrices);
        setHoldings(h);
        setSummary(getPortfolioSummary(h));
        setHistory(getPortfolioHistory(transactions, currentPrices));
    }, [transactions, currentPrices]);

    /* ─── Handlers ─── */
    const handleDelete = async (id: string) => {
        if (deleting) return;
        if (!confirm("¿Eliminar esta transacción?")) return;
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

    const handlePriceEdit = (asset: string) => {
        setEditingPrice(asset);
        setPriceInput(String(currentPrices[asset] || ""));
        setTimeout(() => priceInputRef.current?.focus(), 50);
    };

    const handlePriceSave = (asset: string) => {
        const val = parseFloat(priceInput);
        if (!isNaN(val) && val >= 0) {
            setCurrentPrices(prev => ({ ...prev, [asset]: val }));
        }
        setEditingPrice(null);
    };

    /* ─── Filtered Transactions ─── */
    const filteredTxs = transactions
        .filter(t => filterType === "all" || t.type === filterType)
        .filter(t => !filterAsset || t.asset.toUpperCase().includes(filterAsset.toUpperCase()))
        .filter(t => filterCartera === "all" || t.cartera === filterCartera)
        .sort((a, b) => {
            const [da, ma, ya] = a.date.split("/").map(Number);
            const [db, mb, yb] = b.date.split("/").map(Number);
            return (yb - ya) || (mb - ma) || (db - da);
        });

    const uniqueAssets = [...new Set(transactions.map(t => t.asset))];

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

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: "bottom" as const,
                labels: { font: { size: 12 }, usePointStyle: true, padding: 16 },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: {
                grid: { color: "rgba(148,163,184,0.1)" },
                ticks: {
                    font: { size: 11 },
                    callback: (v: string | number) => `$${fmtCompact(Number(v))}`,
                },
            },
        },
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
            {/* ── Summary Cards ── */}
            <div className={styles.summaryGrid}>
                <div className={`glass-panel ${styles.summaryCard}`}>
                    <span className={styles.cardLabel}>Balance Total</span>
                    <span className={styles.cardValue}>
                        ${fmt(summary?.totalCurrentValue || 0)}
                    </span>
                    <span className={styles.cardSmall}>
                        Invertido: ${fmt(summary?.totalInvested || 0)}
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
                        ${fmt(summary?.totalPnl || 0)}
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
                        ${fmt(summary?.totalRealizedPnl || 0)}
                    </span>
                    <span className={styles.cardSmall}>
                        {summary?.holdingsCount || 0} activo{(summary?.holdingsCount || 0) !== 1 ? "s" : ""}
                    </span>
                </div>
            </div>

            {/* ── New Transaction Toggle ── */}
            <section className={`glass-panel ${styles.section}`}>
                <div className={styles.sectionHeader}>
                    <h3>Nueva Operación</h3>
                    <button
                        className={styles.toggleBtn}
                        onClick={() => setShowForm(!showForm)}
                        id="inv-toggle-form"
                    >
                        {showForm ? "✕ Cerrar" : "+ Registrar"}
                    </button>
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
                    <h3 style={{ marginBottom: 16 }}>Portafolio</h3>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table} id="inv-holdings-table">
                            <thead>
                                <tr>
                                    <th>Activo</th>
                                    <th>Tipo</th>
                                    <th>Cantidad</th>
                                    <th>Avg Cost</th>
                                    <th>Precio Actual</th>
                                    <th>Valor</th>
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
                                        <td>${fmt(h.averageCost)}</td>
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
                                                            : "Click para ingresar precio ARS"
                                                    }
                                                >
                                                    {h.currentPrice > 0
                                                        ? `$${fmt(h.currentPrice)}`
                                                        : "Ingresar ARS"
                                                    }
                                                    {h.currentPrice > 0 && priceSources[h.asset]
                                                        ? <span className={styles.liveIcon} title={priceSources[h.asset]}>●</span>
                                                        : <span className={styles.editIcon}>✎</span>
                                                    }
                                                </button>
                                            )}
                                        </td>
                                        <td>${fmt(h.currentValue)}</td>
                                        <td>
                                            <span
                                                className={
                                                    h.pnl >= 0 ? styles.positive : styles.negative
                                                }
                                            >
                                                {h.pnl >= 0 ? "+" : ""}${fmt(h.pnl)}
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
                    {/* Diversification Doughnut */}
                    <section className={`glass-panel ${styles.section} ${styles.chartCard}`}>
                        <h3 style={{ marginBottom: 12 }}>Diversificación</h3>
                        <div className={styles.chartContainer} style={{ maxWidth: 280, margin: "0 auto" }}>
                            <Doughnut
                                data={doughnutData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: true,
                                    cutout: "65%",
                                    plugins: {
                                        legend: {
                                            position: "bottom",
                                            labels: { font: { size: 12 }, usePointStyle: true, padding: 12 },
                                        },
                                    },
                                }}
                            />
                        </div>
                    </section>

                    {/* Bar Chart: Invested vs Current */}
                    <section className={`glass-panel ${styles.section} ${styles.chartCard}`}>
                        <h3 style={{ marginBottom: 12 }}>Invertido vs. Actual</h3>
                        <div className={styles.chartContainer}>
                            <Bar data={barData} options={chartOptions} />
                        </div>
                    </section>
                </div>
            )}

            {/* ── Portfolio Evolution Line Chart ── */}
            {history.length > 1 && (
                <section className={`glass-panel ${styles.section}`}>
                    <h3 style={{ marginBottom: 12 }}>Evolución del Portafolio</h3>
                    <div className={styles.chartContainerWide}>
                        <Line data={historyData} options={chartOptions} />
                    </div>
                </section>
            )}

            {/* ── Transaction History ── */}
            <section className={`glass-panel ${styles.section}`}>
                <div className={styles.sectionHeader}>
                    <h3>Historial de Operaciones</h3>
                    <span className={styles.txCount}>{filteredTxs.length} operaciones</span>
                </div>

                {/* Filters */}
                <div className={styles.filters}>
                    <select
                        className={styles.filterSelect}
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as "all" | "Compra" | "Venta")}
                        id="inv-filter-type"
                    >
                        <option value="all">Todas</option>
                        <option value="Compra">Compras</option>
                        <option value="Venta">Ventas</option>
                    </select>

                    <select
                        className={styles.filterSelect}
                        value={filterAsset}
                        onChange={e => setFilterAsset(e.target.value)}
                        id="inv-filter-asset"
                    >
                        <option value="">Todos los activos</option>
                        {uniqueAssets.map(a => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>

                    <select
                        className={styles.filterSelect}
                        value={filterCartera}
                        onChange={e => setFilterCartera(e.target.value as "all" | Cartera)}
                        id="inv-filter-cartera"
                    >
                        <option value="all">Todas las carteras</option>
                        {CARTERAS.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                {filteredTxs.length === 0 ? (
                    <p className={styles.emptyMsg}>
                        {transactions.length === 0
                            ? "No hay operaciones registradas. ¡Registra tu primera inversión!"
                            : "No se encontraron operaciones con los filtros seleccionados."}
                    </p>
                ) : (
                    <div className={styles.txList}>
                        {filteredTxs.map(tx => (
                            <div key={tx.id} className={styles.txItem}>
                                    <div className={styles.txMain}>
                                        <span
                                            className={`${styles.txTypeBadge} ${
                                                tx.type === "Compra" ? styles.txBuy : styles.txSell
                                            }`}
                                        >
                                            {tx.type === "Compra" ? "▲" : "▼"} {tx.type}
                                        </span>
                                        <span className={styles.txAsset}>{tx.asset}</span>
                                        <span className={styles.txTypeName}>{tx.assetType}</span>
                                        <span className={`${styles.carteraBadge} ${tx.cartera === "Jubilación" ? styles.carteraJubilacion : styles.carteraCrecimiento}`}>
                                            {tx.cartera === "Jubilación" ? "🏦" : "🚀"} {tx.cartera}
                                        </span>
                                    </div>
                                <div className={styles.txDetails}>
                                    <span>
                                        {tx.quantity < 1 ? tx.quantity.toFixed(6) : fmt(tx.quantity)} × ${fmt(tx.unitPrice)}
                                    </span>
                                    {tx.commission > 0 && (
                                        <span className={styles.txCommission}>
                                            Com: ${fmt(tx.commission)}
                                        </span>
                                    )}
                                </div>
                                <div className={styles.txRight}>
                                    <span className={styles.txTotal}>
                                        ${fmt(tx.quantity * tx.unitPrice + (tx.type === "Compra" ? tx.commission : -tx.commission))}
                                    </span>
                                    <span className={styles.txDate}>{tx.date}</span>
                                </div>
                                <button
                                    className={styles.deleteBtn}
                                    onClick={() => handleDelete(tx.id)}
                                    disabled={deleting === tx.id}
                                    title="Eliminar"
                                >
                                    {deleting === tx.id ? "..." : "×"}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

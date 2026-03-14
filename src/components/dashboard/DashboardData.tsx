"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "./DashboardData.module.css";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Filler
} from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import SankeyChart from "./SankeyChart";
import { CATEGORY_COLORS } from "@/lib/constants";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler);

// Defensa: Parseo seguro de fechas para evitar la creación de objetos Invalid Date (NaN) que bloquean los sorts de React
const parseArgentineDate = (dateStr: unknown) => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const parts = dateStr.split('/');
    if (parts.length < 3) return 0; // Fallback si Gemini alucinó un formato distinto

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return 0;
    return new Date(year, month, day).getTime();
};

const SUBCATEGORY_EMOJIS: Record<string, string> = {
    // Comunes
    "Mercadería": "🛒", "Limpieza": "🧹", "Cuidado personal": "🧼", "Delivery": "🛵", "Otros comunes": "🛍️",
    // Habitacionales
    "Alquiler": "🏠", "Expensas": "🏢", "Impuestos": "🏛️", "Energía": "⚡", "Gas": "🔥", "Internet": "🌐", "Teléfono": "📱", "Suscripciones": "📺", "Otros habit.": "🏡",
    // Puntuales
    "Equip. Para el hogar": "🛋️", "Transporte": "🚌", "Ropa": "👕", "Bicicleta": "🚲", "Otros puntuales": "📦",
    // Ocio
    "Juegos": "🎮", "Libros": "📚", "Salida": "🥂", "Otros ocio": "🎭",
    // Ingresos
    "Blanco": "💼", "Negro": "💵", "Aguinaldo B": "🎁", "Aguinaldo N": "🎁", "Vacaciones B": "🏖️", "Vacaciones N": "🏖️",
    // Extras
    "Intereses": "📈", "Otros ingresos": "💰", "Dividendos": "📊", "Trabajos": "🛠️",
};

export default function DashboardData() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<(string | number)[][]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [txLimit, setTxLimit] = useState(10);
    const [pieFilter, setPieFilter] = useState<"Egreso" | "Ingreso">("Egreso");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [lineFilter, setLineFilter] = useState<"Comparativo" | "Balance" | "Categorias">("Comparativo");
    const [balanceMonth, setBalanceMonth] = useState<string>("Total");
    const [themeTrigger, setThemeTrigger] = useState(0);
    const [searchTerm, setSearchTerm] = useState<string>("");

    const [compItem1, setCompItem1] = useState<string>("Salario");
    const [compItem2, setCompItem2] = useState<string>("Alquiler");

    useEffect(() => {
        const observer = new MutationObserver(() => setThemeTrigger(prev => prev + 1));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleMq = () => setThemeTrigger(prev => prev + 1);
        mediaQuery.addEventListener('change', handleMq);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener('change', handleMq);
        };
    }, []);

    const isDark = typeof document !== 'undefined'
        ? document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
        : false;

    const chartTextColor = isDark ? '#e2e8f0' : '#475569';
    const chartGridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    useEffect(() => {
        fetchData();

        const handleReload = () => {
            fetchDataSilent();
        };
        window.addEventListener("transaction_added", handleReload);
        return () => window.removeEventListener("transaction_added", handleReload);
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/dashboard");
            if (res.status === 401) {
                setFetchError("Sesión expirada. Recargá la página o volvé a iniciar sesión.");
                setLoading(false);
                return;
            }
            if (!res.ok) throw new Error("Error fetching");
            const json = await res.json();
            const sortedData = (json.data || []).sort((a: string[], b: string[]) => {
                return parseArgentineDate(a[1]) - parseArgentineDate(b[1]);
            });
            setFetchError(null);
            setData(sortedData);
        } catch (e) {
            console.error(e);
            setFetchError("Error al conectar con el servidor. Verificá tu conexión.");
        } finally {
            setLoading(false);
        }
    };

    const fetchDataSilent = async () => {
        try {
            const res = await fetch("/api/dashboard");
            if (res.ok) {
                const json = await res.json();
                const sortedData = (json.data || []).sort((a: string[], b: string[]) => {
                    return parseArgentineDate(a[1]) - parseArgentineDate(b[1]);
                });
                setData(sortedData);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const availableMonths = useMemo(() => {
        const periods = new Set<string>();
        data.forEach(row => {
            if (row.length > 1) {
                const dateStr = row[1];
                if (dateStr && typeof dateStr === 'string') {
                    const parts = dateStr.split("/");
                    if (parts.length >= 3) {
                        periods.add(`${parts[1]}/${parts[2]}`);
                        periods.add(`${parts[2]}`);
                    }
                }
            }
        });
        return Array.from(periods).sort((a, b) => {
            const isYearA = a.length === 4;
            const isYearB = b.length === 4;
            const yA = parseInt(isYearA ? a : a.split("/")[1], 10) || 0;
            const yB = parseInt(isYearB ? b : b.split("/")[1], 10) || 0;

            if (yA !== yB) return yB - yA;

            if (isYearA && !isYearB) return -1;
            if (!isYearA && isYearB) return 1;

            const numMA = parseInt(a.split("/")[0], 10) || 0;
            const numMB = parseInt(b.split("/")[0], 10) || 0;
            return numMB - numMA;
        });
    }, [data]);

    const { availableCompItems, groupedCompItems, subCatToCatMap, itemTypeMap } = useMemo(() => {
        const items = new Set<string>();
        const map: Record<string, string> = {};
        const types: Record<string, string> = {};
        const groups: Record<string, Set<string>> = {};

        data.forEach(row => {
            if (row.length < 5) return;
            const type = String(row[2]);
            const category = String(row[3]);
            const subCategory = String(row[4]);

            if (category) {
                items.add(category);
                types[category] = type;
                if (!groups[category]) groups[category] = new Set<string>();
            }
            if (subCategory) {
                items.add(subCategory);
                map[subCategory] = category;
                types[subCategory] = type;
                if (category) {
                    if (!groups[category]) groups[category] = new Set<string>();
                    groups[category].add(subCategory);
                }
            }
        });

        const groupedArray = Object.keys(groups).sort().map(cat => ({
            category: cat,
            subCategories: Array.from(groups[cat]).sort()
        }));

        return { availableCompItems: Array.from(items).sort(), groupedCompItems: groupedArray, subCatToCatMap: map, itemTypeMap: types };
    }, [data]);

    const filteredData = useMemo(() => {
        if (balanceMonth === "Total") return data;
        return data.filter(row => {
            if (row.length < 6) return false;
            const dateStr = row[1];
            if (typeof dateStr === 'string') {
                const parts = dateStr.split("/");
                if (parts.length >= 3) {
                    if (balanceMonth.length === 4) {
                        return parts[2] === balanceMonth; // Filtro por Año entero
                    } else {
                        return `${parts[1]}/${parts[2]}` === balanceMonth; // Filtro estricto mes/año
                    }
                }
            }
            return false;
        });
    }, [data, balanceMonth]);

    const { balance, ingresos, egresos } = useMemo(() => {
        let b = 0; let i = 0; let e = 0;
        filteredData.forEach(row => {
            if (row.length < 6) return;
            const type = row[2];

            const amountRaw = String(row[5]);
            const cleanAmountStr = amountRaw.replace(/[^\d.,-]/g, '');
            const val = parseFloat(cleanAmountStr.replace(/\./g, '').replace(',', '.')) || 0;
            if (type === "Ingreso") { i += val; b += val; }
            if (type === "Egreso") { e += val; b -= val; }
        });
        return { balance: b, ingresos: i, egresos: e };
    }, [filteredData]);

    const pieData = useMemo(() => {
        const itemTotals: Record<string, number> = {};
        filteredData.forEach(row => {
            if (row.length < 6) return;
            const type = row[2];
            if (type !== pieFilter) return;

            const category = String(row[3]);
            const subCategory = String(row[4]);

            if (selectedCategory && category !== selectedCategory) return;

            const labelKey = selectedCategory ? subCategory : category;
            const val = parseFloat(String(row[5]).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

            if (!itemTotals[labelKey]) itemTotals[labelKey] = 0;
            itemTotals[labelKey] += val;
        });

        return {
            labels: Object.keys(itemTotals),
            datasets: [{
                data: Object.values(itemTotals),
                backgroundColor: Object.keys(itemTotals).map((label, idx) => {
                    const fallbackColors = ['#5E82D5', '#98B3E1', '#ECAEA9', '#E0726B', '#7BBD9F', '#B3E1C5', '#F5D38A', '#F1AD5C'];
                    return CATEGORY_COLORS[label] || fallbackColors[idx % fallbackColors.length];
                }),
                borderColor: isDark ? 'rgba(30, 41, 59, 1)' : 'rgba(255, 255, 255, 1)',
                borderWidth: 2,
            }]
        };
    }, [filteredData, pieFilter, selectedCategory, isDark]);

    const lineData = useMemo(() => {
        const dailyData: Record<string, { ingreso: number, egreso: number, balanceDay: number, categories: Record<string, number> }> = {};
        let runningBalance = 0;

        // Color mapper for categorical charts
        const catColors = ['#5E82D5', '#E0726B', '#7BBD9F', '#F1AD5C', '#8B5CF6', '#10B981', '#EC4899'];
        const allCategoriesEncountered = new Set<string>();

        const isMonthlyAggregated = balanceMonth === "Total" || balanceMonth.length === 4;

        filteredData.forEach(row => {
            if (row.length < 6) return;
            const rawDateStr = String(row[1]);
            const dateParts = rawDateStr.split("/");

            const dateStr = (isMonthlyAggregated && dateParts.length >= 3)
                ? `${dateParts[1]}/${dateParts[2]}`
                : rawDateStr;

            const type = row[2];
            const category = String(row[3]);
            const val = parseFloat(String(row[5]).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

            if (!dailyData[dateStr]) dailyData[dateStr] = { ingreso: 0, egreso: 0, balanceDay: 0, categories: {} };

            if (type === "Ingreso") {
                dailyData[dateStr].ingreso += val;
                runningBalance += val;
            } else if (type === "Egreso") {
                dailyData[dateStr].egreso += val;
                runningBalance -= val;

                if (!dailyData[dateStr].categories[category]) dailyData[dateStr].categories[category] = 0;
                dailyData[dateStr].categories[category] += val;
                allCategoriesEncountered.add(category);
            }
            dailyData[dateStr].balanceDay = runningBalance;
        });

        const labels = Object.keys(dailyData);
        const datasets = [];

        if (lineFilter === "Comparativo") {
            datasets.push({
                label: "Ingresos",
                data: labels.map(l => dailyData[l].ingreso),
                borderColor: '#22c55e',
                backgroundColor: '#22c55e',
                tension: 0.3
            });
            datasets.push({
                label: "Egresos Totales",
                data: labels.map(l => dailyData[l].egreso),
                borderColor: '#ef4444',
                backgroundColor: '#ef4444',
                tension: 0.3
            });
        } else if (lineFilter === "Categorias") {
            // Create a dataset for each category found
            Array.from(allCategoriesEncountered).forEach((cat, idx) => {
                const color = CATEGORY_COLORS[cat] || catColors[idx % catColors.length];
                datasets.push({
                    label: cat,
                    data: labels.map(l => dailyData[l].categories[cat] || 0),
                    borderColor: color,
                    backgroundColor: color,
                    tension: 0.3
                });
            });
        } else {
            datasets.push({
                label: "Balance Acumulado",
                data: labels.map(l => dailyData[l].balanceDay),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                tension: 0.3,
                fill: true,
            });
        }

        return { labels, datasets };
    }, [filteredData, lineFilter]);

    const compLineData = useMemo(() => {
        const dailyData: Record<string, { a: number, b: number }> = {};
        const isMonthlyAggregated = balanceMonth === "Total" || balanceMonth.length === 4;

        filteredData.forEach(row => {
            if (row.length < 6) return;
            const rawDateStr = String(row[1]);
            const dateParts = rawDateStr.split("/");

            const dateStr = (isMonthlyAggregated && dateParts.length >= 3)
                ? `${dateParts[1]}/${dateParts[2]}`
                : rawDateStr;

            const category = String(row[3]);
            const subCategory = String(row[4]);
            const val = parseFloat(String(row[5]).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

            if (!dailyData[dateStr]) dailyData[dateStr] = { a: 0, b: 0 };

            if (category === compItem1 || subCategory === compItem1) dailyData[dateStr].a += Math.abs(val);
            if (category === compItem2 || subCategory === compItem2) dailyData[dateStr].b += Math.abs(val);
        });

        const labels = Object.keys(dailyData);

        const getColor = (item: string, fallbackColor: string) => {
            const cat = subCatToCatMap[item] || item;
            if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
            if (itemTypeMap[item] === "Ingreso") return '#22c55e';
            if (itemTypeMap[item] === "Egreso") return '#ef4444';
            return fallbackColor;
        };

        const color1 = getColor(compItem1, '#8b5cf6');
        const color2 = getColor(compItem2, '#ec4899');

        const datasets = [
            {
                label: compItem1,
                data: labels.map(l => dailyData[l].a),
                borderColor: color1,
                backgroundColor: color1,
                tension: 0.3
            },
            {
                label: compItem2,
                data: labels.map(l => dailyData[l].b),
                borderColor: color2,
                backgroundColor: color2,
                tension: 0.3
            }
        ];

        return { labels, datasets };
    }, [filteredData, compItem1, compItem2, balanceMonth, subCatToCatMap, itemTypeMap]);

    const recentTx = useMemo(() => {
        let results = [...filteredData].reverse();
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            results = results.filter(row => {
                // Buscar en: fecha(1), tipo(2), categoría(3), subcategoría(4), monto(5), comentario(6)
                for (let i = 1; i <= 6 && i < row.length; i++) {
                    if (String(row[i]).toLowerCase().includes(term)) return true;
                }
                return false;
            });
        }
        return results.slice(0, txLimit);
    }, [filteredData, txLimit, searchTerm]);

    const handleDelete = async (tx: (string | number)[]) => {
        if (!window.confirm("¿Seguro que querés eliminar este movimiento?")) return;

        try {
            const res = await fetch("/api/transactions", {
                method: "DELETE",
                body: JSON.stringify({ id: tx[0] }),
                headers: { "Content-Type": "application/json" }
            });
            if (res.ok) {
                fetchDataSilent();
                window.dispatchEvent(new Event("transaction_added")); // Reuses the same event to reload
            } else {
                alert("Error al borrar el movimiento.");
            }
        } catch (e) { console.error(e); }
    };

    if (loading) {
        return (
            <div className={styles.loadingArea}>
                <div className={styles.skeletonCard}></div>
                <div className={styles.skeletonCard} style={{ gridColumn: "span 2" }}></div>
                <div className={styles.skeletonCard}></div>
                <div className={styles.skeletonCard} style={{ gridColumn: "span 2" }}></div>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className={`glass-panel ${styles.card} ${styles.colSpanFull}`} style={{ textAlign: 'center', padding: '60px 24px' }}>
                <p style={{ fontSize: '2rem', marginBottom: '16px' }}>⚠️</p>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>No se pudieron cargar los datos</h3>
                <p className="text-muted" style={{ marginBottom: '24px' }}>{fetchError}</p>
                <button
                    onClick={() => { setLoading(true); setFetchError(null); fetchData(); }}
                    style={{
                        background: 'var(--accent-color)', color: '#fff', border: 'none',
                        padding: '10px 28px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
                    }}
                >
                    Reintentar
                </button>
            </div>
        );
    }

    const fmt = (val: number) => new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
    }).format(val);

    return (
        <>
            {/* Gráfico Torta */}
            <section className={`glass-panel ${styles.card}`}>
                <div className={styles.headerWithTabs}>
                    <h3 className="text-muted">Desglose {selectedCategory ? `> ${selectedCategory}` : ""}</h3>
                    <div style={{ display: "flex", gap: "8px" }}>
                        {selectedCategory && (
                            <button
                                className={styles.backBtn}
                                onClick={() => setSelectedCategory(null)}
                            >
                                🔙 Volver
                            </button>
                        )}
                        <select
                            className={styles.miniSelect}
                            value={pieFilter}
                            onChange={e => {
                                setPieFilter(e.target.value as "Egreso" | "Ingreso");
                                setSelectedCategory(null);
                            }}
                        >
                            <option value="Egreso">Egresos</option>
                            <option value="Ingreso">Ingresos</option>
                        </select>
                    </div>
                </div>
                <div className={styles.chartArea}>
                    {pieData.labels.length > 0 ? (
                        <Pie
                            data={pieData}
                            options={{
                                onClick: (event, elements) => {
                                    if (elements.length > 0 && !selectedCategory) {
                                        const index = elements[0].index;
                                        setSelectedCategory(pieData.labels[index] as string);
                                    }
                                },
                                plugins: {
                                    legend: { position: 'bottom', labels: { color: chartTextColor } },
                                    tooltip: {
                                        callbacks: {
                                            label: (context) => {
                                                const label = context.label || '';
                                                const value = context.parsed || 0;
                                                const dataArray = context.dataset.data as number[];
                                                const total = dataArray.reduce((acc, curr) => acc + curr, 0);
                                                const percentage = total > 0 ? ((value * 100) / total).toFixed(1) : "0";
                                                return `${label}: ${fmt(value)} (${percentage}%)`;
                                            }
                                        }
                                    }
                                },
                                cutout: '40%',
                                maintainAspectRatio: false,
                            }}
                        />
                    ) : (
                        <p className="text-muted">No hay registros de {pieFilter.toLowerCase()}.</p>
                    )}
                </div>
            </section>

            {/* Columna Derecha (Filtro + Balance) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Caja de Filtro de Período */}
                <section className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '16px' }}>
                    <h3 className="text-muted" style={{ margin: 0, fontSize: '1rem' }}>Filtro de Período</h3>
                    <select
                        className={styles.miniSelect}
                        value={balanceMonth}
                        onChange={e => setBalanceMonth(e.target.value)}
                        style={{ fontSize: '0.95rem', padding: '6px 12px', minWidth: '130px' }}
                    >
                        <option value="Total">Histórico Completo</option>
                        {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </section>

                {/* Tarjeta de Balance Total */}
                <section className={`glass-panel ${styles.card}`} style={{ flex: 1 }}>
                    <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                        <h3 className="text-muted" style={{ margin: 0 }}>Balance General</h3>
                    </div>

                    <div className={styles.balanceSummary}>
                        <div className={styles.summaryRow}>
                            <span>Ingresos</span>
                            <span className={styles.successText}>{fmt(ingresos)}</span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span>Egresos</span>
                            <span className={styles.dangerText}>-{fmt(egresos)}</span>
                        </div>
                        <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                            <span>Balance</span>
                            <span style={{ color: balance >= 0 ? "var(--success-color)" : "var(--danger-color)" }}>
                                {fmt(balance)}
                            </span>
                        </div>
                    </div>
                </section>
            </div>

            {/* Evolución Cashflow - Sankey */}
            <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`}>
                <div className={styles.headerWithTabs}>
                    <h3 className="text-muted">Flujo de Dinero (Cashflow)</h3>
                </div>
                <SankeyChart data={filteredData} isDark={isDark} />
            </section>

            {/* Evolución Histórica (Líneas) */}
            <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`}>
                <div className={styles.headerWithTabs}>
                    <h3 className="text-muted">Evolución en el Tiempo</h3>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tabBtn} ${lineFilter === "Comparativo" ? styles.activeTab : ""}`}
                            onClick={() => setLineFilter("Comparativo")}
                        >
                            Comparativo G/I
                        </button>
                        <button
                            className={`${styles.tabBtn} ${lineFilter === "Categorias" ? styles.activeTab : ""}`}
                            onClick={() => setLineFilter("Categorias")}
                        >
                            Egresos/Cat
                        </button>
                        <button
                            className={`${styles.tabBtn} ${lineFilter === "Balance" ? styles.activeTab : ""}`}
                            onClick={() => setLineFilter("Balance")}
                        >
                            Acumulado
                        </button>
                    </div>
                </div>
                <div className={styles.lineChartArea}>
                    {lineData.labels.length > 0 ? (
                        <Line
                            data={lineData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'bottom', labels: { color: chartTextColor } }
                                },
                                scales: {
                                    x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } },
                                    y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }
                                }
                            }}
                        />
                    ) : (
                        <p className="text-muted">No hay datos suficientes.</p>
                    )}
                </div>
            </section>

            {/* Comparación Personalizada */}
            <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`}>
                <div className={styles.headerWithTabs}>
                    <h3 className="text-muted">Comparativa Personalizada</h3>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <select
                            className={styles.miniSelect}
                            value={compItem1}
                            onChange={(e) => setCompItem1(e.target.value)}
                        >
                            {groupedCompItems.map(group => (
                                <optgroup key={`g1-${group.category}`} label={`📁 ${group.category}`}>
                                    <option value={group.category}>Toda la categoría</option>
                                    {group.subCategories.map(sub => (
                                        <option key={`s1-${sub}`} value={sub}>↳ {sub}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <span className="text-muted" style={{ fontWeight: 'bold' }}>vs</span>
                        <select
                            className={styles.miniSelect}
                            value={compItem2}
                            onChange={(e) => setCompItem2(e.target.value)}
                        >
                            {groupedCompItems.map(group => (
                                <optgroup key={`g2-${group.category}`} label={`📁 ${group.category}`}>
                                    <option value={group.category}>Toda la categoría</option>
                                    {group.subCategories.map(sub => (
                                        <option key={`s2-${sub}`} value={sub}>↳ {sub}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                </div>
                <div className={styles.lineChartArea}>
                    {compLineData.labels.length > 0 ? (
                        <Line
                            data={compLineData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'bottom', labels: { color: chartTextColor } }
                                },
                                scales: {
                                    x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } },
                                    y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }
                                }
                            }}
                        />
                    ) : (
                        <p className="text-muted text-center" style={{ marginTop: '20px' }}>No hay datos suficientes para comparar en este período.</p>
                    )}
                </div>
            </section>

            {/* Movimientos List */}
            <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`}>
                <div className={styles.headerWithTabs} style={{ marginBottom: "16px" }}>
                    <h3 className="text-muted">Historial de Movimientos</h3>
                </div>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="🔍 Buscar movimiento..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />

                {recentTx.length === 0 ? (
                    <p className="text-muted text-center" style={{ marginTop: "20px" }}>No hay nada registrado aún.</p>
                ) : (
                    <>
                        <ul className={styles.txList}>
                            {recentTx.map((tx, idx) => {
                                const isEgreso = tx[2] === "Egreso";
                                const val = parseFloat(String(tx[5]).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

                                const isDiscount = isEgreso && val < 0;
                                const isIncome = !isEgreso;

                                let amountColor = "var(--danger-color)";
                                let amountSign = "-";
                                let iconChar = isEgreso ? "📉" : "📈";

                                const subCat = String(tx[4]);
                                if (SUBCATEGORY_EMOJIS[subCat]) {
                                    iconChar = SUBCATEGORY_EMOJIS[subCat];
                                }

                                if (isIncome) {
                                    amountColor = "var(--success-color)";
                                    amountSign = "+";
                                } else if (isDiscount) {
                                    amountColor = "var(--accent-color)"; /* Azul/Accent */
                                    amountSign = "+"; /* Impacta positivamente */
                                }

                                const fmtAmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Math.abs(val));

                                return (
                                    <li key={idx} className={styles.txItem}>
                                        <div className={styles.txInfo}>
                                            <div className={styles.txIcon} style={{ color: amountColor }}>
                                                {iconChar}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <p className={styles.txTitle}>{tx[3]} - {tx[4]}</p>
                                                <p className={styles.txDate}>{tx[1]} • <span style={{ fontSize: "0.80rem", opacity: 0.8 }}>{tx[6]}</span></p>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                                            <div className={styles.txAmount} style={{ color: amountColor }}>
                                                {amountSign}{fmtAmt}
                                            </div>
                                            <button
                                                onClick={() => handleDelete(tx)}
                                                style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer", fontSize: "1.2rem", padding: "0 8px" }}
                                                title="Eliminar movimiento"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                        {filteredData.length > txLimit && (
                            <button className={styles.loadMoreBtn} onClick={() => setTxLimit(filteredData.length)}>
                                Ver Todos los Movimientos 👇
                            </button>
                        )}
                    </>
                )}
            </section>
        </>
    );
}

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
    Filler,
    ScriptableContext
} from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import { createVerticalGradient } from "@/lib/utils/chartGradients";
import SankeyChart from "./SankeyChart";
import HealthMetrics from "./HealthMetrics";
import IntelligenceAlerts from "./IntelligenceAlerts";
import TransactionsList from "./TransactionsList";
import DashboardIncomeExpenseChart from "./DashboardIncomeExpenseChart";
import SubNavTabs, { DashboardTabKey } from "./SubNavTabs";
import { CATEGORY_COLORS, CategoryItem } from "@/lib/constants";
import ConfirmDialog from "@/components/layout/ConfirmDialog";
import { projectEndOfMonth, calculateVestaScore, InstalmentPlan } from "@/lib/utils/intelligence";
import { parseSafeAmount, roundMoney, fmt } from "@/lib/utils/format";
import { computeFinancials } from "@/lib/utils/financials";
import { parseStartMonth } from "@/lib/utils/cuotas";

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
    const [activeTab, setActiveTab] = useState<DashboardTabKey>(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const tab = params.get("tab");
            if (tab === "dashboard" || tab === "analisis" || tab === "movimientos") {
                return tab;
            }
        }
        return "dashboard";
    });

    const handleTabChange = useCallback((newTab: DashboardTabKey) => {
        setActiveTab(newTab);
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("tab", newTab);
            window.history.replaceState(window.history.state, "", url.toString());
        }
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const tabParam = params.get("tab");
            if (tabParam === "dashboard" || tabParam === "analisis" || tabParam === "movimientos") {
                setActiveTab(tabParam);
            } else {
                setActiveTab("dashboard");
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<(string | number)[][]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [txLimit, setTxLimit] = useState(10);
    const [pieFilter, setPieFilter] = useState<"Egreso" | "Ingreso">("Egreso");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [lineFilter, setLineFilter] = useState<"Comparativo" | "Balance" | "Categorias">("Comparativo");
    
    // Por defecto mostramos el mes actual corriente (MM/YYYY) para ver los datos más recientes de inmediato
    const [balanceMonth, setBalanceMonth] = useState<string>(() => {
        const now = new Date();
        return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    });

    const [analysisPeriod, setAnalysisPeriod] = useState<string>(() => {
        const now = new Date();
        return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    });
    
    const [themeTrigger, setThemeTrigger] = useState(0);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [dialogPending, setDialogPending] = useState<(string | number)[] | null>(null);

    const [compItem1, setCompItem1] = useState<string>("Salario");
    const [compItem2, setCompItem2] = useState<string>("Alquiler");
    const [dynamicCategories, setDynamicCategories] = useState<CategoryItem[]>([]);

    useEffect(() => {
        const loadCategories = () => {
            fetch("/api/categories")
                .then(r => r.ok ? r.json() : null)
                .then(d => {
                    if (d && Array.isArray(d.data)) {
                        setDynamicCategories(d.data);
                    }
                })
                .catch(() => {});
        };
        loadCategories();
        window.addEventListener("categories_updated", loadCategories);
        return () => window.removeEventListener("categories_updated", loadCategories);
    }, []);

    const dynamicColorMap = useMemo(() => {
        const map: Record<string, string> = { ...CATEGORY_COLORS };
        dynamicCategories.forEach(c => {
            if (c.color && c.name) map[c.name] = c.color;
        });
        return map;
    }, [dynamicCategories]);

    // ─── Métricas de salud financiera ────────────────────────────────────────────
    const [cuotasMesActual, setCuotasMesActual] = useState<number>(0);
    const [cuotasProximas, setCuotasProximas] = useState<number>(0);
    const [instalmentsData, setInstalmentsData] = useState<InstalmentPlan[]>([]);
    const [savingsGoals, setSavingsGoals] = useState<any[]>([]);

    const calculateCuotasMetrics = useCallback((cuotas: InstalmentPlan[]) => {
        const now = new Date();
        let totalActual = 0;
        let totalProximas = 0;

        for (const inst of cuotas) {
            const count = Number(inst.instalmentsCount) || 1;
            const total = Number(inst.totalAmount) || 0;
            if (count <= 0 || total <= 0) continue;
            const monthly = Math.round((total / count) * 100) / 100;
            const { month: sm, year: sy } = parseStartMonth(inst.startMonth, inst.date);
            
            const startIdx = sy * 12 + (sm - 1);
            const endIdx = startIdx + count - 1;
            const nowIdx = now.getFullYear() * 12 + now.getMonth();
            
            if (nowIdx >= startIdx && nowIdx <= endIdx) {
                totalActual += monthly;
            }

            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            if (daysInMonth - now.getDate() <= 7) {
                const nextMonthIdx = nowIdx + 1;
                if (nextMonthIdx >= startIdx && nextMonthIdx <= endIdx) {
                    totalProximas += monthly;
                }
            } else if (now.getDate() <= 7) {
                if (nowIdx >= startIdx && nowIdx <= endIdx) {
                    totalProximas += monthly;
                }
            }
        }
        return {
            mesActual: Math.round(totalActual * 100) / 100,
            proximas: Math.round(totalProximas * 100) / 100,
        };
    }, []);

    // Fallback de cuotas si /api/init no estuviese disponible
    useEffect(() => {
        if (instalmentsData.length > 0) return;
        fetch("/api/cuotas")
            .then(r => r.ok ? r.json() : null)
            .then(json => {
                if (!json?.data) return;
                setInstalmentsData(json.data);
                const { mesActual, proximas } = calculateCuotasMetrics(json.data);
                setCuotasMesActual(mesActual);
                setCuotasProximas(proximas);
            })
            .catch(() => { /* sin cuotas — no es crítico para el dashboard */ });
    }, [instalmentsData.length, calculateCuotasMetrics]);

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

    const isDark = useMemo(() => {
        void themeTrigger;
        return typeof document !== 'undefined'
            ? document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
            : false;
    }, [themeTrigger]);

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
            // Intentar primero con /api/init (consolidado: transacciones, categorías, cuotas y metas)
            const initRes = await fetch("/api/init");
            if (initRes.status === 401) {
                setFetchError("Sesión expirada. Recargá la página o volvé a iniciar sesión.");
                setLoading(false);
                return;
            }
            if (initRes.ok) {
                const initJson = await initRes.json();
                if (initJson && Array.isArray(initJson.transactions)) {
                    const sortedData = initJson.transactions.sort((a: (string | number)[], b: (string | number)[]) => {
                        return parseArgentineDate(a[1]) - parseArgentineDate(b[1]);
                    });
                    setData(sortedData);

                    if (Array.isArray(initJson.categories) && initJson.categories.length > 0) {
                        setDynamicCategories(initJson.categories);
                    }

                    if (Array.isArray(initJson.cuotas)) {
                        setInstalmentsData(initJson.cuotas);
                        const { mesActual, proximas } = calculateCuotasMetrics(initJson.cuotas);
                        setCuotasMesActual(mesActual);
                        setCuotasProximas(proximas);
                    }

                    if (Array.isArray(initJson.savingsGoals)) {
                        setSavingsGoals(initJson.savingsGoals);
                    }

                    setFetchError(null);
                    setLoading(false);
                    return;
                }
            }

            // Fallback a /api/dashboard
            const res = await fetch("/api/dashboard");
            if (res.status === 401) {
                setFetchError("Sesión expirada. Recargá la página o volvé a iniciar sesión.");
                setLoading(false);
                return;
            }
            if (!res.ok) throw new Error("Error fetching");
            const json = await res.json();
            const sortedData = (json.data || []).sort((a: (string | number)[], b: (string | number)[]) => {
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

    // Si el mes actual seleccionado no tiene movimientos registrados todavía,
    // seleccionamos automáticamente el mes más reciente que SÍ tenga datos.
    useEffect(() => {
        if (data.length > 0 && availableMonths.length > 0) {
            const hasDataForSelected = availableMonths.includes(balanceMonth);
            const hasDataForAnalysis = availableMonths.includes(analysisPeriod);
            const latestMonth = availableMonths.find(m => m.includes("/")) || availableMonths[0];
            if (latestMonth) {
                if (!hasDataForSelected && balanceMonth !== "Total") {
                    setBalanceMonth(latestMonth);
                }
                if (!hasDataForAnalysis && analysisPeriod !== "Total") {
                    setAnalysisPeriod(latestMonth);
                }
            }
        }
    }, [data, availableMonths]);

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

    const filterByPeriod = useCallback((rows: (string | number)[][], period: string) => {
        if (period === "Total") return rows;
        return rows.filter(row => {
            if (row.length < 6) return false;
            const dateStr = row[1];
            if (typeof dateStr === 'string') {
                const parts = dateStr.split("/");
                if (parts.length >= 3) {
                    if (period.length === 4) {
                        return parts[2] === period; // Filtro por Año entero
                    } else {
                        return `${parts[1]}/${parts[2]}` === period; // Filtro estricto mes/año
                    }
                }
            }
            return false;
        });
    }, []);

    const filteredData = useMemo(() => {
        return filterByPeriod(data, balanceMonth);
    }, [data, balanceMonth, filterByPeriod]);

    const analysisFilteredData = useMemo(() => {
        return filterByPeriod(data, analysisPeriod);
    }, [data, analysisPeriod, filterByPeriod]);

    const { balance, ingresos, egresos, inversiones, ahorros } = useMemo(() => {
        return computeFinancials(filteredData);
    }, [filteredData]);

    const balanceHistorico = useMemo(() => {
        return computeFinancials(data).balance;
    }, [data]);

    const {
        balance: analysisBalance,
        ingresos: analysisIngresos,
        egresos: analysisEgresos
    } = useMemo(() => {
        return computeFinancials(analysisFilteredData);
    }, [analysisFilteredData]);

    const cashflowProjection = useMemo(() => projectEndOfMonth(egresos, balanceMonth), [egresos, balanceMonth]);
    const vestaScore = useMemo(() => {
        const tan = ingresos > 0 ? ((ingresos - egresos) / ingresos) * 100 : 0;
        const dti = ingresos > 0 ? (cuotasMesActual / ingresos) * 100 : 0;
        return calculateVestaScore(tan, dti, true, false);
    }, [ingresos, egresos, cuotasMesActual]);

    const pieData = useMemo(() => {
        const itemTotals: Record<string, number> = {};
        analysisFilteredData.forEach(row => {
            if (row.length < 6) return;
            const type = row[2];
            if (type !== pieFilter) return;

            const category = String(row[3]);
            const subCategory = String(row[4]);

            if (selectedCategory && category !== selectedCategory) return;

            const labelKey = selectedCategory ? subCategory : category;
            const val = parseSafeAmount(row[5]);

            if (!itemTotals[labelKey]) itemTotals[labelKey] = 0;
            itemTotals[labelKey] += val;
        });

        return {
            labels: Object.keys(itemTotals),
            datasets: [{
                data: Object.values(itemTotals),
                backgroundColor: Object.keys(itemTotals).map((label, idx) => {
                    const fallbackColors = ['#5E82D5', '#98B3E1', '#ECAEA9', '#E0726B', '#7BBD9F', '#B3E1C5', '#F5D38A', '#F1AD5C'];
                    return dynamicColorMap[label] || fallbackColors[idx % fallbackColors.length];
                }),
                borderColor: isDark ? 'rgba(30, 41, 59, 1)' : 'rgba(255, 255, 255, 1)',
                borderWidth: 2,
            }]
        };
    }, [analysisFilteredData, pieFilter, selectedCategory, isDark, dynamicColorMap]);

    const lineData = useMemo(() => {
        const dailyData: Record<string, { ingreso: number, egreso: number, balanceDay: number, categories: Record<string, number> }> = {};
        let runningBalance = 0;

        // Color mapper for categorical charts
        const catColors = ['#5E82D5', '#E0726B', '#7BBD9F', '#F1AD5C', '#8B5CF6', '#10B981', '#EC4899'];
        const allCategoriesEncountered = new Set<string>();

        const isMonthlyAggregated = analysisPeriod === "Total" || analysisPeriod.length === 4;

        analysisFilteredData.forEach(row => {
            if (row.length < 6) return;
            const rawDateStr = String(row[1]);
            const dateParts = rawDateStr.split("/");

            const dateStr = (isMonthlyAggregated && dateParts.length >= 3)
                ? `${dateParts[1]}/${dateParts[2]}`
                : rawDateStr;

            const type = row[2];
            const category = String(row[3]);
            const val = parseSafeAmount(row[5]);

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
                backgroundColor: (context: ScriptableContext<'line'>) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, '#22c55e', isDark);
                },
                fill: true,
                tension: 0.3
            });
            datasets.push({
                label: "Egresos Totales",
                data: labels.map(l => dailyData[l].egreso),
                borderColor: '#ef4444',
                backgroundColor: (context: ScriptableContext<'line'>) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, '#ef4444', isDark);
                },
                fill: true,
                tension: 0.3
            });
        } else if (lineFilter === "Categorias") {
            // Create a dataset for each category found
            Array.from(allCategoriesEncountered).forEach((cat, idx) => {
                const color = dynamicColorMap[cat] || catColors[idx % catColors.length];
                const validHex = color && color.startsWith('#') ? color : '#3b82f6';
                datasets.push({
                    label: cat,
                    data: labels.map(l => dailyData[l].categories[cat] || 0),
                    borderColor: validHex,
                    backgroundColor: (context: ScriptableContext<'line'>) => {
                        const { ctx, chartArea } = context.chart;
                        return createVerticalGradient(ctx, chartArea, validHex, isDark, 0.22);
                    },
                    fill: true,
                    tension: 0.3
                });
            });
        } else {
            datasets.push({
                label: "Balance Acumulado",
                data: labels.map(l => dailyData[l].balanceDay),
                borderColor: '#3b82f6',
                backgroundColor: (context: ScriptableContext<'line'>) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, '#3b82f6', isDark, 0.35);
                },
                tension: 0.3,
                fill: true,
            });
        }

        return { labels, datasets };
    }, [analysisFilteredData, lineFilter, dynamicColorMap, analysisPeriod, isDark]);

    const compLineData = useMemo(() => {
        const dailyData: Record<string, { a: number, b: number }> = {};
        const isMonthlyAggregated = analysisPeriod === "Total" || analysisPeriod.length === 4;

        analysisFilteredData.forEach(row => {
            if (row.length < 6) return;
            const rawDateStr = String(row[1]);
            const dateParts = rawDateStr.split("/");

            const dateStr = (isMonthlyAggregated && dateParts.length >= 3)
                ? `${dateParts[1]}/${dateParts[2]}`
                : rawDateStr;

            const category = String(row[3]);
            const subCategory = String(row[4]);
            const val = parseSafeAmount(row[5]);

            if (!dailyData[dateStr]) dailyData[dateStr] = { a: 0, b: 0 };

            if (category === compItem1 || subCategory === compItem1) dailyData[dateStr].a += Math.abs(val);
            if (category === compItem2 || subCategory === compItem2) dailyData[dateStr].b += Math.abs(val);
        });

        const labels = Object.keys(dailyData);

        const getColor = (item: string, fallbackColor: string) => {
            const cat = subCatToCatMap[item] || item;
            if (dynamicColorMap[cat]) return dynamicColorMap[cat];
            if (itemTypeMap[item] === "Ingreso") return '#22c55e';
            if (itemTypeMap[item] === "Egreso") return '#ef4444';
            return fallbackColor;
        };

        const rawColor1 = getColor(compItem1, '#8b5cf6');
        const rawColor2 = getColor(compItem2, '#ec4899');
        const color1 = rawColor1 && rawColor1.startsWith('#') ? rawColor1 : '#8b5cf6';
        const color2 = rawColor2 && rawColor2.startsWith('#') ? rawColor2 : '#ec4899';

        const datasets = [
            {
                label: compItem1,
                data: labels.map(l => dailyData[l].a),
                borderColor: color1,
                backgroundColor: (context: ScriptableContext<'line'>) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, color1, isDark);
                },
                fill: true,
                tension: 0.3
            },
            {
                label: compItem2,
                data: labels.map(l => dailyData[l].b),
                borderColor: color2,
                backgroundColor: (context: ScriptableContext<'line'>) => {
                    const { ctx, chartArea } = context.chart;
                    return createVerticalGradient(ctx, chartArea, color2, isDark);
                },
                fill: true,
                tension: 0.3
            }
        ];

        return { labels, datasets };
    }, [analysisFilteredData, compItem1, compItem2, analysisPeriod, subCatToCatMap, itemTypeMap, dynamicColorMap, isDark]);


    const handleDelete = (tx: (string | number)[]) => {
        setDialogPending(tx);
    };

    const handleEditTransaction = async (id: string, field: string, value: unknown) => {
        const res = await fetch("/api/transactions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, field, value }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Error al actualizar el movimiento.");
        }
        fetchDataSilent();
    };

    const handleConfirmDelete = async () => {
        const tx = dialogPending;
        setDialogPending(null);
        if (!tx) return;

        try {
            const res = await fetch("/api/transactions", {
                method: "DELETE",
                body: JSON.stringify({ id: tx[0] }),
                headers: { "Content-Type": "application/json" }
            });
            if (res.ok) {
                fetchDataSilent();
                window.dispatchEvent(new Event("transaction_added"));
            } else {
                const data = await res.json().catch(() => ({}));
                console.error("Error al borrar movimiento:", data.error);
            }
        } catch (e) {
            console.error("Error de red al intentar borrar movimiento:", e);
        }
    };


    if (loading) {
        return (
            <>
                <SubNavTabs activeTab={activeTab} onTabChange={handleTabChange} />
                <div className={styles.loadingArea}>
                    <div className={styles.skeletonCard}></div>
                    <div className={styles.skeletonCard} style={{ gridColumn: "span 2" }}></div>
                    <div className={styles.skeletonCard}></div>
                    <div className={styles.skeletonCard} style={{ gridColumn: "span 2" }}></div>
                </div>
            </>
        );
    }

    if (fetchError) {
        return (
            <>
                <SubNavTabs activeTab={activeTab} onTabChange={handleTabChange} />
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
            </>
        );
    }

    return (
        <>
            <SubNavTabs activeTab={activeTab} onTabChange={handleTabChange} />

            {/* Diálogo de confirmación de borrado — reemplaza window.confirm() */}
            <ConfirmDialog
                isOpen={!!dialogPending}
                title="Eliminar movimiento"
                message={dialogPending
                    ? `¿Eliminar "${dialogPending[3]} – ${dialogPending[4]}" del ${dialogPending[1]}?${dialogPending[7] ? "\n\n⚠️ Este movimiento tiene cuotas asociadas que también serán eliminadas." : ""}`
                    : ""}
                confirmLabel="Eliminar"
                cancelLabel="Cancelar"
                danger
                onConfirm={handleConfirmDelete}
                onCancel={() => setDialogPending(null)}
            />

            {/* ─── Vista 1: Dashboard ─── */}
            {activeTab === "dashboard" && (
                <div
                    role="tabpanel"
                    id="tabpanel-dashboard"
                    aria-labelledby="tab-dashboard"
                    style={{ display: "contents" }}
                >
                    <HealthMetrics 
                        balanceMonth={balanceMonth}
                        setBalanceMonth={setBalanceMonth}
                        availableMonths={availableMonths}
                        ingresos={ingresos} 
                        egresos={egresos} 
                        balance={balance} 
                        inversiones={inversiones}
                        ahorros={ahorros}
                        cuotasMesActual={cuotasMesActual} 
                        vestaScore={vestaScore} 
                        data={data}
                    />

                    <IntelligenceAlerts 
                        cashflowProjection={cashflowProjection} 
                        subscriptions={[]} 
                        cuotasProximas={cuotasProximas} 
                        availableMonths={availableMonths} 
                        data={data} 
                        balanceMonth={balanceMonth}
                        balance={balance}
                        ingresos={ingresos}
                        egresos={egresos}
                        instalmentsData={instalmentsData}
                        balanceHistorico={balanceHistorico}
                        filteredMonthData={filteredData}
                        initialSavingsGoals={savingsGoals}
                        categories={dynamicCategories}
                    />

                    <DashboardIncomeExpenseChart 
                        data={data}
                        filteredData={filteredData}
                        balanceMonth={balanceMonth}
                        isDark={isDark}
                    />
                </div>
            )}

            {/* ─── Vista 2: Análisis ─── */}
            {activeTab === "analisis" && (
                <div
                    role="tabpanel"
                    id="tabpanel-analisis"
                    aria-labelledby="tab-analisis"
                    style={{ display: "contents" }}
                >
                    {/* Header con Selector de Período Independiente */}
                    <section
                        className={`glass-panel ${styles.colSpanFull} ${styles.analysisHeader}`}
                        data-testid="analysis-header"
                    >
                        <div className={styles.analysisHeaderLeft}>
                            <h2 className={styles.analysisTitle}>Análisis Financiero</h2>
                            <p className={styles.analysisSubtitle}>
                                {analysisPeriod === 'Total'
                                    ? 'Visión histórica consolidada'
                                    : analysisPeriod.length === 4
                                        ? `Año ${analysisPeriod}`
                                        : `Resumen del período · ${analysisPeriod}`}
                            </p>
                        </div>
                        <div className={styles.analysisPeriodControl}>
                            <label htmlFor="analysis-period-select" className={styles.analysisPeriodLabel}>
                                Filtro de Período
                            </label>
                            <select
                                id="analysis-period-select"
                                aria-label="Filtro de Período"
                                data-testid="analysis-period-select"
                                className={styles.miniSelect}
                                value={analysisPeriod}
                                onChange={e => setAnalysisPeriod(e.target.value)}
                                style={{ fontSize: '0.95rem', padding: '6px 14px', minWidth: '150px' }}
                            >
                                <option value="Total">Histórico Completo</option>
                                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </section>

                    {/* 1. Desglose */}
                    <section className={`glass-panel ${styles.card}`} data-testid="card-desglose">
                        <div className={styles.headerWithTabs}>
                            <h3 className="text-muted">Desglose {selectedCategory ? `> ${selectedCategory}` : ""}</h3>
                            <div style={{ display: "flex", gap: "8px" }}>
                                {selectedCategory && (
                                    <button
                                        className={styles.backBtn}
                                        onClick={() => setSelectedCategory(null)}
                                        aria-label="Volver a categorías principales"
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
                                    aria-label="Tipo de desglose"
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

                    {/* 2. Balance General */}
                    <section className={`glass-panel ${styles.card}`} data-testid="card-balance-general">
                        <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                            <h3 className="text-muted" style={{ margin: 0 }}>Balance General</h3>
                        </div>

                        <div className={styles.balanceSummary}>
                            <div className={styles.summaryRow}>
                                <span>Ingresos</span>
                                <span className={styles.successText}>{fmt(analysisIngresos)}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Egresos</span>
                                <span className={styles.dangerText}>-{fmt(analysisEgresos)}</span>
                            </div>
                            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                                <span>Balance</span>
                                <span style={{ color: analysisBalance >= 0 ? "var(--success-color)" : "var(--danger-color)" }}>
                                    {fmt(analysisBalance)}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* 3. Flujo de Dinero (Cashflow - Sankey) */}
                    <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`} data-testid="card-flujo-dinero">
                        <div className={styles.headerWithTabs}>
                            <h3 className="text-muted">Flujo de Dinero (Cashflow)</h3>
                        </div>
                        <SankeyChart data={analysisFilteredData} isDark={isDark} />
                    </section>

                    {/* 4. Evolución en el Tiempo (Líneas con degradado) */}
                    <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`} data-testid="card-evolucion">
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

                    {/* 5. Comparativa Personalizada (Líneas con degradado) */}
                    <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`} data-testid="card-comparativa">
                        <div className={styles.headerWithTabs}>
                            <h3 className="text-muted">Comparativa Personalizada</h3>
                            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                <select
                                    className={styles.miniSelect}
                                    value={compItem1}
                                    onChange={(e) => setCompItem1(e.target.value)}
                                    aria-label="Primer ítem de comparación"
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
                                    aria-label="Segundo ítem de comparación"
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
                </div>
            )}

    {/* ─── Vista 3: Movimientos ─── */}
    {activeTab === "movimientos" && (
        <div
            role="tabpanel"
            id="tabpanel-movimientos"
            aria-labelledby="tab-movimientos"
            style={{ display: "contents" }}
        >
            <TransactionsList 
                transactions={data} 
                totalCount={data.length} 
                searchTerm={searchTerm} 
                setSearchTerm={setSearchTerm} 
                txLimit={txLimit} 
                setTxLimit={setTxLimit} 
                onDelete={handleDelete}
                onEdit={handleEditTransaction}
            />
        </div>
    )}
</>
    );
}


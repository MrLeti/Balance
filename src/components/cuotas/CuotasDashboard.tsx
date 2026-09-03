"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import styles from "./CuotasDashboard.module.css";
import {
    Instalment,
    PagoTarjeta,
    calculateProjectedPayments,
    TarjetaInfo,
    DEFAULT_CARD_COLORS
} from "@/lib/utils/cuotas";
import { Bar } from "react-chartjs-2";
import TarjetasManager from "./TarjetasManager";
import PagoTarjetaModal from "./PagoTarjetaModal";
import EditableTable, { ColumnDef } from "@/components/shared/EditableTable";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function CuotasDashboard() {
    const [loading, setLoading] = useState(true);
    const [instalments, setInstalments] = useState<Instalment[]>([]);
    const [pagos, setPagos] = useState<PagoTarjeta[]>([]);

    // Form state
    const [concept, setConcept] = useState("");
    const [totalAmount, setTotalAmount] = useState("");
    const [instalmentsCount, setInstalmentsCount] = useState("1");
    const [startMonth, setStartMonth] = useState("");
    const [tarjetas, setTarjetas] = useState<TarjetaInfo[]>([]);
    const [selectedTarjeta, setSelectedTarjeta] = useState("");
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    
    // Summary next-month filter state
    const [nextMonthFilter, setNextMonthFilter] = useState("Total");
    const [visibleLimit, setVisibleLimit] = useState(10);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchTarjetas = useCallback(async () => {
        try {
            const res = await fetch("/api/tarjetas");
            if (res.ok) {
                const json = await res.json();
                setTarjetas(json.data || []);
            }
        } catch (e) {
            console.error("Error fetching tarjetas:", e);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [cuotasRes, pagosRes] = await Promise.all([
                fetch("/api/cuotas"),
                fetch("/api/pagos_tarjetas")
            ]);

            if (cuotasRes.ok) {
                const json = await cuotasRes.json();
                setInstalments(json.data || []);
            }
            if (pagosRes.ok) {
                const json = await pagosRes.json();
                setPagos(json.data || []);
            }
        } catch (e) {
            console.error("Error fetching data:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Init Start Month as Next Month
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = date.getFullYear();
        setStartMonth(`${mm}/${yyyy}`);

        fetchData();
        fetchTarjetas();

        const handleUpdates = () => {
            fetchData();
            fetchTarjetas();
        };

        window.addEventListener("tarjetas_updated", handleUpdates);
        window.addEventListener("pagos_updated", handleUpdates);

        return () => {
            window.removeEventListener("tarjetas_updated", handleUpdates);
            window.removeEventListener("pagos_updated", handleUpdates);
        };
    }, [fetchData, fetchTarjetas]);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Seguro que querés eliminar esta cuota? Esto revertirá su proyección.")) return;
        setErrorMsg(null);
        try {
            const res = await fetch(`/api/cuotas/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchData();
            } else {
                const data = await res.json().catch(() => ({}));
                setErrorMsg(data.error || "No se pudo eliminar la cuota.");
            }
        } catch (e: unknown) {
            console.error(e);
            setErrorMsg("Error de conexión al eliminar la cuota. Verificá tu conexión.");
        }
    };

    const handleEditInstalment = async (id: string, field: string, value: unknown) => {
        setErrorMsg(null);
        try {
            const res = await fetch(`/api/cuotas/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ field, value }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Error al actualizar la cuota.");
            }
            fetchData();
        } catch (err: unknown) {
            console.error(err);
            const msg = err instanceof Error ? err.message : "Error al actualizar la cuota.";
            setErrorMsg(msg);
            throw err;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        const cleanConcept = concept.trim();
        const parsedTotal = parseFloat(totalAmount);
        const parsedCount = parseInt(instalmentsCount, 10);

        if (!cleanConcept) {
            setErrorMsg("El concepto de la compra financiada es obligatorio.");
            return;
        }
        if (isNaN(parsedTotal) || parsedTotal <= 0) {
            setErrorMsg("El monto total a financiar debe ser mayor a cero.");
            return;
        }
        if (isNaN(parsedCount) || parsedCount < 1) {
            setErrorMsg("La cantidad de cuotas debe ser al menos 1.");
            return;
        }
        if (!startMonth) {
            setErrorMsg("El mes de inicio del pago es obligatorio.");
            return;
        }

        setIsSubmitting(true);

        const today = new Date();
        const dd = today.getDate().toString().padStart(2, '0');
        const mm = (today.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = today.getFullYear();

        try {
            const res = await fetch("/api/cuotas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: `${dd}/${mm}/${yyyy}`,
                    concept: cleanConcept,
                    totalAmount: parsedTotal,
                    instalmentsCount: parsedCount,
                    startMonth,
                    tarjeta: selectedTarjeta
                })
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setConcept("");
                setTotalAmount("");
                setInstalmentsCount("1");
                fetchData();
            } else {
                setErrorMsg(data.error || "Error al guardar la cuota.");
            }
        } catch (error: unknown) {
            console.error(error);
            setErrorMsg("Error de conexión al guardar la cuota. Verificá tu red.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const { projections, totalDebt, monthlyData, nextMonthTotal, nextMonthKey } = useMemo(() => {
        const projs = calculateProjectedPayments(instalments, pagos);
        // Debt pending is the sum of all future unpaid projections
        const debt = projs.reduce((acc, curr) => acc + curr.amount, 0);

        // Group by month
        const grouped: Record<string, number> = {};
        projs.forEach(p => {
            if (!grouped[p.monthKey]) grouped[p.monthKey] = 0;
            grouped[p.monthKey] += p.amount;
        });

        // Next month logic
        let nextMonthTotal = 0;
        const chronologicalMonths = Object.keys(grouped).sort((a, b) => {
            const [ma, ya] = a.split('/').map(Number);
            const [mb, yb] = b.split('/').map(Number);
            if (ya !== yb) return ya - yb;
            return ma - mb;
        });
        
        const nextMonthKey = chronologicalMonths.length > 0 ? chronologicalMonths[0] : null;

        if (nextMonthKey) {
            projs.forEach(p => {
                if (p.monthKey === nextMonthKey) {
                    if (nextMonthFilter === "Total" || p.tarjeta === nextMonthFilter) {
                        nextMonthTotal += p.amount;
                    }
                }
            });
        }

        return { projections: projs, totalDebt: debt, monthlyData: grouped, nextMonthTotal, nextMonthKey };
    }, [instalments, pagos, nextMonthFilter]);

    // ─── Stacked Chart Data by Card Color ───────────────────────────────────────
    const chartData = useMemo(() => {
        // 1. Get all chronological months from projections
        const monthsSet = new Set<string>();
        projections.forEach(p => monthsSet.add(p.monthKey));
        
        const labels = Array.from(monthsSet).sort((a, b) => {
            const [ma, ya] = a.split('/').map(Number);
            const [mb, yb] = b.split('/').map(Number);
            if (ya !== yb) return ya - yb;
            return ma - mb;
        });

        // 2. Map card name (lowercase trim) -> color
        const cardColorMap: Record<string, string> = {};
        tarjetas.forEach((t, i) => {
            cardColorMap[t.nombre.toLowerCase().trim()] = t.color || DEFAULT_CARD_COLORS[i % DEFAULT_CARD_COLORS.length];
        });

        // 3. Find distinct card keys present in projections
        const usedCards = new Set<string>();
        projections.forEach(p => {
            if (p.tarjeta && p.tarjeta.trim()) {
                usedCards.add(p.tarjeta.trim());
            } else {
                usedCards.add("_sin_tarjeta");
            }
        });

        // 4. Build monthly sum matrix: matrix[cardKey][monthKey] = amount
        const matrix: Record<string, Record<string, number>> = {};
        usedCards.forEach(card => {
            matrix[card] = {};
            labels.forEach(m => { matrix[card][m] = 0; });
        });

        projections.forEach(p => {
            const cardKey = (p.tarjeta && p.tarjeta.trim()) ? p.tarjeta.trim() : "_sin_tarjeta";
            if (matrix[cardKey]) {
                matrix[cardKey][p.monthKey] = (matrix[cardKey][p.monthKey] || 0) + p.amount;
            }
        });

        // 5. Build Chart.js stacked datasets
        const datasets = Array.from(usedCards).map((cardKey, idx) => {
            const isGeneral = cardKey === "_sin_tarjeta";
            const label = isGeneral ? "Sin Tarjeta / General" : cardKey;
            const color = isGeneral
                ? "#94a3b8"
                : (cardColorMap[cardKey.toLowerCase()] || DEFAULT_CARD_COLORS[idx % DEFAULT_CARD_COLORS.length]);

            return {
                label,
                data: labels.map(m => matrix[cardKey][m] || 0),
                backgroundColor: color,
                borderColor: color,
                borderWidth: 1,
                borderRadius: 4,
                stack: 'vencimientos',
            };
        });

        return { labels, datasets };
    }, [projections, tarjetas]);

    const fmt = (val: number) => new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
    }).format(val);

    // EditableTable column definitions for instalments
    const instalmentColumns: ColumnDef[] = [
        { key: "date",              header: "Fecha",          editable: true,  type: "date",   width: "110px" },
        { key: "concept",           header: "Concepto",       editable: true,  type: "text",   width: "160px" },
        { key: "total_amount",      header: "Total",          editable: true,  type: "number", width: "120px",
          render: (val) => <span style={{ color: "var(--danger-color)", fontWeight: 600 }}>-{fmt(Number(val) || 0)}</span> },
        { key: "instalments_count", header: "# Cuotas",       editable: true,  type: "number", width: "80px" },
        { key: "cuota_mes",         header: "Cuota/mes",      editable: false, type: "readonly", width: "120px",
          render: (_val, row) => <span style={{ color: "var(--danger-color)" }}>{fmt((Number(row.total_amount) || 0) / Math.max(Number(row.instalments_count) || 1, 1))}</span> },
        { key: "start_month",       header: "Desde",          editable: true,  type: "text",   width: "90px" },
        { key: "tarjeta",           header: "Tarjeta",        editable: true,  type: "select",
          options: ["", ...tarjetas.map(t => t.nombre)],  width: "120px" },
    ];

    const instalmentRows = instalments.map(inst => ({
        id: inst.id || "",
        date: inst.date,
        concept: inst.concept,
        total_amount: inst.totalAmount,
        instalments_count: inst.instalmentsCount,
        start_month: inst.startMonth,
        tarjeta: inst.tarjeta || "",
    }));


    if (loading) {
        return (
            <div className={styles.loadingArea}>
                <div className={styles.skeletonCard}></div>
                <div className={styles.skeletonCard} style={{ gridColumn: "span 2" }}></div>
            </div>
        );
    }

    let isDark = false;
    if (typeof window !== "undefined") {
        isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    const chartTextColor = isDark ? '#e2e8f0' : '#475569';
    const chartGridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {errorMsg && (
                <div style={{
                    color: "var(--danger-color, #ef4444)",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "0.9rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
                    <span>⚠️ {errorMsg}</span>
                    <button
                        onClick={() => setErrorMsg(null)}
                        style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1 }}
                        title="Cerrar advertencia"
                    >
                        &times;
                    </button>
                </div>
            )}

            {/* Top Summaries */}
            <div className={styles.summaryGrid} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryTitle}>Deuda Total Pendiente</span>
                    <span className={styles.summaryValue}>{fmt(totalDebt)}</span>
                </div>
                
                <div className={styles.summaryCard} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={styles.summaryTitle} style={{ margin: 0 }}>Vence {nextMonthKey || "Próx. Mes"}</span>
                        <select 
                            style={{ 
                                background: 'var(--bg-color)', border: '1px solid var(--glass-border)', 
                                color: 'var(--text-main)', borderRadius: '6px', fontSize: '0.8rem', padding: '2px 6px', maxWidth: '100px'
                            }}
                            value={nextMonthFilter}
                            onChange={e => setNextMonthFilter(e.target.value)}
                        >
                            <option value="Total">Total</option>
                            {tarjetas.map(t => <option key={`nm-${t.id}`} value={t.nombre}>{t.nombre}</option>)}
                        </select>
                    </div>
                    <span className={styles.summaryValue} style={{ color: "var(--danger-color)" }}>{fmt(nextMonthTotal)}</span>
                </div>

                <div className={styles.summaryCard}>
                    <span className={styles.summaryTitle}>Cuotas Activas</span>
                    <span className={styles.summaryValue} style={{ color: "var(--accent-color)" }}>{instalments.length}</span>
                </div>
                <div className={styles.summaryCard} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <button
                        className={styles.submitBtn}
                        style={{ margin: 0, height: "100%" }}
                        disabled={tarjetas.length === 0}
                        onClick={() => setIsPaymentModalOpen(true)}
                    >
                        💳 Liquidar Tarjeta
                    </button>
                </div>
            </div>

            {/* Projection Stacked Chart */}
            <section className={`glass-panel ${styles.card}`}>
                <div className={styles.headerWithTabs}>
                    <div>
                        <h3 className="text-muted">Proyección de Vencimientos por Tarjeta</h3>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                            Barras apiladas con el color asignado a cada tarjeta para visualizar la composición de la deuda mes a mes.
                        </p>
                    </div>
                </div>
                <div style={{ height: "320px", width: "100%" }}>
                    {chartData.labels.length > 0 ? (
                        <Bar
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: {
                                            color: chartTextColor,
                                            usePointStyle: true,
                                            pointStyle: 'circle',
                                            padding: 16,
                                            font: { size: 12 }
                                        }
                                    },
                                    tooltip: {
                                        callbacks: {
                                            label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw as number)}`,
                                            footer: (tooltipItems) => {
                                                if (!tooltipItems.length) return "";
                                                const index = tooltipItems[0].dataIndex;
                                                const total = tooltipItems[0].chart.data.datasets.reduce((sum, ds) => {
                                                    const val = Number(ds.data[index]) || 0;
                                                    return sum + val;
                                                }, 0);
                                                return ` Total Mes: ${fmt(total)}`;
                                            }
                                        }
                                    }
                                },
                                scales: {
                                    x: {
                                        stacked: true,
                                        ticks: { color: chartTextColor },
                                        grid: { display: false }
                                    },
                                    y: {
                                        stacked: true,
                                        ticks: { color: chartTextColor },
                                        grid: { color: chartGridColor }
                                    }
                                }
                            }}
                        />
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p className="text-muted">No hay cuotas proyectadas pendientes.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Form */}
            <section className={`glass-panel ${styles.card}`}>
                <h3 className="text-muted" style={{ marginBottom: "16px" }}>Registrar Nueva Compra en Cuotas</h3>
                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Concepto (ej. TV 50", Viaje)</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={concept}
                                onChange={e => setConcept(e.target.value)}
                                required
                                placeholder="Concepto del gasto"
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Monto Total (ARS)</label>
                            <input
                                type="number"
                                step="any"
                                min="0.01"
                                className={styles.input}
                                value={totalAmount}
                                onChange={e => setTotalAmount(e.target.value)}
                                required
                                placeholder="100000"
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Cantidad de Cuotas</label>
                            <input
                                type="number"
                                min="1"
                                max="72"
                                className={styles.input}
                                value={instalmentsCount}
                                onChange={e => setInstalmentsCount(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Mes de Inicio (MM/YYYY)</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={startMonth}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                    const raw = e.target.value;
                                    if (raw.length < startMonth.length) {
                                        if (raw.endsWith("/")) setStartMonth(raw.slice(0, -1));
                                        else setStartMonth(raw);
                                        return;
                                    }
                                    const digits = raw.replace(/\D/g, "").slice(0, 6);
                                    if (digits.length === 0) {
                                        setStartMonth("");
                                    } else if (digits.length < 2) {
                                        setStartMonth(digits);
                                    } else if (digits.length === 2) {
                                        setStartMonth(`${digits}/`);
                                    } else {
                                        setStartMonth(`${digits.slice(0, 2)}/${digits.slice(2)}`);
                                    }
                                }}
                                pattern="(0[1-9]|1[0-2])\/20[0-9]{2}"
                                required
                                placeholder="04/2026"
                                title="Formato MM/YYYY válido. Ejemplo: 04/2026"
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Tarjeta (Opcional)</label>
                            <select
                                className={styles.input}
                                value={selectedTarjeta}
                                onChange={e => setSelectedTarjeta(e.target.value)}
                            >
                                <option value="">- Ninguna / General -</option>
                                {tarjetas.map(t => (
                                    <option key={t.id} value={t.nombre}>
                                        {t.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                        {isSubmitting ? "Registrando..." : "Añadir a Cuotas"}
                    </button>
                </form>
            </section>

            {/* Tarjetas Manager with Table View */}
            <TarjetasManager />

            {/* List */}
            <section className={`glass-panel ${styles.card}`}>
                <div className={styles.headerWithTabs} style={{ marginBottom: "16px" }}>
                    <h3 className="text-muted">Desglose de Cuotas Activas</h3>
                </div>

                <EditableTable
                    columns={instalmentColumns}
                    rows={instalmentRows.slice(0, visibleLimit)}
                    onEdit={handleEditInstalment}
                    onDelete={handleDelete}
                    idField="id"
                    searchable={true}
                    filters={[
                        {
                            key: "tarjeta",
                            label: "Tarjeta",
                            options: [
                                { value: "", label: "Todas las tarjetas" },
                                ...tarjetas.map(t => ({ value: t.nombre, label: t.nombre })),
                            ]
                        }
                    ]}
                    defaultSortKey="date"
                    defaultSortDir="desc"
                    emptyMessage="No hay cuotas registradas aún."
                />

                {instalmentRows.length > visibleLimit && (
                    <button
                        type="button"
                        className={styles.submitBtn}
                        style={{
                            margin: "16px auto 0 auto",
                            maxWidth: "320px",
                            background: "var(--surface-hover, rgba(0, 0, 0, 0.06))",
                            color: "var(--text-main)",
                            border: "1px solid var(--glass-border)",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            padding: "10px 20px"
                        }}
                        onClick={() => setVisibleLimit(prev => prev + 10)}
                    >
                        Ver más cuotas ({instalmentRows.length - visibleLimit} restantes) 👇
                    </button>
                )}
            </section>


            {isPaymentModalOpen && (
                <PagoTarjetaModal
                    tarjetas={tarjetas}
                    instalments={instalments}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSuccess={() => {
                        setIsPaymentModalOpen(false);
                        fetchData();
                        fetchTarjetas();
                        window.dispatchEvent(new Event("pagos_updated"));
                    }}
                />
            )}
        </div>
    );
}


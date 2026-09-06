"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import styles from "./CuotasDashboard.module.css";
import {
    Instalment,
    PagoTarjeta,
    calculateProjectedPayments,
    TarjetaInfo,
    DEFAULT_CARD_COLORS,
    getInstalmentProgress
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

    const [tarjetas, setTarjetas] = useState<TarjetaInfo[]>([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedCardForPayment, setSelectedCardForPayment] = useState<TarjetaInfo | null>(null);
    
    // Summary next-month filter state
    const [nextMonthFilter, setNextMonthFilter] = useState("Total");
    const [visibleLimit, setVisibleLimit] = useState(10);
    const [cuotasFilter, setCuotasFilter] = useState<"activas" | "todas">("activas");

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
        { key: "total_amount",      header: "Total",          editable: true,  type: "number", width: "110px",
          render: (val) => <span style={{ color: "var(--danger-color)", fontWeight: 600 }}>-{fmt(Number(val) || 0)}</span> },
        { key: "progreso",          header: "Progreso",       editable: false, type: "readonly", width: "130px",
          render: (_val, row) => {
              const isDone = Boolean(row.is_completed) || Number(row.remaining_amount) <= 0;
              const paid = Number(row.paid_count) || 0;
              const total = Number(row.total_count) || 1;
              const pct = isDone ? 100 : Math.min(100, Math.round((paid / total) * 100));
              return (
                  <div className={styles.progressContainer}>
                      <span className={`${styles.progressBadge} ${isDone ? styles.progressCompleted : ""}`}>
                          {isDone ? "✓ Pagada" : `${paid}/${total} pagadas`}
                      </span>
                      <div className={styles.progressTrack}>
                          <div
                              className={`${styles.progressBar} ${isDone ? styles.progressBarCompleted : ""}`}
                              style={{ width: `${pct}%` }}
                          />
                      </div>
                  </div>
              );
          }
        },
        { key: "resta_pagar",       header: "Resta Pagar",    editable: false, type: "readonly", width: "110px",
          render: (_val, row) => (
              <span style={{ color: "var(--danger-color)", fontWeight: 600 }}>
                  {fmt(Number(row.remaining_amount) || 0)}
              </span>
          )
        },
        { key: "instalments_count", header: "# Cuotas",       editable: true,  type: "number", width: "80px" },
        { key: "cuota_mes",         header: "Cuota/mes",      editable: false, type: "readonly", width: "110px",
          render: (_val, row) => <span style={{ color: "var(--text-muted)" }}>{fmt((Number(row.total_amount) || 0) / Math.max(Number(row.instalments_count) || 1, 1))}</span> },
        { key: "start_month",       header: "Desde",          editable: true,  type: "text",   width: "90px" },
        { key: "tarjeta",           header: "Tarjeta",        editable: true,  type: "select",
          options: ["", ...tarjetas.map(t => t.nombre)],  width: "120px" },
    ];

    const instalmentRows = instalments.map(inst => {
        const progress = getInstalmentProgress(inst, pagos);
        return {
            id: inst.id || "",
            date: inst.date,
            concept: inst.concept,
            total_amount: inst.totalAmount,
            instalments_count: inst.instalmentsCount,
            start_month: inst.startMonth,
            tarjeta: inst.tarjeta || "",
            current_number: progress.currentNumber,
            total_count: progress.totalCount,
            paid_count: progress.paidCount,
            remaining_amount: progress.remainingAmount,
            is_completed: progress.isCompleted,
        };
    });

    const filteredInstalmentRows = useMemo(() => {
        if (cuotasFilter === "activas") {
            return instalmentRows.filter(row => !row.is_completed && Number(row.remaining_amount) > 0);
        }
        return instalmentRows;
    }, [instalmentRows, cuotasFilter]);

    const activeCount = useMemo(() => {
        return instalmentRows.filter(row => !row.is_completed && Number(row.remaining_amount) > 0).length;
    }, [instalmentRows]);

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
        isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.hasAttribute('data-theme') && !!window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
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

            {/* Tarjetas Manager with Table View */}
            <TarjetasManager
                onLiquidarCard={(card) => {
                    setSelectedCardForPayment(card);
                    setIsPaymentModalOpen(true);
                }}
            />

            {/* List */}
            <section className={`glass-panel ${styles.card}`}>
                <div className={styles.headerWithTabs} style={{ marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                    <h3 className="text-muted" style={{ margin: 0 }}>Desglose de Cuotas</h3>

                    <div className={styles.radioFilterGroup} role="radiogroup" aria-label="Filtro de cuotas">
                        <label className={`${styles.radioOption} ${cuotasFilter === "activas" ? styles.radioOptionActive : ""}`}>
                            <input
                                type="radio"
                                name="cuotasFilter"
                                value="activas"
                                checked={cuotasFilter === "activas"}
                                onChange={() => setCuotasFilter("activas")}
                                className={styles.radioInput}
                            />
                            <span>Solo Activas ({activeCount})</span>
                        </label>
                        <label className={`${styles.radioOption} ${cuotasFilter === "todas" ? styles.radioOptionActive : ""}`}>
                            <input
                                type="radio"
                                name="cuotasFilter"
                                value="todas"
                                checked={cuotasFilter === "todas"}
                                onChange={() => setCuotasFilter("todas")}
                                className={styles.radioInput}
                            />
                            <span>Mostrar Pagadas ({instalmentRows.length})</span>
                        </label>
                    </div>
                </div>

                <EditableTable
                    columns={instalmentColumns}
                    rows={filteredInstalmentRows.slice(0, visibleLimit)}
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
                    emptyMessage={cuotasFilter === "activas" ? "No hay cuotas activas pendientes." : "No hay cuotas registradas aún."}
                />

                {filteredInstalmentRows.length > visibleLimit && (
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
                        Ver más cuotas ({filteredInstalmentRows.length - visibleLimit} restantes) 👇
                    </button>
                )}
            </section>

            {isPaymentModalOpen && (
                <PagoTarjetaModal
                    tarjetas={tarjetas}
                    instalments={instalments}
                    pagos={pagos}
                    targetCard={selectedCardForPayment}
                    onClose={() => {
                        setIsPaymentModalOpen(false);
                        setSelectedCardForPayment(null);
                    }}
                    onSuccess={() => {
                        setIsPaymentModalOpen(false);
                        setSelectedCardForPayment(null);
                        fetchData();
                        fetchTarjetas();
                        window.dispatchEvent(new Event("pagos_updated"));
                    }}
                />
            )}
        </div>
    );
}


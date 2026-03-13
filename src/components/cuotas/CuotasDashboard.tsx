"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "./CuotasDashboard.module.css";
import { Instalment, PagoTarjeta, calculateProjectedPayments } from "@/lib/utils/cuotas";
import { Bar } from "react-chartjs-2";
import TarjetasManager from "./TarjetasManager";
import PagoTarjetaModal from "./PagoTarjetaModal";
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
    const [tarjetas, setTarjetas] = useState<{ id: string, nombre: string }[]>([]);
    const [selectedTarjeta, setSelectedTarjeta] = useState("");
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Init Start Month as Next Month
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = date.getFullYear();
        setStartMonth(`${mm}/${yyyy}`);

        fetchData();
        fetch("/api/tarjetas").then(r => r.json()).then(d => {
            if (d.data) setTarjetas(d.data);
        }).catch(e => console.error(e));
    }, []);

    const fetchData = async () => {
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
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Seguro que querés eliminar esta cuota? Esto revertirá su proyección.")) return;
        try {
            const res = await fetch(`/api/cuotas/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchData();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!concept || !totalAmount || !instalmentsCount || !startMonth) return;

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
                    concept,
                    totalAmount: parseFloat(totalAmount),
                    instalmentsCount: parseInt(instalmentsCount),
                    startMonth,
                    tarjeta: selectedTarjeta
                })
            });

            if (res.ok) {
                setConcept("");
                setTotalAmount("");
                setInstalmentsCount("1");
                fetchData();
            } else {
                alert("Error al guardar la cuota.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const { projections, totalDebt, monthlyData } = useMemo(() => {
        const projs = calculateProjectedPayments(instalments, pagos);
        // Debt pending is the sum of all future unpaid projections
        const debt = projs.reduce((acc, curr) => acc + curr.amount, 0);

        // Group by month
        const grouped: Record<string, number> = {};
        projs.forEach(p => {
            if (!grouped[p.monthKey]) grouped[p.monthKey] = 0;
            grouped[p.monthKey] += p.amount;
        });

        return { projections: projs, totalDebt: debt, monthlyData: grouped };
    }, [instalments, pagos]);

    const chartData = useMemo(() => {
        const labels = Object.keys(monthlyData);
        const data = Object.values(monthlyData);

        let isDark = false;
        if (typeof document !== 'undefined') {
            isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }

        return {
            labels,
            datasets: [
                {
                    label: "Vencimientos Futuros (Monto ARS)",
                    data,
                    backgroundColor: "rgba(224, 114, 107, 0.7)", // var(--danger-color) mostly 
                    borderColor: "#e0726b",
                    borderWidth: 1,
                    borderRadius: 8,
                }
            ]
        };
    }, [monthlyData]);

    const fmt = (val: number) => new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
    }).format(val);

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

            {/* Top Summaries */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryTitle}>Deuda Total Pendiente</span>
                    <span className={styles.summaryValue}>{fmt(totalDebt)}</span>
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

            {/* Tarjetas Manager */}
            <TarjetasManager />

            {/* Projection Chart */}
            <section className={`glass-panel ${styles.card}`}>
                <div className={styles.headerWithTabs}>
                    <h3 className="text-muted">Proyección de Vencimientos</h3>
                </div>
                <div style={{ height: "300px", width: "100%" }}>
                    {chartData.labels.length > 0 ? (
                        <Bar
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'bottom', labels: { color: chartTextColor } },
                                    tooltip: {
                                        callbacks: {
                                            label: (ctx) => `Vencimiento: ${fmt(ctx.raw as number)}`
                                        }
                                    }
                                },
                                scales: {
                                    x: { ticks: { color: chartTextColor }, grid: { display: false } },
                                    y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }
                                }
                            }}
                        />
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p className="text-muted">No hay cuotas proyectadas.</p>
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
                                onChange={e => setStartMonth(e.target.value)}
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
                                {tarjetas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                            </select>
                        </div>
                    </div>
                    <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                        {isSubmitting ? "Registrando..." : "Añadir a Cuotas"}
                    </button>
                </form>
            </section>

            {/* List */}
            <section className={`glass-panel ${styles.card}`}>
                <div className={styles.headerWithTabs}>
                    <h3 className="text-muted">Desglose de Cuotas Activas</h3>
                </div>

                {instalments.length === 0 ? (
                    <p className="text-muted text-center" style={{ marginTop: "20px" }}>No hay cuotas registradas aún.</p>
                ) : (
                    <ul className={styles.txList}>
                        {instalments.map((inst, idx) => {
                            const val = inst.totalAmount / inst.instalmentsCount;

                            return (
                                <li key={inst.id || idx} className={styles.txItem}>
                                    <div className={styles.txInfo}>
                                        <div className={styles.txIcon} style={{ color: "var(--danger-color)" }}>
                                            💳
                                        </div>
                                        <div>
                                            <p className={styles.txTitle}>{inst.concept}</p>
                                            <p className={styles.txDate}>Registrado el {inst.date} • Base: {inst.instalmentsCount} cuotas desde {inst.startMonth}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                                        <div style={{ textAlign: "right" }}>
                                            <div className={styles.txAmount} style={{ color: "var(--danger-color)" }}>
                                                -{fmt(val)} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>/mes</span>
                                            </div>
                                            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                                Total: {fmt(inst.totalAmount)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => inst.id && handleDelete(inst.id)}
                                            style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer", fontSize: "1.2rem", padding: "0 8px" }}
                                            title="Eliminar cuota"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>

            {isPaymentModalOpen && (
                <PagoTarjetaModal
                    tarjetas={tarjetas}
                    instalments={instalments}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSuccess={() => {
                        setIsPaymentModalOpen(false);
                        // Cuando liquidamos una tarjeta, se debe recargar todo The charts will need the updated pagos
                        fetchData();
                        // Deberíamos despachar un evento o recargar para limpiar las cuotas pagas.
                        window.dispatchEvent(new Event("pagos_updated"));
                    }}
                />
            )}
        </div>
    );
}

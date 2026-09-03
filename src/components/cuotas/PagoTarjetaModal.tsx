"use client";

import { useState, useMemo, useEffect } from "react";
import styles from "../dashboard/ValidationModal.module.css";
import { Instalment, calculateProjectedPayments, TarjetaInfo, getEstimatedCardDates } from "@/lib/utils/cuotas";

interface PagoTarjetaModalProps {
    tarjetas: TarjetaInfo[];
    instalments: Instalment[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function PagoTarjetaModal({ tarjetas, instalments, onClose, onSuccess }: PagoTarjetaModalProps) {
    const [selectedTarjeta, setSelectedTarjeta] = useState("");
    const [selectedMes, setSelectedMes] = useState("");
    const [fechaCierre, setFechaCierre] = useState("");
    const [proximoCierre, setProximoCierre] = useState("");
    const [proximoVencimiento, setProximoVencimiento] = useState("");
    const [montoManual, setMontoManual] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Initialize the default closing date as today
    useEffect(() => {
        const today = new Date();
        const dd = today.getDate().toString().padStart(2, '0');
        const mm = (today.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = today.getFullYear();
        setFechaCierre(`${dd}/${mm}/${yyyy}`);

        setMontoManual("");
    }, []);

    // When tarjeta changes, auto-suggest next dates
    useEffect(() => {
        if (!selectedTarjeta) {
            setProximoCierre("");
            setProximoVencimiento("");
            return;
        }

        const card = tarjetas.find(t => t.nombre === selectedTarjeta);
        if (card) {
            // Calculate next month's estimated dates
            const now = new Date();
            const nextMonthRef = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const estimated = getEstimatedCardDates(card.diaCierre || 20, card.diaVencimiento || 5, nextMonthRef);

            setProximoCierre(card.proximoCierre || estimated.nextClosingDate);
            setProximoVencimiento(card.proximoVencimiento || estimated.nextDueDate);
        }
    }, [selectedTarjeta, tarjetas]);

    // Extract all unique months we have projected debt on for dropdown
    const availableMonths = useMemo(() => {
        const projs = calculateProjectedPayments(instalments);
        const months = new Set<string>();
        projs.forEach(p => {
            if (p.tarjeta) months.add(p.monthKey);
        });
        // Sort chronologically
        return Array.from(months).sort((a, b) => {
            const [ma, ya] = a.split('/').map(Number);
            const [mb, yb] = b.split('/').map(Number);
            if (ya !== yb) return ya - yb;
            return ma - mb;
        });
    }, [instalments]);

    // Make sure we default to the first one available if not selected yet
    useEffect(() => {
        if (!selectedMes && availableMonths.length > 0) {
            setSelectedMes(availableMonths[0]);
        }
    }, [availableMonths, selectedMes]);

    const montoCalculado = useMemo(() => {
        if (!selectedTarjeta || !selectedMes) return 0;

        const projs = calculateProjectedPayments(instalments);
        return projs
            .filter(p => p.tarjeta?.toLowerCase() === selectedTarjeta.toLowerCase() && p.monthKey === selectedMes)
            .reduce((acc, curr) => acc + curr.amount, 0);
    }, [selectedTarjeta, selectedMes, instalments]);

    // Autofill manual amount when calculated changes to help the user
    useEffect(() => {
        if (montoCalculado > 0) {
            setMontoManual(montoCalculado.toFixed(2));
        } else {
            setMontoManual("");
        }
    }, [montoCalculado]);

    const handleSave = async () => {
        if (!selectedTarjeta || !selectedMes || !fechaCierre || !montoManual) return;

        const parsedAmount = parseFloat(montoManual);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setErrorMsg("El monto total pagado debe ser un número mayor a cero.");
            return;
        }

        setIsSaving(true);
        setErrorMsg(null);

        try {
            // 1. Asentar el pago de la tarjeta
            const res = await fetch("/api/pagos_tarjetas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    closingDate: fechaCierre,
                    tarjeta: selectedTarjeta,
                    period: selectedMes,
                    amount: parsedAmount
                })
            });

            const resData = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(resData.error || "Error al asentar el pago de la tarjeta");

            // 2. Actualizar las próximas fechas en la tarjeta seleccionada si se especificaron
            const card = tarjetas.find(t => t.nombre === selectedTarjeta);
            if (card?.id && (proximoCierre || proximoVencimiento)) {
                await fetch(`/api/tarjetas/${card.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        proximoCierre,
                        proximoVencimiento,
                    })
                }).catch(err => console.warn("Aviso: No se pudieron actualizar fechas en tarjeta:", err));
            }

            onSuccess();
        } catch (e: unknown) {
            console.error(e);
            setErrorMsg(e instanceof Error ? e.message : "No pudimos liquidar la tarjeta. Verificá tu conexión.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Liquidar Tarjeta</h2>
                    <button className={styles.closeBtn} onClick={onClose} disabled={isSaving}>&times;</button>
                </div>

                <div className={styles.scrollArea}>
                    {errorMsg && (
                        <div style={{
                            color: "var(--danger-color, #ef4444)",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            marginBottom: "16px",
                            fontSize: "0.85rem"
                        }}>
                            ⚠️ {errorMsg}
                        </div>
                    )}
                    <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                        Cerrá tu tarjeta indicando el período y verificá el total. Al confirmar, descontaremos del calendario todas las cuotas relativas a este período y actualizaremos las próximas fechas estimadas.
                    </p>

                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Tarjeta</label>
                            <select
                                className={styles.inputStyle}
                                value={selectedTarjeta}
                                onChange={e => setSelectedTarjeta(e.target.value)}
                            >
                                <option value="">- Seleccioná una tarjeta -</option>
                                {tarjetas.map(t => (
                                    <option key={t.id} value={t.nombre}>
                                        {t.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Período / Mes a Pagar</label>
                            <select
                                className={styles.inputStyle}
                                value={selectedMes}
                                onChange={e => setSelectedMes(e.target.value)}
                            >
                                <option value="">- Seleccioná período -</option>
                                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Fecha Cierre / Pago (DD/MM/YYYY)</label>
                            <input
                                type="text"
                                className={styles.inputStyle}
                                value={fechaCierre}
                                onChange={e => setFechaCierre(e.target.value)}
                                pattern="(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/20[0-9]{2}"
                                placeholder="DD/MM/YYYY"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <label className={styles.label}>Total Pagado Real</label>
                                <label className={styles.label} style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    (Calculado por Cuotas: ${montoCalculado.toFixed(2)})
                                </label>
                            </div>
                            <input
                                type="number"
                                min="0" step="0.01"
                                className={styles.inputStyle}
                                value={montoManual}
                                onChange={e => setMontoManual(e.target.value)}
                                placeholder="Monto total del resumen"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Próximo Cierre (Opcional / Sugerido)</label>
                            <input
                                type="text"
                                className={styles.inputStyle}
                                value={proximoCierre}
                                onChange={e => setProximoCierre(e.target.value)}
                                placeholder="DD/MM/YYYY"
                                title="Podés ajustar la próxima fecha de cierre informada en tu resumen"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Próximo Vencimiento (Opcional / Sugerido)</label>
                            <input
                                type="text"
                                className={styles.inputStyle}
                                value={proximoVencimiento}
                                onChange={e => setProximoVencimiento(e.target.value)}
                                placeholder="DD/MM/YYYY"
                                title="Podés ajustar el próximo vencimiento informado en tu resumen"
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.actions} style={{ width: '100%', justifyContent: 'flex-end' }}>
                        <button
                            className={styles.cancelBtn}
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            Cancelar
                        </button>
                        <button
                            className={styles.saveBtn}
                            onClick={handleSave}
                            disabled={isSaving || !selectedTarjeta || !selectedMes || !montoManual || parseFloat(montoManual) <= 0 || !fechaCierre}
                        >
                            {isSaving ? "Liquidando..." : "Confirmar Vencimiento"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


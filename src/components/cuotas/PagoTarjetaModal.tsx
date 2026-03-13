"use client";

import { useState, useMemo, useEffect } from "react";
import styles from "../dashboard/ValidationModal.module.css";
import { Instalment, calculateProjectedPayments } from "@/lib/utils/cuotas";

interface PagoTarjetaModalProps {
    tarjetas: { id: string, nombre: string }[];
    instalments: Instalment[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function PagoTarjetaModal({ tarjetas, instalments, onClose, onSuccess }: PagoTarjetaModalProps) {
    const [selectedTarjeta, setSelectedTarjeta] = useState("");
    const [selectedMes, setSelectedMes] = useState("");
    const [fechaCierre, setFechaCierre] = useState("");
    const [montoManual, setMontoManual] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Initialize the default closing date as today
    useEffect(() => {
        const today = new Date();
        const dd = today.getDate().toString().padStart(2, '0');
        const mm = (today.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = today.getFullYear();
        setFechaCierre(`${dd}/${mm}/${yyyy}`);

        // Also initialize an available month based on current date
        setMontoManual("");
    }, []);

    // Extract all unique months we have projected debt on for dropdown
    const availableMonths = useMemo(() => {
        const projs = calculateProjectedPayments(instalments);
        const months = new Set<string>();
        projs.forEach(p => {
            if (p.tarjeta) months.add(p.monthKey);
        });
        // Sort cronologically
        return Array.from(months).sort((a, b) => {
            const [ma, ya] = a.split('/').map(Number);
            const [mb, yb] = b.split('/').map(Number);
            if (ya !== yb) return ya - yb;
            return ma - mb;
        });
    }, [instalments]);

    // Make sure we just default to the first one available if not selected yet
    useEffect(() => {
        if (!selectedMes && availableMonths.length > 0) {
            setSelectedMes(availableMonths[0]);
        }
    }, [availableMonths, selectedMes]);

    const montoCalculado = useMemo(() => {
        if (!selectedTarjeta || !selectedMes) return 0;

        const projs = calculateProjectedPayments(instalments);
        return projs
            .filter(p => p.tarjeta === selectedTarjeta && p.monthKey === selectedMes)
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

        setIsSaving(true);
        try {
            const res = await fetch("/api/pagos_tarjetas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    closingDate: fechaCierre,
                    tarjeta: selectedTarjeta,
                    period: selectedMes,
                    amount: parseFloat(montoManual)
                })
            });

            if (!res.ok) throw new Error("Error al asentar el pago de la tarjeta");

            onSuccess();
        } catch (e) {
            console.error(e);
            alert("No pudimos liquidar la tarjeta.");
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
                    <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                        Cerrá tu tarjeta indicando el período y verificá el total. Al confirmar, descontaremos del calendario todas las cuotas relativas a este período.
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
                                {tarjetas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
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
                            disabled={isSaving || !selectedTarjeta || !selectedMes || !montoManual || !fechaCierre}
                        >
                            {isSaving ? "Liquidando..." : "Confirmar Vencimiento"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import styles from "../dashboard/ValidationModal.module.css";
import {
    Instalment,
    calculateProjectedPayments,
    TarjetaInfo,
    getEstimatedCardDates,
    advanceOneMonth,
    PagoTarjeta
} from "@/lib/utils/cuotas";

interface PagoTarjetaModalProps {
    tarjetas: TarjetaInfo[];
    instalments: Instalment[];
    pagos?: PagoTarjeta[];
    targetCard?: TarjetaInfo | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PagoTarjetaModal({
    tarjetas,
    instalments = [],
    pagos = [],
    targetCard,
    onClose,
    onSuccess
}: PagoTarjetaModalProps) {
    const [selectedTarjeta, setSelectedTarjeta] = useState<string>(
        targetCard?.nombre || (tarjetas.length > 0 ? tarjetas[0].nombre : "")
    );
    const [selectedMes, setSelectedMes] = useState("");
    const [fechaCierre, setFechaCierre] = useState("");
    const [proximoCierre, setProximoCierre] = useState("");
    const [proximoVencimiento, setProximoVencimiento] = useState("");
    const [montoManual, setMontoManual] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // If targetCard was passed, update selectedTarjeta
    useEffect(() => {
        if (targetCard?.nombre) {
            setSelectedTarjeta(targetCard.nombre);
        }
    }, [targetCard]);

    // Extract ONLY unique months that have pending unpaid debt for the selected card
    const availableMonths = useMemo(() => {
        if (!selectedTarjeta) return [];
        const projs = calculateProjectedPayments(instalments, pagos);
        const months = new Set<string>();
        projs.forEach(p => {
            if (p.tarjeta && p.tarjeta.trim().toLowerCase() === selectedTarjeta.trim().toLowerCase() && p.amount > 0) {
                months.add(p.monthKey);
            }
        });
        return Array.from(months).sort((a, b) => {
            const [ma, ya] = a.split("/").map(Number);
            const [mb, yb] = b.split("/").map(Number);
            if (ya !== yb) return ya - yb;
            return ma - mb;
        });
    }, [instalments, pagos, selectedTarjeta]);

    // Keep selectedMes synchronized with available months
    useEffect(() => {
        if (availableMonths.length > 0) {
            if (!availableMonths.includes(selectedMes)) {
                setSelectedMes(availableMonths[0]);
            }
        } else {
            setSelectedMes("");
        }
    }, [availableMonths, selectedMes]);

    // When selectedTarjeta changes, pre-load closing and advance dates by 1 month
    useEffect(() => {
        if (!selectedTarjeta) {
            setFechaCierre("");
            setProximoCierre("");
            setProximoVencimiento("");
            return;
        }

        const card = tarjetas.find(t => t.nombre.toLowerCase().trim() === selectedTarjeta.toLowerCase().trim());
        if (card) {
            const currentClose = card.proximoCierre || "";
            const currentDue = card.proximoVencimiento || "";

            // 1. Current closing date defaults to the card's proximoCierre or estimated date
            if (currentClose) {
                setFechaCierre(currentClose);
                setProximoCierre(advanceOneMonth(currentClose));
            } else {
                const estimated = getEstimatedCardDates(card.diaCierre || 25, card.diaVencimiento || 5);
                setFechaCierre(estimated.nextClosingDate);
                setProximoCierre(advanceOneMonth(estimated.nextClosingDate));
            }

            // 2. Next due date advances by 1 month
            if (currentDue) {
                setProximoVencimiento(advanceOneMonth(currentDue));
            } else {
                const estimated = getEstimatedCardDates(card.diaCierre || 25, card.diaVencimiento || 5);
                setProximoVencimiento(advanceOneMonth(estimated.nextDueDate));
            }
        }
    }, [selectedTarjeta, tarjetas]);

    const montoCalculado = useMemo(() => {
        if (!selectedTarjeta || !selectedMes) return 0;

        const projs = calculateProjectedPayments(instalments, pagos);
        return projs
            .filter(p => p.tarjeta?.trim().toLowerCase() === selectedTarjeta.trim().toLowerCase() && p.monthKey === selectedMes)
            .reduce((acc, curr) => acc + curr.amount, 0);
    }, [selectedTarjeta, selectedMes, instalments, pagos]);

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
            const card = tarjetas.find(t => t.nombre.toLowerCase().trim() === selectedTarjeta.toLowerCase().trim());
            if (card?.id && (proximoCierre || proximoVencimiento)) {
                await fetch(`/api/tarjetas/${encodeURIComponent(card.id)}`, {
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
            <div className={styles.modal} style={{ maxWidth: "520px" }}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h2 className={styles.title}>Liquidar Tarjeta</h2>
                    </div>
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
                    <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: "0 0 16px 0", lineHeight: 1.5 }}>
                        Confirmá el período a liquidar y verificá el total del resumen. Al asentar el pago, descontaremos las cuotas de este período y actualizaremos las fechas de vencimiento del próximo mes.
                    </p>

                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Tarjeta</label>
                            <select
                                className={styles.selectStyle}
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
                            <label className={styles.label}>Período a Pagar</label>
                            {availableMonths.length > 0 ? (
                                <select
                                    className={styles.selectStyle}
                                    value={selectedMes}
                                    onChange={e => setSelectedMes(e.target.value)}
                                >
                                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            ) : (
                                <div className={styles.noDebtBadge}>
                                    Sin deudas pendientes
                                </div>
                            )}
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Fecha Cierre / Pago</label>
                            <input
                                type="text"
                                className={styles.inputStyle}
                                value={fechaCierre}
                                onChange={e => setFechaCierre(e.target.value)}
                                placeholder="DD/MM/YYYY"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <div className={styles.labelRow}>
                                <label className={styles.label}>Total Pagado</label>
                                <span className={styles.labelHint} title={`Total calculado de cuotas: $${montoCalculado.toFixed(2)}`}>
                                    (Cuotas: ${montoCalculado.toFixed(2)})
                                </span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                className={`${styles.inputStyle} ${styles.noSpinners}`}
                                value={montoManual}
                                onChange={e => setMontoManual(e.target.value)}
                                placeholder="Monto total del resumen"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label} title="Podés ajustar la próxima fecha de cierre informada en tu resumen">
                                Próximo Cierre
                            </label>
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
                            <label className={styles.label} title="Podés ajustar el próximo vencimiento informado en tu resumen">
                                Próximo Vto.
                            </label>
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
                    <div className={styles.actions} style={{ width: "100%", justifyContent: "flex-end" }}>
                        <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className={styles.saveBtn}
                            onClick={handleSave}
                            disabled={
                                isSaving ||
                                !selectedTarjeta ||
                                !selectedMes ||
                                !montoManual ||
                                parseFloat(montoManual) <= 0 ||
                                !fechaCierre ||
                                availableMonths.length === 0
                            }
                        >
                            {isSaving ? "Liquidando..." : "Confirmar Pago"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


"use client";

import React, { useState } from "react";
import styles from "./AhorrosDashboard.module.css";

interface GoalFormModalProps {
    onClose: () => void;
    onGoalCreated: () => void;
}

const EMOJI_OPTIONS = ["🎯", "🛡️", "✈️", "💻", "🚗", "🏠", "📱", "🎓", "💍", "🏖️", "🎮", "🚲"];

export default function GoalFormModal({ onClose, onGoalCreated }: GoalFormModalProps) {
    const [name, setName] = useState("");
    const [targetAmount, setTargetAmount] = useState("");
    const [targetMonths, setTargetMonths] = useState("6");
    const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
    const [deadline, setDeadline] = useState("");
    const [icon, setIcon] = useState("🎯");
    const [isEmergency, setIsEmergency] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleEmergencyToggle = (checked: boolean) => {
        setIsEmergency(checked);
        if (checked) {
            if (!name) setName("Fondo de Emergencia");
            if (icon === "🎯") setIcon("🛡️");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = name.trim();
        if (!cleanName) {
            setError("Por favor ingresa un nombre para la meta.");
            return;
        }

        if (isEmergency) {
            const months = parseInt(targetMonths, 10);
            if (isNaN(months) || months < 1) {
                setError("Los meses de cobertura deben ser al menos 1.");
                return;
            }
        } else {
            const amt = parseFloat(targetAmount);
            if (isNaN(amt) || amt < 0) {
                setError("El monto objetivo no puede ser negativo.");
                return;
            }
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/savings/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: cleanName,
                    targetAmount: isEmergency ? 0 : (parseFloat(targetAmount) || 0),
                    targetMonths: isEmergency ? (parseInt(targetMonths, 10) || 6) : undefined,
                    currency,
                    deadline: deadline || undefined,
                    icon,
                    isEmergency,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Error al crear la meta");
            }

            onGoalCreated();
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error al guardar la meta de ahorro.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={`glass-panel ${styles.modalCard}`}>
                <div className={styles.modalHeader}>
                    <h3>Nueva Meta de Ahorro</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className={styles.modalForm}>
                    {error && <div className={styles.errorBanner}>{error}</div>}

                    {/* Is Emergency Fund Checkbox at the top */}
                    <div className={styles.checkboxRow}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={isEmergency}
                                onChange={e => handleEmergencyToggle(e.target.checked)}
                            />
                            <span>🛡️ Es Fondo de Emergencia (calcula meses de cobertura de gastos)</span>
                        </label>
                    </div>

                    {/* Icon Picker */}
                    <div className={styles.formGroup}>
                        <label>Ícono / Emoji</label>
                        <div className={styles.emojiRow}>
                            {EMOJI_OPTIONS.map(em => (
                                <button
                                    key={em}
                                    type="button"
                                    className={`${styles.emojiBtn} ${icon === em ? styles.emojiBtnActive : ""}`}
                                    onClick={() => setIcon(em)}
                                >
                                    {em}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name */}
                    <div className={styles.formGroup}>
                        <label>Nombre de la Meta</label>
                        <input
                            type="text"
                            placeholder="Ej: Viaje a Japón, Nueva PC, Fondo de Emergencia"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className={styles.input}
                            required
                        />
                    </div>

                    {/* If Emergency: Target Months input with free typing + quick pills */}
                    {isEmergency ? (
                        <div className={styles.formGroup}>
                            <label>Meses de Cobertura Deseados</label>
                            <input
                                type="number"
                                min="1"
                                max="36"
                                step="1"
                                placeholder="Ej: 6"
                                value={targetMonths}
                                onChange={e => setTargetMonths(e.target.value)}
                                className={styles.input}
                                required
                            />
                            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                                {["3", "6", "9", "12"].map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        style={{
                                            flex: 1,
                                            padding: "4px 8px",
                                            borderRadius: "8px",
                                            border: targetMonths === m ? "1px solid var(--accent-color, #3b82f6)" : "1px solid var(--glass-border)",
                                            background: targetMonths === m ? "rgba(59, 130, 246, 0.2)" : "rgba(0, 0, 0, 0.08)",
                                            color: "var(--text-main)",
                                            fontSize: "0.78rem",
                                            fontWeight: targetMonths === m ? 700 : 500,
                                            cursor: "pointer",
                                        }}
                                        onClick={() => setTargetMonths(m)}
                                    >
                                        {m} meses
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Standard Target Amount & Currency */
                        <div className={styles.formRow}>
                            <div className={styles.formGroup} style={{ flex: 2 }}>
                                <label>Monto Objetivo</label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="Ej: 1500000"
                                    value={targetAmount}
                                    onChange={e => setTargetAmount(e.target.value)}
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formGroup} style={{ flex: 1 }}>
                                <label>Moneda</label>
                                <select
                                    value={currency}
                                    onChange={e => setCurrency(e.target.value as "ARS" | "USD")}
                                    className={styles.input}
                                >
                                    <option value="ARS">ARS ($)</option>
                                    <option value="USD">USD ($)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Target Date */}
                    <div className={styles.formGroup}>
                        <label>Fecha Límite Deseada (Opcional)</label>
                        <input
                            type="date"
                            value={deadline}
                            onChange={e => setDeadline(e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    {/* Actions */}
                    <div className={styles.modalActions}>
                        <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className={styles.btnPrimary} disabled={loading}>
                            {loading ? "Guardando..." : "Crear Meta"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

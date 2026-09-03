"use client";

import React, { useState } from "react";
import styles from "./AhorrosDashboard.module.css";
import { SavingsGoal } from "@/lib/utils/savings";

interface SavingsMovementModalProps {
    goal: SavingsGoal;
    initialType?: "Aporte" | "Retiro";
    onClose: () => void;
    onSuccess: () => void;
}

export default function SavingsMovementModal({
    goal,
    initialType = "Aporte",
    onClose,
    onSuccess,
}: SavingsMovementModalProps) {
    const [actionType, setActionType] = useState<"Aporte" | "Retiro">(initialType);
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(() => {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, "0");
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const yyyy = today.getFullYear();
        return `${yyyy}-${mm}-${dd}`;
    });
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            setError("Por favor ingresa un monto válido.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Format date to DD/MM/YYYY for Movimientos
            const [y, m, d] = date.split("-");
            const formattedDate = `${d}/${m}/${y}`;

            const finalAmount = actionType === "Retiro" ? -Math.abs(numAmount) : Math.abs(numAmount);

            // Item format: [Fecha, Tipo, Categoría, Subcategoría, Monto, Comentario]
            const item = [
                formattedDate,
                "Ahorro",
                actionType,
                goal.name,
                finalAmount,
                comment.trim(),
            ];

            const res = await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: [item] }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al registrar el movimiento");
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || "Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    const curSymbol = goal.currency === "USD" ? "USD $" : "$";

    return (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={`glass-panel ${styles.modalCard}`}>
                <div className={styles.modalHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "1.3rem" }}>{goal.icon}</span>
                        <div>
                            <h3 style={{ margin: 0 }}>{goal.name}</h3>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {actionType === "Aporte" ? "Apartar dinero para esta meta" : "Retirar dinero de esta meta"}
                            </span>
                        </div>
                    </div>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className={styles.modalForm}>
                    {error && <div className={styles.errorBanner}>{error}</div>}

                    {/* Action Toggle (Aporte vs Retiro) */}
                    <div className={styles.typeSelector}>
                        <button
                            type="button"
                            className={`${styles.typeBtn} ${actionType === "Aporte" ? styles.typeBtnAporte : ""}`}
                            onClick={() => setActionType("Aporte")}
                        >
                            ➕ Aportar ({curSymbol})
                        </button>
                        <button
                            type="button"
                            className={`${styles.typeBtn} ${actionType === "Retiro" ? styles.typeBtnRetiro : ""}`}
                            onClick={() => setActionType("Retiro")}
                        >
                            ➖ Retirar ({curSymbol})
                        </button>
                    </div>

                    {/* Amount */}
                    <div className={styles.formGroup}>
                        <label>Monto a {actionType === "Aporte" ? "Aportar" : "Retirar"}</label>
                        <div className={styles.amountInputWrapper}>
                            <span className={styles.curPrefix}>{curSymbol}</span>
                            <input
                                type="number"
                                step="any"
                                placeholder="0,00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className={styles.inputAmount}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Date */}
                    <div className={styles.formGroup}>
                        <label>Fecha</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className={styles.input}
                            required
                        />
                    </div>

                    {/* Comment */}
                    <div className={styles.formGroup}>
                        <label>Nota / Comentario (Opcional)</label>
                        <input
                            type="text"
                            placeholder={actionType === "Aporte" ? "Ej: Aporte sueldo enero" : "Ej: Uso para arreglo de auto"}
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    {/* Actions */}
                    <div className={styles.modalActions}>
                        <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={`${styles.btnPrimary} ${actionType === "Retiro" ? styles.btnDanger : ""}`}
                            disabled={loading}
                        >
                            {loading ? "Guardando..." : `Confirmar ${actionType}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

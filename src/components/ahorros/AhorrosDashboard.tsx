"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./AhorrosDashboard.module.css";
import GoalCard from "./GoalCard";
import GoalFormModal from "./GoalFormModal";
import SavingsMovementModal from "./SavingsMovementModal";
import ConfirmDialog from "@/components/layout/ConfirmDialog";
import { SavingsGoal } from "@/lib/utils/savings";

const fmt = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AhorrosDashboard() {
    const [goals, setGoals] = useState<any[]>([]);
    const [movements, setMovements] = useState<any[]>([]);
    const [avgMonthlyExpense, setAvgMonthlyExpense] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Modals state
    const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
    const [movementModalGoal, setMovementModalGoal] = useState<SavingsGoal | null>(null);
    const [movementType, setMovementType] = useState<"Aporte" | "Retiro">("Aporte");
    const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/savings/goals");
            if (!res.ok) throw new Error("Error al cargar metas de ahorro");
            const data = await res.json();
            setGoals(data.goals || []);
            setMovements(data.movements || []);
            setAvgMonthlyExpense(data.avgMonthlyExpense || 0);
        } catch (err) {
            console.error("Error fetching savings data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDeposit = (goal: SavingsGoal) => {
        setMovementModalGoal(goal);
        setMovementType("Aporte");
    };

    const handleWithdraw = (goal: SavingsGoal) => {
        setMovementModalGoal(goal);
        setMovementType("Retiro");
    };

    const handleConfirmDelete = async () => {
        if (!deleteGoalId) return;
        try {
            const res = await fetch(`/api/savings/goals?id=${deleteGoalId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Error al eliminar meta");
            setDeleteGoalId(null);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("No se pudo eliminar la meta.");
        }
    };

    // Calculate totals
    const totalSavedARS = goals
        .filter(g => g.currency === "ARS")
        .reduce((s, g) => s + (g.currentSaved || 0), 0);

    const totalSavedUSD = goals
        .filter(g => g.currency === "USD")
        .reduce((s, g) => s + (g.currentSaved || 0), 0);

    const emergencyGoal = goals.find(g => g.isEmergency);

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner} />
                <p>Cargando metas y ahorros...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                isOpen={!!deleteGoalId}
                title="Eliminar Meta de Ahorro"
                message="¿Estás seguro de eliminar esta meta? Los movimientos históricos registrados no se borrarán."
                confirmLabel="Eliminar"
                cancelLabel="Cancelar"
                danger
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteGoalId(null)}
            />

            {/* Create Goal Modal */}
            {showCreateGoalModal && (
                <GoalFormModal
                    onClose={() => setShowCreateGoalModal(false)}
                    onGoalCreated={fetchData}
                />
            )}

            {/* Quick Movement Modal (Aporte / Retiro) */}
            {movementModalGoal && (
                <SavingsMovementModal
                    goal={movementModalGoal}
                    initialType={movementType}
                    onClose={() => setMovementModalGoal(null)}
                    onSuccess={fetchData}
                />
            )}

            {/* ── Header ── */}
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Ahorros & Objetivos</h2>
                    <p className={styles.subtitle}>
                        Planifica tus metas, gestiona tu fondo de emergencia y haz seguimiento de tu progreso.
                    </p>
                </div>

                <button
                    type="button"
                    className={styles.btnNewGoal}
                    onClick={() => setShowCreateGoalModal(true)}
                >
                    + Nueva Meta
                </button>
            </div>

            {/* ── Summary Overview ── */}
            <div className={styles.summaryGrid}>
                {/* Total Ahorrado ARS */}
                <div className={`glass-panel ${styles.summaryCard}`}>
                    <span className={styles.summaryLabel}>Total Ahorrado (ARS)</span>
                    <span className={styles.summaryValue}>${fmt(totalSavedARS)}</span>
                    <span className={styles.summarySmall}>Distribuido en metas en pesos</span>
                </div>

                {/* Total Ahorrado USD */}
                <div className={`glass-panel ${styles.summaryCard}`}>
                    <span className={styles.summaryLabel}>Total Ahorrado (USD)</span>
                    <span className={styles.summaryValue}>USD ${fmt(totalSavedUSD)}</span>
                    <span className={styles.summarySmall}>Distribuido en metas en dólares</span>
                </div>

                {/* Fondo de Emergencia Highlights */}
                <div className={`glass-panel ${styles.summaryCard} ${styles.summaryCardEmergency}`}>
                    <span className={styles.summaryLabel}>🛡️ Fondo de Emergencia</span>
                    <span className={styles.summaryValue}>
                        ${fmt(emergencyGoal?.currentSaved || 0)}
                    </span>
                    <span className={styles.summarySmall}>
                        {emergencyGoal?.monthsCovered !== undefined && emergencyGoal.monthsCovered > 0
                            ? `Cubre ${emergencyGoal.monthsCovered} de ${emergencyGoal.targetMonths || 6} meses ($${fmt(avgMonthlyExpense)}/mes)`
                            : "Aporta para protegerte ante imprevistos"}
                    </span>
                </div>
            </div>

            {/* ── Goals Grid ── */}
            <section className={styles.goalsSection}>
                <div className={styles.sectionHeader}>
                    <h3>Tus Metas Activas ({goals.length})</h3>
                </div>

                <div className={styles.goalsGrid}>
                    {goals.map(goal => (
                        <GoalCard
                            key={goal.id}
                            goal={goal}
                            onDeposit={handleDeposit}
                            onWithdraw={handleWithdraw}
                            onDelete={id => setDeleteGoalId(id)}
                        />
                    ))}
                </div>
            </section>

            {/* ── Recent Savings Movements ── */}
            {movements.length > 0 && (
                <section className={`glass-panel ${styles.historySection}`}>
                    <div className={styles.sectionHeader}>
                        <h3>Últimos Movimientos de Ahorro</h3>
                        <span className={styles.historyCount}>{movements.length} registrados</span>
                    </div>

                    <div className={styles.movementsList}>
                        {movements.map(m => (
                            <div key={m.id} className={styles.movementItem}>
                                <div className={styles.movementLeft}>
                                    <span
                                        className={`${styles.movementBadge} ${
                                            m.category === "Retiro" ? styles.badgeRetiro : styles.badgeAporte
                                        }`}
                                    >
                                        {m.category === "Retiro" ? "➖ Retiro" : "➕ Aporte"}
                                    </span>
                                    <div className={styles.movementDetails}>
                                        <span className={styles.movementGoal}>{m.goalName}</span>
                                        {m.comment && (
                                            <span className={styles.movementComment}>{m.comment}</span>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.movementRight}>
                                    <span
                                        className={`${styles.movementAmount} ${
                                            m.amount >= 0 ? styles.amountPositive : styles.amountNegative
                                        }`}
                                    >
                                        {m.amount >= 0 ? "+" : ""}${fmt(m.amount)}
                                    </span>
                                    <span className={styles.movementDate}>{m.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

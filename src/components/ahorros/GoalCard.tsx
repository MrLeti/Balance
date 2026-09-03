"use client";

import React from "react";
import styles from "./AhorrosDashboard.module.css";
import { SavingsGoal } from "@/lib/utils/savings";

interface GoalCardProps {
    goal: SavingsGoal & {
        currentSaved: number;
        effectiveTarget: number;
        progress: number;
        monthsCovered?: number;
    };
    onDeposit: (goal: SavingsGoal) => void;
    onWithdraw: (goal: SavingsGoal) => void;
    onDelete: (goalId: string) => void;
}

const fmt = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GoalCard({ goal, onDeposit, onWithdraw, onDelete }: GoalCardProps) {
    const curSymbol = goal.currency === "USD" ? "USD $" : "$";
    const isCompleted = goal.effectiveTarget > 0 && goal.currentSaved >= goal.effectiveTarget;

    // Calculate days remaining if deadline exists
    let daysRemaining: number | null = null;
    if (goal.deadline) {
        const deadlineDate = new Date(goal.deadline);
        const now = new Date();
        const diffMs = deadlineDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return (
        <div className={`glass-panel ${styles.goalCard} ${goal.isEmergency ? styles.emergencyGoalCard : ""}`}>
            {/* Header: Icon, Title & Delete */}
            <div className={styles.goalCardHeader}>
                <div className={styles.goalTitleGroup}>
                    <span className={styles.goalIcon}>{goal.icon}</span>
                    <div>
                        <h4 className={styles.goalName}>{goal.name}</h4>
                        {goal.isEmergency && (
                            <span className={styles.emergencyTag}>🛡️ Fondo de Emergencia</span>
                        )}
                        {daysRemaining !== null && daysRemaining > 0 && !isCompleted && (
                            <span className={styles.daysTag}>⏳ Quedan {daysRemaining} días</span>
                        )}
                        {isCompleted && (
                            <span className={styles.completedTag}>✨ ¡Meta Cumplida!</span>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    className={styles.deleteGoalBtn}
                    onClick={() => onDelete(goal.id)}
                    title="Eliminar meta"
                >
                    ×
                </button>
            </div>

            {/* Amounts */}
            <div className={styles.goalAmounts}>
                <div className={styles.savedAmountWrapper}>
                    <span className={styles.savedLabel}>Ahorrado</span>
                    <span className={styles.savedValue}>
                        {curSymbol}{fmt(goal.currentSaved)}
                    </span>
                </div>

                {goal.effectiveTarget > 0 && (
                    <div className={styles.targetAmountWrapper}>
                        <span className={styles.targetLabel}>
                            {goal.isEmergency && goal.targetMonths ? `Meta (${goal.targetMonths}m)` : "Meta"}
                        </span>
                        <span className={styles.targetValue}>
                            {curSymbol}{fmt(goal.effectiveTarget)}
                        </span>
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            {goal.effectiveTarget > 0 && (
                <div className={styles.progressContainer}>
                    <div className={styles.progressBar}>
                        <div
                            className={`${styles.progressFill} ${goal.isEmergency ? styles.progressEmergency : ""}`}
                            style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                        />
                    </div>
                    <span className={styles.progressPercent}>{goal.progress}%</span>
                </div>
            )}

            {/* Emergency Months metric */}
            {goal.isEmergency && goal.monthsCovered !== undefined && (
                <div className={styles.monthsMetric}>
                    <span>
                        Cobertura: <strong>{goal.monthsCovered} de {goal.targetMonths || 6} meses</strong> objetivo
                    </span>
                </div>
            )}

            {/* Action Buttons */}
            <div className={styles.goalActions}>
                <button
                    type="button"
                    className={styles.actionBtnDeposit}
                    onClick={() => onDeposit(goal)}
                >
                    ➕ Aportar
                </button>
                <button
                    type="button"
                    className={styles.actionBtnWithdraw}
                    onClick={() => onWithdraw(goal)}
                    disabled={goal.currentSaved <= 0}
                >
                    ➖ Retirar
                </button>
            </div>
        </div>
    );
}

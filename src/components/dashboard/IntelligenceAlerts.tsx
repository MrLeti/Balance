import React, { useState, useEffect, useMemo } from 'react';
import { fmt, parseSafeAmount } from "@/lib/utils/format";
import { CategoryItem } from "@/lib/constants";
import { 
    Subscription, 
    evaluateEmergencyFund, 
    detectCategorySpikes, 
    detectMicroSpending, 
    evaluateBudget503020, 
    detectEndingInstalments, 
    detectPositiveMilestones,
    detectSavingsVelocity,
    detectUnpaidSubscriptions,
    detectInactivity,
    detectMissingIncome,
    detectNextMonthEndingInstalments,
    InstalmentPlan,
    IntelligenceAlert
} from "@/lib/utils/intelligence";

interface IntelligenceAlertsProps {
    cashflowProjection: { projected: number; daysPassed: number; daysInMonth: number } | null;
    subscriptions: Subscription[];
    cuotasProximas: number;
    availableMonths: string[];
    data: any[];
    balanceMonth?: string;
    balance?: number;
    ingresos?: number;
    egresos?: number;
    instalmentsData?: InstalmentPlan[];
    balanceHistorico?: number;
    filteredMonthData?: any[];
    initialSavingsGoals?: any[];
    categories?: CategoryItem[];
}

export default function IntelligenceAlerts({
    cashflowProjection,
    subscriptions = [],
    cuotasProximas = 0,
    availableMonths = [],
    data = [],
    balanceMonth = "Total",
    balance = 0,
    ingresos = 0,
    egresos = 0,
    instalmentsData = [],
    balanceHistorico,
    filteredMonthData,
    initialSavingsGoals,
    categories = [],
}: IntelligenceAlertsProps) {
    // ─── Configuración del Fondo de Emergencia (Sincronizada con módulo Ahorros) ─────
    const [targetMonths, setTargetMonths] = useState<number>(6);
    const [showAllAlerts, setShowAllAlerts] = useState<boolean>(false);
    const [emergencyGoalSaved, setEmergencyGoalSaved] = useState<number | undefined>(undefined);

    useEffect(() => {
        const saved = localStorage.getItem('balance_emergency_months');
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 24) {
                setTargetMonths(parsed);
            }
        }

        if (initialSavingsGoals && initialSavingsGoals.length > 0) {
            const em = initialSavingsGoals.find((g: any) => g.isEmergency || g.is_emergency || g.name.toLowerCase().includes("emergencia"));
            if (em) {
                setEmergencyGoalSaved(em.currentSaved || 0);
                if (em.targetMonths) {
                    setTargetMonths(em.targetMonths);
                }
            }
            return;
        }

        fetch("/api/savings/goals")
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d && Array.isArray(d.goals)) {
                    const em = d.goals.find((g: any) => g.isEmergency || g.is_emergency || g.name.toLowerCase().includes("emergencia"));
                    if (em) {
                        setEmergencyGoalSaved(em.currentSaved || 0);
                        if (em.targetMonths) {
                            setTargetMonths(em.targetMonths);
                        }
                    }
                }
            })
            .catch(() => {});
    }, [initialSavingsGoals]);

    const handleTargetMonthsChange = (newMonths: number) => {
        setTargetMonths(newMonths);
        localStorage.setItem('balance_emergency_months', String(newMonths));
    };

    // ─── 1. Evaluación del Fondo de Emergencia ──────────────────────────────────
    // Total histórico consolidado de balance
    const balanceTotal = useMemo(() => {
        if (typeof balanceHistorico === "number") return balanceHistorico;
        let total = 0;
        data.forEach(r => {
            if (!r || r.length < 6) return;
            const type = r[2];
            const val = parseSafeAmount(r[5]);
            if (type === "Ingreso") total += val;
            if (type === "Egreso") total -= val;
        });
        return total;
    }, [data, balanceHistorico]);

    const emergencyMetrics = useMemo(() => {
        return evaluateEmergencyFund(data, availableMonths, balanceTotal, targetMonths, emergencyGoalSaved);
    }, [data, availableMonths, balanceTotal, targetMonths, emergencyGoalSaved]);

    // ─── 2. Generación Dinámica de Alertas e Insights ──────────────────────────
    const alerts = useMemo(() => {
        const list: IntelligenceAlert[] = [];

        // A. Proyección de Gasto Elevada (Burn rate)
        if (cashflowProjection) {
            const validMonths = availableMonths.filter(m => m !== "Total" && m.includes("/"));
            const mesesHist = Math.max(1, validMonths.length);
            const totalHistEgresos = data
                .filter(r => r[2] === "Egreso" && String(r[3] || "").toLowerCase() !== "ahorro" && String(r[3] || "").toLowerCase() !== "transferencias")
                .reduce((acc, r) => acc + parseSafeAmount(r[5]), 0);
            const avgEgreso = totalHistEgresos / mesesHist;

            if (avgEgreso > 0 && cashflowProjection.projected > avgEgreso * 1.1) {
                const pctOver = Math.round(((cashflowProjection.projected / avgEgreso) - 1) * 100);
                list.push({
                    id: "cashflow-burn",
                    type: "warning",
                    tag: "Ritmo de Gasto",
                    title: "Proyección de Gasto Elevada",
                    message: `A este ritmo, gastarás ${fmt(cashflowProjection.projected)} a fin de mes, un +${pctOver}% por encima de tu promedio habitual (${fmt(avgEgreso)}).`,
                });
            }
        }

        // B. Vencimiento de Cuotas / Tarjetas Próximo
        if (cuotasProximas > 0) {
            list.push({
                id: "cuotas-vencimiento",
                type: "danger",
                tag: "Vencimiento",
                title: "Vencimiento de Tarjetas Próximo",
                message: `Tienes compromisos de ${fmt(cuotasProximas)} en cuotas exigibles en los próximos días. Asegúrate de contar con saldo en cuenta.`,
            });
        }

        // C. Pico Anómalo en Categoría Específica
        const spikeAlert = detectCategorySpikes(data, balanceMonth);
        if (spikeAlert) list.push(spikeAlert);

        // D. Gastos Hormiga Acumulados
        const filteredMonthRows = filteredMonthData || filterByMonth(data, balanceMonth);
        const microAlert = detectMicroSpending(filteredMonthRows, egresos);
        if (microAlert) list.push(microAlert);

        // E. Diagnóstico Presupuestario 50/30/20
        const budgetAlert = evaluateBudget503020(filteredMonthRows, ingresos, egresos);
        if (budgetAlert) list.push(budgetAlert);

        // G. Gastos fijos mensuales no registrados (suscripciones marcadas manualmente)
        const unpaidSubsAlert = detectUnpaidSubscriptions(categories, filteredMonthRows, balanceMonth);
        if (unpaidSubsAlert) list.push(unpaidSubsAlert);

        // H. Fin / Desahogo de Cuotas (este mes y próximo mes)
        const endingCuotas = detectEndingInstalments(instalmentsData);
        endingCuotas.forEach(ec => list.push(ec));
        const nextEndingCuotas = detectNextMonthEndingInstalments(instalmentsData);
        nextEndingCuotas.forEach(nec => list.push(nec));

        // I. Proyección y Velocidad de Metas de Ahorro
        const velocityAlerts = detectSavingsVelocity(initialSavingsGoals || [], data);
        velocityAlerts.forEach(va => list.push(va));

        // J. Mes sin ingresos registrados
        const missingIncomeAlert = detectMissingIncome(ingresos, balanceMonth);
        if (missingIncomeAlert) list.push(missingIncomeAlert);

        // K. Recordatorio de inactividad
        const inactivityAlert = detectInactivity(data);
        if (inactivityAlert) list.push(inactivityAlert);

        // L. Logros y Récords Positivos de Ahorro
        const tan = ingresos > 0 ? ((ingresos - egresos) / ingresos) * 100 : 0;
        const positiveAlert = detectPositiveMilestones(tan, balance, ingresos);
        if (positiveAlert) list.push(positiveAlert);

        // Orden de severidad: danger -> warning -> info -> success
        const priorityOrder = { danger: 1, warning: 2, info: 3, success: 4 };
        return list.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);
    }, [
        cashflowProjection,
        cuotasProximas,
        categories,
        data,
        balanceMonth,
        availableMonths,
        egresos,
        ingresos,
        balance,
        instalmentsData,
        filteredMonthData,
        initialSavingsGoals
    ]);

    const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 3);

    return (
        <section
            className="glass-panel"
            style={{
                padding: '24px',
                gridColumn: '1 / -1',
                borderRadius: '20px',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                boxShadow: 'var(--glass-shadow)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
            }}
        >
            {/* ─── Encabezado Principal ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem' }}>✨</span>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                            Insights & Alertas Inteligentes
                        </h3>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Diagnóstico financiero proactivo y seguimiento patrimonial
                        </span>
                    </div>
                </div>

                {alerts.length > 0 && (
                    <span
                        style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '99px',
                            background: 'var(--md-sys-color-surface-container, var(--bg-color))',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-main)',
                        }}
                    >
                        {alerts.length} {alerts.length === 1 ? 'notificación activa' : 'notificaciones activas'}
                    </span>
                )}
            </div>

            {/* ─── Tarjeta Destacada: Fondo de Emergencia ─── */}
            <div
                style={{
                    padding: '18px 20px',
                    borderRadius: '16px',
                    background: 'var(--md-sys-color-surface-container, var(--bg-color))',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                        <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)' }}>
                            Fondo de Emergencia
                        </span>
                        <span
                            style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '99px',
                                background: emergencyMetrics.monthsCovered >= emergencyMetrics.targetMonths
                                    ? 'rgba(34, 197, 94, 0.15)'
                                    : emergencyMetrics.monthsCovered >= (emergencyMetrics.targetMonths / 2)
                                        ? 'rgba(245, 158, 11, 0.15)'
                                        : 'rgba(239, 68, 68, 0.15)',
                                color: emergencyMetrics.monthsCovered >= emergencyMetrics.targetMonths
                                    ? 'var(--md-sys-color-success, #22c55e)'
                                    : emergencyMetrics.monthsCovered >= (emergencyMetrics.targetMonths / 2)
                                        ? '#f59e0b'
                                        : 'var(--danger-color, #ef4444)',
                            }}
                        >
                            {emergencyMetrics.monthsCovered >= emergencyMetrics.targetMonths
                                ? '🟢 Blindado'
                                : emergencyMetrics.monthsCovered >= (emergencyMetrics.targetMonths / 2)
                                    ? '🟡 En Camino'
                                    : '🔴 En Construcción'}
                        </span>
                    </div>

                    {/* Selector de Meses Objetivo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label htmlFor="emergency-months-select" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            Meta:
                        </label>
                        <select
                            id="emergency-months-select"
                            value={targetMonths}
                            onChange={(e) => handleTargetMonthsChange(parseInt(e.target.value, 10))}
                            aria-label="Meses objetivo del fondo de emergencia"
                            style={{
                                background: 'var(--bg-color)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                padding: '4px 10px',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                outline: 'none',
                            }}
                        >
                            {[1, 2, 3, 4, 5, 6, 8, 9, 12, 18, 24].map((num) => (
                                <option key={num} value={num}>
                                    {num} {num === 1 ? 'mes' : 'meses'} {num === 6 ? '⭐ (Recomendado)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Métricas y Barra de Progreso */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                {emergencyMetrics.monthsCovered}
                            </span>
                            <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: '4px' }}>
                                de {emergencyMetrics.targetMonths} meses cubiertos
                            </span>
                        </div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            <strong>{fmt(emergencyMetrics.emergencyBalance)}</strong> de {fmt(emergencyMetrics.targetAmount)} ({emergencyMetrics.progressPct}%)
                        </span>
                    </div>

                    {/* Progress Track */}
                    <div
                        style={{
                            width: '100%',
                            height: '8px',
                            borderRadius: '99px',
                            background: 'rgba(0, 0, 0, 0.15)',
                            overflow: 'hidden',
                            position: 'relative',
                        }}
                    >
                        <div
                            style={{
                                width: `${emergencyMetrics.progressPct}%`,
                                height: '100%',
                                borderRadius: '99px',
                                background: emergencyMetrics.monthsCovered >= emergencyMetrics.targetMonths
                                    ? 'linear-gradient(90deg, #10b981, #22c55e)'
                                    : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        />
                    </div>
                </div>

                {/* Nota al pie */}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.85 }}>
                    💡 Costo de vida mensual representativo (sin compras atípicas): <strong>${fmt(emergencyMetrics.avgMonthlyExpense)}/mes</strong>
                    {emergencyMetrics.isExplicit
                        ? ' · Sincronizado con tu Meta de Fondo de Emergencia.'
                        : ' · Calculado sobre tu liquidez neta acumulada.'}
                </span>
            </div>

            {/* ─── Lista de Alertas Inteligentes ─── */}
            {alerts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {visibleAlerts.map((alert) => {
                        const styleConfig = getAlertStyle(alert.type);

                        return (
                            <div
                                key={alert.id}
                                style={{
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    background: styleConfig.bg,
                                    border: `1px solid ${styleConfig.border}`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    transition: 'transform 0.15s ease',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>{styleConfig.icon}</span>
                                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                                            {alert.title}
                                        </strong>
                                    </div>
                                    {alert.tag && (
                                        <span
                                            style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                background: styleConfig.tagBg,
                                                color: styleConfig.tagColor,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            {alert.tag}
                                        </span>
                                    )}
                                </div>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.45, opacity: 0.9 }}>
                                    {alert.message}
                                </span>
                            </div>
                        );
                    })}

                    {/* Botón Ver Más / Ver Menos */}
                    {alerts.length > 3 && (
                        <button
                            type="button"
                            onClick={() => setShowAllAlerts(!showAllAlerts)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-color, #0061a4)',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                alignSelf: 'center',
                                padding: '6px 12px',
                                marginTop: '4px',
                                transition: 'opacity 0.2s',
                            }}
                        >
                            {showAllAlerts ? '▲ Ver menos alertas' : `▼ Ver todas las alertas (${alerts.length})`}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}

// ─── Helpers de Estilo por Tipo de Alerta ──────────────────────────────────
function getAlertStyle(type: IntelligenceAlert['type']) {
    switch (type) {
        case 'danger':
            return {
                icon: '🚨',
                bg: 'rgba(239, 68, 68, 0.08)',
                border: 'rgba(239, 68, 68, 0.25)',
                tagBg: 'rgba(239, 68, 68, 0.18)',
                tagColor: 'var(--danger-color, #ef4444)',
            };
        case 'warning':
            return {
                icon: '⚠️',
                bg: 'rgba(245, 158, 11, 0.08)',
                border: 'rgba(245, 158, 11, 0.25)',
                tagBg: 'rgba(245, 158, 11, 0.18)',
                tagColor: '#d97706',
            };
        case 'success':
            return {
                icon: '🎉',
                bg: 'rgba(34, 197, 94, 0.08)',
                border: 'rgba(34, 197, 94, 0.25)',
                tagBg: 'rgba(34, 197, 94, 0.18)',
                tagColor: 'var(--md-sys-color-success, #22c55e)',
            };
        case 'info':
        default:
            return {
                icon: '💡',
                bg: 'rgba(59, 130, 246, 0.08)',
                border: 'rgba(59, 130, 246, 0.25)',
                tagBg: 'rgba(59, 130, 246, 0.18)',
                tagColor: '#2563eb',
            };
    }
}

// Helper para filtrar transacciones del mes seleccionado
function filterByMonth(data: any[], balanceMonth: string) {
    if (balanceMonth === "Total") return data;
    return data.filter(row => {
        if (!row || row.length < 6) return false;
        const dateStr = String(row[1] || "");
        const parts = dateStr.split("/");
        if (parts.length >= 3) {
            if (balanceMonth.length === 4) {
                return parts[2] === balanceMonth;
            }
            return `${parts[1]}/${parts[2]}` === balanceMonth;
        }
        return false;
    });
}

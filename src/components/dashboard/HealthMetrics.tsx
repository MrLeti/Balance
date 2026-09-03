import React, { useMemo } from 'react';
import { fmt, parseSafeAmount } from "@/lib/utils/format";

interface HealthMetricsProps {
    balanceMonth: string;
    setBalanceMonth?: (month: string) => void;
    availableMonths?: string[];
    ingresos: number;
    egresos: number;
    balance: number;
    inversiones?: number;
    ahorros?: number;
    cuotasMesActual: number;
    vestaScore: number;
    data?: (string | number)[][];
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function HealthMetrics({
    balanceMonth,
    setBalanceMonth,
    availableMonths = [],
    ingresos,
    egresos,
    balance,
    inversiones = 0,
    ahorros = 0,
    cuotasMesActual,
    vestaScore,
    data = []
}: HealthMetricsProps) {
    // 1. Tasa de Ahorro (TAN)
    const tan = ingresos > 0 ? ((ingresos - egresos) / ingresos) * 100 : 0;
    const tanColor = tan >= 20 ? 'var(--md-sys-color-success, #22c55e)' : tan >= 10 ? '#f59e0b' : 'var(--danger-color, #ef4444)';
    const tanLabel = tan >= 20 ? '🟢 Excelente' : tan >= 10 ? '🟡 Moderado' : '🔴 Bajo';

    // 2. DTI (Compromiso de Cuotas)
    const dti = ingresos > 0 ? (cuotasMesActual / ingresos) * 100 : 0;
    const dtiColor = dti <= 30 ? 'var(--md-sys-color-success, #22c55e)' : dti <= 45 ? '#f59e0b' : 'var(--danger-color, #ef4444)';

    // 3. Vesta Score
    const scoreColor = vestaScore >= 80 ? 'var(--md-sys-color-success, #22c55e)' : vestaScore >= 50 ? '#f59e0b' : 'var(--danger-color, #ef4444)';
    const scoreLabel = vestaScore >= 80 ? '🌟 Excelente' : vestaScore >= 50 ? '⚠️ Regular' : '🚨 Riesgo';

    // 4. % Gasto sobre Ingreso
    const gastoPercent = ingresos > 0 ? (egresos / ingresos) * 100 : egresos > 0 ? 100 : 0;
    const gastoColor = gastoPercent <= 70 
        ? 'var(--md-sys-color-success, #22c55e)' 
        : gastoPercent <= 90 
            ? '#f59e0b' 
            : 'var(--danger-color, #ef4444)';
    const gastoLabel = gastoPercent <= 70 ? '🟢 Controlado' : gastoPercent <= 90 ? '🟡 Ajustado' : '🔴 Elevado';

    // 5. Historial de % gasto de los 3 meses previos + actual para el mini gráfico de barras
    const historicalBars = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Precalcular totales mensuales de ingresos y egresos
        const monthTotals: Record<string, { ingresos: number; egresos: number }> = {};
        data.forEach(row => {
            if (row.length < 6) return;
            const dateStr = String(row[1] || "");
            const dParts = dateStr.split("/");
            if (dParts.length >= 3) {
                const mKey = `${dParts[1]}/${dParts[2]}`;
                if (!monthTotals[mKey]) monthTotals[mKey] = { ingresos: 0, egresos: 0 };
                const type = row[2];
                const val = parseSafeAmount(row[5]);
                if (type === "Ingreso") monthTotals[mKey].ingresos += val;
                if (type === "Egreso") monthTotals[mKey].egresos += val;
            }
        });

        const targetList: { key: string; label: string; isCurrent: boolean }[] = [];
        const parts = balanceMonth.split("/");

        if (parts.length >= 2) {
            const curM = parseInt(parts[0], 10);
            const curY = parseInt(parts[1], 10);

            // 3 meses anteriores cronológicos
            for (let offset = 3; offset >= 1; offset--) {
                let m = curM - offset;
                let y = curY;
                while (m <= 0) {
                    m += 12;
                    y -= 1;
                }
                const key = `${String(m).padStart(2, "0")}/${y}`;
                targetList.push({
                    key,
                    label: MONTH_NAMES[m - 1],
                    isCurrent: false
                });
            }
            // Mes actual / seleccionado
            targetList.push({
                key: balanceMonth,
                label: MONTH_NAMES[curM - 1] || "Act",
                isCurrent: true
            });
        } else {
            // Caso "Total" o Año: seleccionar los últimos 4 meses disponibles
            const monthKeys = availableMonths.filter(m => m.includes("/")).slice(0, 4).reverse();
            monthKeys.forEach((mKey, idx) => {
                const mParts = mKey.split("/");
                const mNum = parseInt(mParts[0], 10);
                targetList.push({
                    key: mKey,
                    label: MONTH_NAMES[mNum - 1] || mKey,
                    isCurrent: idx === monthKeys.length - 1
                });
            });
        }

        return targetList.map(item => {
            const stats = monthTotals[item.key] || { ingresos: 0, egresos: 0 };
            const pct = stats.ingresos > 0 
                ? (stats.egresos / stats.ingresos) * 100 
                : stats.egresos > 0 ? 100 : 0;

            let color = 'var(--md-sys-color-success, #22c55e)';
            if (pct > 90) color = 'var(--danger-color, #ef4444)';
            else if (pct > 70) color = '#f59e0b';
            else if (stats.ingresos === 0 && stats.egresos === 0) color = 'var(--glass-border)';

            return {
                ...item,
                ingresos: stats.ingresos,
                egresos: stats.egresos,
                percent: pct,
                color
            };
        });
    }, [data, balanceMonth, availableMonths]);

    return (
        <section
            className="glass-panel"
            style={{
                padding: '24px',
                gridColumn: '1 / -1',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                borderRadius: '20px',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                boxShadow: 'var(--glass-shadow)',
            }}
        >
            {/* Header with Title & Period Selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                        Salud Financiera
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {balanceMonth === 'Total' ? 'Visión histórica consolidada' : `Resumen del período · ${balanceMonth}`}
                    </span>
                </div>

                {setBalanceMonth && availableMonths.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                            value={balanceMonth}
                            onChange={(e) => setBalanceMonth(e.target.value)}
                            aria-label="Seleccionar período"
                            style={{
                                background: 'var(--md-sys-color-surface-container, var(--bg-color))',
                                color: 'var(--text-main)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '12px',
                                padding: '8px 14px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                outline: 'none',
                            }}
                        >
                            <option value="Total">🗓️ Histórico Total</option>
                            {availableMonths.map((m) => (
                                <option key={m} value={m}>
                                    📅 {m}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* 5 Hero KPI Cards */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: '16px',
                }}
            >
                {/* 1. Balance Neto */}
                <div
                    style={{
                        padding: '18px 16px',
                        borderRadius: '16px',
                        background: 'var(--md-sys-color-surface-container, var(--bg-color))',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '6px',
                        transition: 'transform 0.2s',
                    }}
                >
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Balance Neto
                    </span>
                    <span
                        style={{
                            fontSize: '1.65rem',
                            fontWeight: 800,
                            color: balance >= 0 ? 'var(--md-sys-color-success, #22c55e)' : 'var(--danger-color, #ef4444)',
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {fmt(balance)}
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span style={{ color: 'var(--md-sys-color-success, #22c55e)', fontWeight: 500 }}>
                            Ingresos: +{fmt(ingresos)}
                        </span>
                        <span style={{ color: 'var(--danger-color, #ef4444)', fontWeight: 500 }}>
                            Egresos: -{fmt(egresos)}
                        </span>
                        {ahorros > 0 && (
                            <span style={{ color: '#3b82f6', fontWeight: 500 }}>
                                Ahorros: 🎯 {fmt(ahorros)}
                            </span>
                        )}
                        {inversiones > 0 && (
                            <span style={{ color: '#8b5cf6', fontWeight: 500 }}>
                                Inversiones: 📈 {fmt(inversiones)}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. % Gasto sobre Ingresos con Mini Gráfico de Barras */}
                <div
                    style={{
                        padding: '18px 16px',
                        borderRadius: '16px',
                        background: 'var(--md-sys-color-surface-container, var(--bg-color))',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '8px',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            % Gasto / Ingreso
                        </span>
                        <span style={{ fontSize: '0.75rem', color: gastoColor, fontWeight: 700 }}>
                            {gastoLabel}
                        </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '10px' }}>
                        <div style={{ minWidth: 0 }}>
                            <span
                                style={{
                                    fontSize: '1.65rem',
                                    fontWeight: 800,
                                    color: gastoColor,
                                    lineHeight: 1.1,
                                    letterSpacing: '-0.03em',
                                    display: 'block',
                                }}
                            >
                                {gastoPercent.toFixed(1)}%
                            </span>
                            <span
                                style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    display: 'block',
                                    marginTop: '2px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {ingresos > 0 ? `-${fmt(egresos)}` : 'Sin ingresos'}
                            </span>
                        </div>

                        {/* Mini Bar Chart (3 Meses Anteriores + Actual) */}
                        {historicalBars.length > 0 && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    gap: '5px',
                                    height: '42px',
                                    padding: '3px 6px',
                                    background: 'rgba(0, 0, 0, 0.12)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--glass-border)',
                                    flexShrink: 0,
                                }}
                                title="Evolución % gasto: 3 meses previos y mes actual"
                            >
                                {historicalBars.map((b) => {
                                    // Altura visual de la barra (mín 12% y máx 100%)
                                    const hPct = b.percent === 0 && b.egresos === 0 
                                        ? 8 
                                        : Math.min(100, Math.max(15, (b.percent / 100) * 100));
                                    
                                    const tooltipText = `${b.key} (${b.label}): ${b.percent.toFixed(1)}%\nIngresos: ${fmt(b.ingresos)}\nEgresos: ${fmt(b.egresos)}`;

                                    return (
                                        <div
                                            key={b.key}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '3px',
                                                width: '18px',
                                                cursor: 'pointer',
                                            }}
                                            title={tooltipText}
                                        >
                                            <div
                                                style={{
                                                    width: '100%',
                                                    height: '24px',
                                                    display: 'flex',
                                                    alignItems: 'flex-end',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '8px',
                                                        height: `${hPct}%`,
                                                        backgroundColor: b.color,
                                                        borderRadius: '3px',
                                                        opacity: b.isCurrent ? 1 : 0.75,
                                                        boxShadow: b.isCurrent ? `0 0 6px ${b.color}` : 'none',
                                                        transition: 'height 0.3s ease, opacity 0.2s',
                                                    }}
                                                />
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: '0.62rem',
                                                    fontWeight: b.isCurrent ? 700 : 500,
                                                    color: b.isCurrent ? 'var(--text-main)' : 'var(--text-muted)',
                                                    lineHeight: 1,
                                                }}
                                            >
                                                {b.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. TAN (Tasa de Ahorro) */}
                <div
                    style={{
                        padding: '18px 16px',
                        borderRadius: '16px',
                        background: 'var(--md-sys-color-surface-container, var(--bg-color))',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '6px',
                    }}
                >
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Tasa de Ahorro (TAN)
                    </span>
                    <span
                        style={{
                            fontSize: '1.65rem',
                            fontWeight: 800,
                            color: tanColor,
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                        }}
                    >
                        {tan.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '0.78rem', color: tanColor, fontWeight: 600 }}>
                        {tanLabel}
                    </span>
                </div>

                {/* 4. DTI (Compromiso de Cuotas) */}
                <div
                    style={{
                        padding: '18px 16px',
                        borderRadius: '16px',
                        background: 'var(--md-sys-color-surface-container, var(--bg-color))',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '6px',
                    }}
                >
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Cuotas este mes
                    </span>
                    <span
                        style={{
                            fontSize: '1.65rem',
                            fontWeight: 800,
                            color: 'var(--text-main)',
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {fmt(cuotasMesActual)}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: ingresos > 0 ? dtiColor : 'var(--text-muted)', fontWeight: 500 }}>
                        {ingresos > 0 ? `${dti.toFixed(1)}% del ingreso` : 'Sin ingresos reg.'}
                    </span>
                </div>

                {/* 5. Vesta Score */}
                <div
                    style={{
                        padding: '18px 16px',
                        borderRadius: '16px',
                        background: 'var(--md-sys-color-surface-container, var(--bg-color))',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '6px',
                    }}
                >
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Vesta Score
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span
                            style={{
                                fontSize: '1.65rem',
                                fontWeight: 800,
                                color: scoreColor,
                                lineHeight: 1.1,
                                letterSpacing: '-0.03em',
                            }}
                        >
                            {vestaScore}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>/100</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: scoreColor, fontWeight: 600 }}>
                        {scoreLabel}
                    </span>
                </div>
            </div>
        </section>
    );
}

"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import styles from "./CategoryDistributionCard.module.css";
import { fmt, parseSafeAmount, roundMoney } from "@/lib/utils/format";

export interface CategoryDistributionCardProps {
    data: (string | number)[][];
    dynamicColorMap?: Record<string, string>;
}

const MONTH_NAMES_FULL = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

type RangePreset = "3m" | "6m" | "all" | "custom";
type MovementType = "Egreso" | "Ingreso" | "Ahorro" | "Inversión";

export default function CategoryDistributionCard({
    data = [],
    dynamicColorMap = {},
}: CategoryDistributionCardProps) {
    const [rangePreset, setRangePreset] = useState<RangePreset>("all");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [movementType, setMovementType] = useState<MovementType>("Egreso");
    const [customFrom, setCustomFrom] = useState<string>("");
    const [customTo, setCustomTo] = useState<string>("");

    // Slider dragging state
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null);
    const [dragPct, setDragPct] = useState<{ start: number | null; end: number | null }>({
        start: null,
        end: null,
    });

    // Discover all unique categories for this movement type
    const availableCategories = useMemo(() => {
        const catSet = new Set<string>();
        data.forEach((row) => {
            if (!row || row.length < 6) return;
            const type = String(row[2] || "").trim();
            if (type !== movementType) return;
            const cat = String(row[3] || "").trim();
            if (cat) catSet.add(cat);
        });
        return Array.from(catSet).sort();
    }, [data, movementType]);

    // Parse all rows for current movement type and chronological bounds
    const parsedData = useMemo(() => {
        if (!data || data.length === 0) {
            return {
                parsedRows: [],
                minYear: 0,
                minMonth: 0,
                maxYear: 0,
                maxMonth: 0,
                minIso: "",
                maxIso: "",
                minTime: 0,
                maxTime: 0,
            };
        }

        let maxYear = 0;
        let maxMonth = 0;
        let minYear = 9999;
        let minMonth = 12;
        let minIso = "9999-99-99";
        let maxIso = "0000-00-00";

        const rows: { row: (string | number)[]; y: number; m: number; d: number; isoDate: string }[] = [];

        data.forEach((row) => {
            if (!row || row.length < 6) return;
            const type = String(row[2] || "").trim();
            if (type !== movementType) return;

            const dateStr = String(row[1] || "").trim();
            const parts = dateStr.includes("/") ? dateStr.split("/") : dateStr.split("-");
            if (parts.length < 3) return;

            let d = 0;
            let m = 0;
            let y = 0;
            if (parts[0].length === 4) {
                y = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10);
                d = parseInt(parts[2], 10);
            } else {
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10);
                y = parseInt(parts[2], 10);
            }

            if (isNaN(d) || isNaN(m) || isNaN(y) || m < 1 || m > 12) return;

            const isoDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            rows.push({ row, y, m, d, isoDate });

            const ym = y * 12 + m;
            if (ym > maxYear * 12 + maxMonth) {
                maxYear = y;
                maxMonth = m;
            }
            if (ym < minYear * 12 + minMonth) {
                minYear = y;
                minMonth = m;
            }
            if (isoDate < minIso) minIso = isoDate;
            if (isoDate > maxIso) maxIso = isoDate;
        });

        if (rows.length === 0 || maxYear === 0) {
            return {
                parsedRows: [],
                minYear: 0,
                minMonth: 0,
                maxYear: 0,
                maxMonth: 0,
                minIso: "",
                maxIso: "",
                minTime: 0,
                maxTime: 0,
            };
        }

        const minTime = new Date(`${minIso}T00:00:00Z`).getTime();
        const maxTime = new Date(`${maxIso}T23:59:59Z`).getTime();

        return {
            parsedRows: rows,
            minYear,
            minMonth,
            maxYear,
            maxMonth,
            minIso,
            maxIso,
            minTime,
            maxTime,
        };
    }, [data, movementType]);

    // Compute filteredRows, period label, and baseline slider percentages
    const { filteredRows, periodLabel, timelineStartPct, timelineEndPct, effectiveFromIso, effectiveToIso } = useMemo(() => {
        const { parsedRows, minYear, minMonth, maxYear, maxMonth, minIso, maxIso, minTime, maxTime } = parsedData;

        if (parsedRows.length === 0 || maxYear === 0) {
            return {
                filteredRows: [],
                periodLabel: "Sin movimientos",
                timelineStartPct: 0,
                timelineEndPct: 100,
                effectiveFromIso: "",
                effectiveToIso: "",
            };
        }

        // Determine cutoff month for presets
        let cutoffYear = minYear;
        let cutoffMonth = minMonth;

        if (rangePreset === "3m") {
            let m = maxMonth - 2;
            let y = maxYear;
            while (m <= 0) {
                m += 12;
                y -= 1;
            }
            cutoffYear = y;
            cutoffMonth = m;
        } else if (rangePreset === "6m") {
            let m = maxMonth - 5;
            let y = maxYear;
            while (m <= 0) {
                m += 12;
                y -= 1;
            }
            cutoffYear = y;
            cutoffMonth = m;
        }

        let validRows: (string | number)[][] = [];
        let label = "";
        let startPct = 0;
        let endPct = 100;

        const presetFromIso = rangePreset === "all"
            ? minIso
            : `${cutoffYear}-${String(cutoffMonth).padStart(2, "0")}-01`;
        const presetToIso = maxIso;

        const effectiveFromIso = rangePreset === "custom" ? (customFrom || minIso) : presetFromIso;
        const effectiveToIso = rangePreset === "custom" ? (customTo || maxIso) : presetToIso;

        if (rangePreset === "custom") {
            validRows = parsedRows
                .filter((item) => {
                    if (customFrom && item.isoDate < customFrom) return false;
                    if (customTo && item.isoDate > customTo) return false;
                    return true;
                })
                .map((item) => item.row);

            const fromLabel = customFrom ? customFrom : "Inicio";
            const toLabel = customTo ? customTo : "Actualidad";
            label = `${fromLabel} a ${toLabel}`;

            if (maxTime > minTime) {
                if (customFrom) {
                    const fromT = new Date(`${customFrom}T00:00:00Z`).getTime();
                    startPct = Math.max(0, Math.min(100, ((fromT - minTime) / (maxTime - minTime)) * 100));
                } else {
                    startPct = 0;
                }
                if (customTo) {
                    const toT = new Date(`${customTo}T23:59:59Z`).getTime();
                    endPct = Math.max(0, Math.min(100, ((toT - minTime) / (maxTime - minTime)) * 100));
                } else {
                    endPct = 100;
                }
            } else {
                startPct = 0;
                endPct = 100;
            }
        } else {
            const cutoffYm = cutoffYear * 12 + cutoffMonth;
            validRows = parsedRows
                .filter((item) => item.y * 12 + item.m >= cutoffYm)
                .map((item) => item.row);

            const startText = `${MONTH_NAMES_FULL[cutoffMonth - 1]} ${String(cutoffYear).slice(-2)}`;
            const endText = `${MONTH_NAMES_FULL[maxMonth - 1]} ${String(maxYear).slice(-2)}`;
            label = startText === endText ? startText : `${startText} a ${endText}`;

            if (rangePreset === "all") {
                startPct = 0;
                endPct = 100;
            } else if (maxTime > minTime) {
                const cutoffTime = new Date(`${presetFromIso}T00:00:00Z`).getTime();
                startPct = Math.max(0, Math.min(100, ((cutoffTime - minTime) / (maxTime - minTime)) * 100));
                endPct = 100;
            } else {
                startPct = 0;
                endPct = 100;
            }
        }

        return {
            filteredRows: validRows,
            periodLabel: label,
            timelineStartPct: startPct,
            timelineEndPct: endPct,
            effectiveFromIso,
            effectiveToIso,
        };
    }, [parsedData, rangePreset, customFrom, customTo]);

    // Active displayed percentage (respects ongoing drag or computed preset/date pct)
    const activeStartPct = dragPct.start !== null ? dragPct.start : timelineStartPct;
    const activeEndPct = dragPct.end !== null ? dragPct.end : timelineEndPct;

    // Direct percentage update logic
    const updateDragPct = useCallback((rawPct: number, handle: "start" | "end") => {
        const { minTime, maxTime, minIso, maxIso } = parsedData;
        if (minTime >= maxTime) return;

        if (handle === "start") {
            const currentEnd = dragPct.end !== null ? dragPct.end : timelineEndPct;
            const clampedPct = Math.max(0, Math.min(currentEnd - 1, rawPct));
            setDragPct((prev) => ({ ...prev, start: clampedPct }));

            const targetTime = minTime + (clampedPct / 100) * (maxTime - minTime);
            const d = new Date(targetTime);
            const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            setCustomFrom(iso);
            if (!customTo) {
                setCustomTo(effectiveToIso || maxIso);
            }
            setRangePreset("custom");
        } else {
            const currentStart = dragPct.start !== null ? dragPct.start : timelineStartPct;
            const clampedPct = Math.min(100, Math.max(currentStart + 1, rawPct));
            setDragPct((prev) => ({ ...prev, end: clampedPct }));

            const targetTime = minTime + (clampedPct / 100) * (maxTime - minTime);
            const d = new Date(targetTime);
            const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            setCustomTo(iso);
            if (!customFrom) {
                setCustomFrom(effectiveFromIso || minIso);
            }
            setRangePreset("custom");
        }
    }, [parsedData, dragPct, timelineStartPct, timelineEndPct, customFrom, customTo, effectiveFromIso, effectiveToIso]);

    // Convert pointer coordinate to percentage and update custom dates
    const updateDrag = useCallback((clientX: number, handle: "start" | "end") => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        if (rect.width <= 0) return;
        const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        updateDragPct(frac * 100, handle);
    }, [updateDragPct]);

    const handlePointerUp = useCallback(() => {
        setIsDragging(null);
        setDragPct({ start: null, end: null });
    }, []);

    const updateDragRef = useRef(updateDrag);
    updateDragRef.current = updateDrag;

    // Global pointer listeners during drag to support mouse and mobile touch effortlessly
    useEffect(() => {
        if (!isDragging) return;

        const onPointerMove = (e: PointerEvent) => {
            updateDragRef.current(e.clientX, isDragging);
        };

        const onPointerUp = () => {
            handlePointerUp();
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);

        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
        };
    }, [isDragging, handlePointerUp]);

    const handleHandlePointerDown = (handle: "start" | "end") => (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(handle);
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        updateDrag(e.clientX, handle);
    };

    const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        if (rect.width <= 0) return;
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const clickPct = frac * 100;
        const distStart = Math.abs(clickPct - timelineStartPct);
        const distEnd = Math.abs(clickPct - timelineEndPct);
        const handle = distStart <= distEnd ? "start" : "end";
        setIsDragging(handle);
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        updateDragPct(clickPct, handle);
    };

    const handleKeyDown = (handle: "start" | "end") => (e: React.KeyboardEvent) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const step = e.key === "ArrowLeft" ? -5 : 5;
            const current = handle === "start" ? timelineStartPct : timelineEndPct;
            updateDragPct(current + step, handle);
            setDragPct({ start: null, end: null });
        }
    };

    // Aggregate all categories and their subcategories
    const { categoriesList, totalAmount, totalCount } = useMemo(() => {
        const catAgg: Record<
            string,
            {
                amount: number;
                count: number;
                subcategories: Record<string, { amount: number; count: number }>;
            }
        > = {};
        let total = 0;
        let count = 0;

        filteredRows.forEach((row) => {
            const cat = String(row[3] || "").trim();
            const subCat = String(row[4] || "").trim() || "Sin subcategoría";
            const amount = Math.abs(parseSafeAmount(row[5]));

            if (!cat) return;
            if (!catAgg[cat]) {
                catAgg[cat] = { amount: 0, count: 0, subcategories: {} };
            }
            catAgg[cat].amount += amount;
            catAgg[cat].count += 1;

            if (!catAgg[cat].subcategories[subCat]) {
                catAgg[cat].subcategories[subCat] = { amount: 0, count: 0 };
            }
            catAgg[cat].subcategories[subCat].amount += amount;
            catAgg[cat].subcategories[subCat].count += 1;

            total += amount;
            count += 1;
        });

        const list = Object.keys(catAgg)
            .map((catName) => {
                const catData = catAgg[catName];
                const catPct = total > 0 ? Math.round((catData.amount / total) * 100) : 0;

                const subcategories = Object.keys(catData.subcategories)
                    .map((subName) => {
                        const subData = catData.subcategories[subName];
                        // Subcategory percentage is calculated strictly relative to overall totalAmount!
                        const subPct = total > 0 ? Math.round((subData.amount / total) * 100) : 0;
                        return {
                            name: subName,
                            category: catName,
                            amount: roundMoney(subData.amount),
                            count: subData.count,
                            percentage: subPct,
                        };
                    })
                    .sort((a, b) => b.amount - a.amount);

                return {
                    name: catName,
                    category: catName,
                    amount: roundMoney(catData.amount),
                    count: catData.count,
                    percentage: catPct,
                    subcategories,
                };
            })
            .sort((a, b) => b.amount - a.amount);

        return { categoriesList: list, totalAmount: roundMoney(total), totalCount: count };
    }, [filteredRows]);

    const toggleCategory = (catName: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(catName)) {
                next.delete(catName);
            } else {
                next.add(catName);
            }
            if (next.size === 1) {
                setSelectedCategory(Array.from(next)[0]);
            } else {
                setSelectedCategory("ALL");
            }
            return next;
        });
    };

    const defaultBarColor = useMemo(() => {
        if (movementType === "Ingreso") return "#22c55e";
        if (movementType === "Ahorro") return "#3b82f6";
        if (movementType === "Inversión") return "#8b5cf6";
        return "#ef4444";
    }, [movementType]);

    const emptyTypeLabel = useMemo(() => {
        if (movementType === "Inversión") return "inversiones";
        if (movementType === "Ahorro") return "ahorros";
        return `${movementType.toLowerCase()}s`;
    }, [movementType]);

    return (
        <section
            className={`glass-panel ${styles.card} ${styles.colSpanFull}`}
            data-testid="card-distribucion-categoria"
        >
            <div className={styles.header}>
                <h3 className={styles.title}>Distribución por categoría</h3>
                {expandedCategories.size > 0 && (
                    <button
                        className={styles.backBtn}
                        onClick={() => {
                            setExpandedCategories(new Set());
                            setSelectedCategory("ALL");
                        }}
                        aria-label="Volver a todas las categorías"
                    >
                        ← Ver todas las categorías
                    </button>
                )}
            </div>

            {/* Período & Filtros Control Box (matching attached image) */}
            <div className={styles.rangeBox}>
                <div className={styles.rangeTopRow}>
                    <span className={styles.rangeLabel}>Período</span>
                    <span className={styles.rangePeriodText}>{periodLabel}</span>
                </div>

                {/* Timeline Slider Track (Draggable with mouse or touch) */}
                <div className={styles.timelineWrapper}>
                    <div
                        ref={trackRef}
                        className={styles.timelineTrack}
                        data-testid="timeline-track"
                        onPointerDown={handleTrackPointerDown}
                        onPointerMove={(e) => {
                            if (isDragging) {
                                updateDrag(e.clientX, isDragging);
                            }
                        }}
                        onPointerUp={handlePointerUp}
                        title="Arrastra los extremos para ajustar el rango"
                    >
                        <div
                            className={styles.timelineFill}
                            style={{
                                left: `${activeStartPct}%`,
                                width: `${Math.max(0, activeEndPct - activeStartPct)}%`,
                                transition: isDragging ? "none" : "all 0.25s ease",
                            }}
                        />
                        <div
                            role="slider"
                            tabIndex={0}
                            aria-label="Fecha desde"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(activeStartPct)}
                            aria-valuetext={customFrom || periodLabel}
                            className={`${styles.timelineHandle} ${isDragging === "start" ? styles.dragging : ""}`}
                            style={{
                                left: `${activeStartPct}%`,
                                transition: isDragging ? "none" : "left 0.25s ease",
                            }}
                            onPointerDown={handleHandlePointerDown("start")}
                            onPointerMove={(e) => {
                                if (isDragging === "start") {
                                    updateDrag(e.clientX, "start");
                                }
                            }}
                            onPointerUp={handlePointerUp}
                            onKeyDown={handleKeyDown("start")}
                        />
                        <div
                            role="slider"
                            tabIndex={0}
                            aria-label="Fecha hasta"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(activeEndPct)}
                            aria-valuetext={customTo || periodLabel}
                            className={`${styles.timelineHandle} ${isDragging === "end" ? styles.dragging : ""}`}
                            style={{
                                left: `${activeEndPct}%`,
                                transition: isDragging ? "none" : "left 0.25s ease",
                            }}
                            onPointerDown={handleHandlePointerDown("end")}
                            onPointerMove={(e) => {
                                if (isDragging === "end") {
                                    updateDrag(e.clientX, "end");
                                }
                            }}
                            onPointerUp={handlePointerUp}
                            onKeyDown={handleKeyDown("end")}
                        />
                    </div>
                </div>

                <div className={styles.rangeControlsRow}>
                    <div className={styles.pillsGroup} role="group" aria-label="Selector de rango rápido">
                        <button
                            className={`${styles.pillBtn} ${rangePreset === "3m" ? styles.activePill : ""}`}
                            onClick={() => {
                                setRangePreset("3m");
                                setCustomFrom("");
                                setCustomTo("");
                            }}
                            type="button"
                        >
                            3 meses
                        </button>
                        <button
                            className={`${styles.pillBtn} ${rangePreset === "6m" ? styles.activePill : ""}`}
                            onClick={() => {
                                setRangePreset("6m");
                                setCustomFrom("");
                                setCustomTo("");
                            }}
                            type="button"
                        >
                            6 meses
                        </button>
                        <button
                            className={`${styles.pillBtn} ${rangePreset === "all" ? styles.activePill : ""}`}
                            onClick={() => {
                                setRangePreset("all");
                                setCustomFrom("");
                                setCustomTo("");
                            }}
                            type="button"
                        >
                            Todo
                        </button>
                        <button
                            className={`${styles.pillBtn} ${rangePreset === "custom" ? styles.activePill : ""}`}
                            onClick={() => setRangePreset("custom")}
                            type="button"
                        >
                            Personalizado
                        </button>
                    </div>

                    <div className={styles.filtersGroup}>
                        <select
                            className={styles.miniSelect}
                            value={selectedCategory}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedCategory(val);
                                if (val === "ALL") {
                                    setExpandedCategories(new Set());
                                } else {
                                    setExpandedCategories(new Set([val]));
                                }
                            }}
                            aria-label="Filtrar por categoría"
                        >
                            <option value="ALL">Todas las categorías</option>
                            {availableCategories.map((cat) => (
                                <option key={`cat-opt-${cat}`} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>

                        <select
                            className={styles.miniSelect}
                            value={movementType}
                            onChange={(e) => {
                                setMovementType(e.target.value as MovementType);
                                setSelectedCategory("ALL");
                                setExpandedCategories(new Set());
                            }}
                            aria-label="Tipo de movimiento"
                        >
                            <option value="Egreso">Egresos</option>
                            <option value="Ingreso">Ingresos</option>
                            <option value="Ahorro">Ahorros</option>
                            <option value="Inversión">Inversiones</option>
                        </select>
                    </div>
                </div>

                {rangePreset === "custom" && (
                    <div className={styles.customDateRow}>
                        <div className={styles.dateInputGroup}>
                            <label htmlFor="cat-dist-from">Desde:</label>
                            <input
                                id="cat-dist-from"
                                type="date"
                                className={styles.dateInput}
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                            />
                        </div>
                        <div className={styles.dateInputGroup}>
                            <label htmlFor="cat-dist-to">Hasta:</label>
                            <input
                                id="cat-dist-to"
                                type="date"
                                className={styles.dateInput}
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Subheader: Summary text */}
            <div className={styles.summaryRow}>
                {fmt(totalAmount)} en {totalCount} {totalCount === 1 ? "movimiento" : "movimientos"}
            </div>

            {/* Categorías / Subcategorías List with In-situ Drill Down */}
            {categoriesList.length > 0 ? (
                <div className={styles.itemsList}>
                    {categoriesList.map((item) => {
                        const isExpanded = expandedCategories.has(item.name);
                        const barColor =
                            dynamicColorMap[item.name] ||
                            defaultBarColor;

                        return (
                            <div key={item.name} className={styles.categoryBlock}>
                                <div
                                    className={styles.itemRow}
                                    onClick={() => toggleCategory(item.name)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            toggleCategory(item.name);
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    title={isExpanded ? `Contraer desglose de ${item.name}` : `Ver desglose de ${item.name}`}
                                    aria-expanded={isExpanded}
                                >
                                    <div className={styles.itemTopLine}>
                                        <span className={styles.itemName}>
                                            <span
                                                className={`${styles.drillIcon} ${
                                                    isExpanded ? styles.drillIconExpanded : ""
                                                }`}
                                            >
                                                ›
                                            </span>
                                            {item.name}
                                        </span>
                                        <div className={styles.itemValues}>
                                            <span className={styles.itemAmount}>{fmt(item.amount)}</span>
                                            <span className={styles.itemPercentage}>{item.percentage}%</span>
                                        </div>
                                    </div>
                                    <div className={styles.progressTrack}>
                                        <div
                                            className={styles.progressBar}
                                            style={{
                                                width: `${Math.min(100, Math.max(item.percentage, item.amount > 0 ? 1 : 0))}%`,
                                                backgroundColor: barColor,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Subcategorías Expandidas In-situ (el resto permanece visible) */}
                                {isExpanded && item.subcategories.length > 0 && (
                                    <div
                                        className={styles.subcategoriesList}
                                        data-testid={`subcategories-${item.name}`}
                                    >
                                        {item.subcategories.map((sub) => {
                                            const subBarColor = dynamicColorMap[sub.name] || barColor;
                                            return (
                                                <div key={sub.name} className={styles.subcategoryRow}>
                                                    <div className={styles.subTopLine}>
                                                        <span className={styles.subName}>
                                                            <span className={styles.subTreeBranch}>↳</span>
                                                            {sub.name}
                                                        </span>
                                                        <div className={styles.itemValues}>
                                                            <span className={styles.subAmount}>{fmt(sub.amount)}</span>
                                                            <span className={styles.itemPercentage}>
                                                                {sub.percentage}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.progressTrack}>
                                                        <div
                                                            className={styles.progressBar}
                                                            style={{
                                                                width: `${Math.min(
                                                                    100,
                                                                    Math.max(sub.percentage, sub.amount > 0 ? 1 : 0)
                                                                )}%`,
                                                                backgroundColor: subBarColor,
                                                                opacity: 0.85,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className={styles.emptyState}>
                    <p>No se registraron {emptyTypeLabel} en este rango seleccionado.</p>
                </div>
            )}
        </section>
    );
}

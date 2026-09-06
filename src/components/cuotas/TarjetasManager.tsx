"use client";

import { useEffect, useState } from "react";
import styles from "./CuotasDashboard.module.css";
import { DEFAULT_CARD_COLORS, getEstimatedCardDates, TarjetaInfo } from "@/lib/utils/cuotas";
import { formatAutoDateInput } from "@/lib/utils/format";

interface TarjetasManagerProps {
    onLiquidarCard?: (card: TarjetaInfo) => void;
}

export default function TarjetasManager({ onLiquidarCard }: TarjetasManagerProps = {}) {
    const [tarjetas, setTarjetas] = useState<TarjetaInfo[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Form to create new card
    const [showAddForm, setShowAddForm] = useState(false);
    const [nuevaTarjeta, setNuevaTarjeta] = useState("");
    const [nuevoColor, setNuevoColor] = useState(DEFAULT_CARD_COLORS[0]);
    const [nuevoDiaCierre, setNuevoDiaCierre] = useState("25");
    const [nuevoDiaVencimiento, setNuevoDiaVencimiento] = useState("5");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit state for table rows
    const [editingCards, setEditingCards] = useState<Record<string, Partial<TarjetaInfo>>>({});
    const [savingRowId, setSavingRowId] = useState<string | null>(null);
    const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

    useEffect(() => {
        fetchTarjetas();
    }, []);

    const fetchTarjetas = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/tarjetas");
            if (res.ok) {
                const json = await res.json();
                const cards: TarjetaInfo[] = (json.data || []).map((t: any, i: number) => {
                    const diaC = t.diaCierre || 25;
                    const diaV = t.diaVencimiento || 5;
                    const estimated = getEstimatedCardDates(diaC, diaV);
                    return {
                        id: t.id,
                        nombre: t.nombre,
                        color: t.color || DEFAULT_CARD_COLORS[i % DEFAULT_CARD_COLORS.length],
                        diaCierre: diaC,
                        diaVencimiento: diaV,
                        proximoCierre: t.proximoCierre || estimated.nextClosingDate,
                        proximoVencimiento: t.proximoVencimiento || estimated.nextDueDate,
                    };
                });
                setTarjetas(cards);
            }
        } catch (e) {
            console.error("Error fetching tarjetas:", e);
        } finally {
            setLoading(false);
        }
    };

    const notifyUpdate = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("tarjetas_updated"));
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nuevaTarjeta.trim()) return;

        setIsSubmitting(true);
        try {
            const diaC = parseInt(nuevoDiaCierre, 10) || 25;
            const diaV = parseInt(nuevoDiaVencimiento, 10) || 5;
            const estimated = getEstimatedCardDates(diaC, diaV);

            const res = await fetch("/api/tarjetas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: nuevaTarjeta.trim(),
                    color: nuevoColor,
                    diaCierre: diaC,
                    diaVencimiento: diaV,
                    proximoCierre: estimated.nextClosingDate,
                    proximoVencimiento: estimated.nextDueDate,
                })
            });

            if (res.ok) {
                setNuevaTarjeta("");
                setNuevoDiaCierre("25");
                setNuevoDiaVencimiento("5");
                setShowAddForm(false);
                // Rotate to next default color for next card
                const nextColorIdx = (DEFAULT_CARD_COLORS.indexOf(nuevoColor) + 1) % DEFAULT_CARD_COLORS.length;
                setNuevoColor(DEFAULT_CARD_COLORS[nextColorIdx >= 0 ? nextColorIdx : 0]);
                await fetchTarjetas();
                notifyUpdate();
            } else {
                alert("Error al guardar la tarjeta.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFieldChange = (cardId: string, field: keyof TarjetaInfo, value: any) => {
        setEditingCards(prev => {
            const current = prev[cardId] || {};
            const updated = { ...current, [field]: value };

            // If user modifies diaCierre, auto-estimate new nextClosingDate if not manually customized
            if (field === "diaCierre") {
                const diaC = parseInt(value, 10) || 20;
                const card = tarjetas.find(t => t.id === cardId);
                const diaV = updated.diaVencimiento ?? card?.diaVencimiento ?? 5;
                const estimated = getEstimatedCardDates(diaC, diaV);
                updated.proximoCierre = estimated.nextClosingDate;
                updated.proximoVencimiento = estimated.nextDueDate;
            }

            return { ...prev, [cardId]: updated };
        });
    };

    const handleDateFieldChange = (cardId: string, field: "proximoCierre" | "proximoVencimiento", rawVal: string, prevVal: string = "") => {
        const formatted = formatAutoDateInput(rawVal, prevVal);
        handleFieldChange(cardId, field, formatted);
    };

    const handleSaveRow = async (cardId: string) => {
        const card = tarjetas.find(t => t.id === cardId);
        const changes = editingCards[cardId];
        if (!changes || Object.keys(changes).length === 0) return;

        const payload = {
            nombre: card?.nombre,
            color: changes.color ?? card?.color,
            diaCierre: changes.diaCierre ?? card?.diaCierre,
            diaVencimiento: changes.diaVencimiento ?? card?.diaVencimiento,
            proximoCierre: changes.proximoCierre !== undefined ? changes.proximoCierre : card?.proximoCierre,
            proximoVencimiento: changes.proximoVencimiento !== undefined ? changes.proximoVencimiento : card?.proximoVencimiento,
        };

        setSavingRowId(cardId);
        try {
            const res = await fetch(`/api/tarjetas/${encodeURIComponent(cardId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                // Merge changes into local state
                setTarjetas(prev => prev.map(t => t.id === cardId ? { ...t, ...changes } : t));
                setEditingCards(prev => {
                    const copy = { ...prev };
                    delete copy[cardId];
                    return copy;
                });
                setSavedSuccessId(cardId);
                setTimeout(() => setSavedSuccessId(prev => prev === cardId ? null : prev), 2000);
                notifyUpdate();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || "Error al actualizar la tarjeta.");
            }
        } catch (e: any) {
            console.error(e);
            alert(e?.message || "No se pudo guardar los cambios.");
        } finally {
            setSavingRowId(null);
        }
    };

    const handleDelete = async (id: string, nombre: string) => {
        if (!window.confirm(`¿Seguro que querés eliminar la tarjeta "${nombre}"?\nNota: Eliminar la tarjeta no borra el historial previo de cuotas.`)) return;

        try {
            const res = await fetch(`/api/tarjetas/${id}`, { method: "DELETE" });
            if (res.ok) {
                await fetchTarjetas();
                notifyUpdate();
            } else {
                alert("Error al eliminar.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return <div className={styles.loadingArea}><p>Cargando tarjetas...</p></div>;
    }

    return (
        <section className={`glass-panel ${styles.card}`}>
            <div className={styles.headerWithTabs}>
                <div>
                    <h3 className="text-muted">Mis Tarjetas de Crédito</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                        Personalizá el color y administrá las fechas de cierre y vencimiento para proyectar vencimientos con precisión.
                    </p>
                </div>
                <button
                    type="button"
                    className={styles.toggleAddBtn}
                    onClick={() => setShowAddForm(prev => !prev)}
                >
                    {showAddForm ? "✕ Cancelar" : "+ Agregar Tarjeta"}
                </button>
            </div>

            {/* Collapsible Add Form */}
            {showAddForm && (
                <form onSubmit={handleAdd} style={{ marginBottom: "24px" }}>
                    <div className={styles.formGrid} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Nombre de la Tarjeta</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={nuevaTarjeta}
                                onChange={(e) => setNuevaTarjeta(e.target.value)}
                                placeholder="Ej. Visa Galicia"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Color Asignado</label>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className={styles.colorPickerWrapper}>
                                    <div className={styles.colorCircle} style={{ backgroundColor: nuevoColor }} />
                                    <input
                                        type="color"
                                        className={styles.colorInputHidden}
                                        value={nuevoColor}
                                        onChange={(e) => setNuevoColor(e.target.value)}
                                        title="Elegir color personalizado"
                                    />
                                </div>
                                <div className={styles.colorSwatches}>
                                    {DEFAULT_CARD_COLORS.slice(0, 6).map(c => (
                                        <button
                                            type="button"
                                            key={c}
                                            className={`${styles.swatchBtn} ${nuevoColor === c ? styles.swatchActive : ""}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setNuevoColor(c)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="card-dia-cierre">Día de Cierre</label>
                            <input
                                id="card-dia-cierre"
                                type="number"
                                min="1"
                                max="31"
                                className={styles.input}
                                value={nuevoDiaCierre}
                                onChange={(e) => setNuevoDiaCierre(e.target.value)}
                                placeholder="25"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="card-dia-vencimiento" title="Día del mes en que vence el pago de la tarjeta">
                                Día de Vencimiento
                            </label>
                            <input
                                id="card-dia-vencimiento"
                                type="number"
                                min="1"
                                max="31"
                                className={styles.input}
                                value={nuevoDiaVencimiento}
                                onChange={(e) => setNuevoDiaVencimiento(e.target.value)}
                                placeholder="5"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={isSubmitting} style={{ maxWidth: "220px", marginTop: "12px" }}>
                        {isSubmitting ? "Añadiendo..." : "Guardar Tarjeta"}
                    </button>
                </form>
            )}

            {/* Visual Cards Table */}
            {tarjetas.length === 0 ? (
                <p className="text-muted text-center" style={{ padding: "20px" }}>Aún no hay tarjetas registradas.</p>
            ) : (
                <div className={styles.tableResponsive}>
                    <table className={styles.cardsTable}>
                        <thead>
                            <tr>
                                <th>Tarjeta</th>
                                <th>Color</th>
                                <th title="Fecha exacta del próximo cierre informado por el banco">Próximo Cierre ℹ️</th>
                                <th title="Fecha exacta del próximo vencimiento para pagar el resumen">Próximo Vencimiento ℹ️</th>
                                <th style={{ textAlign: "right" }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tarjetas.map(t => {
                                const edits = editingCards[t.id] || {};
                                const currentColor = edits.color ?? t.color ?? DEFAULT_CARD_COLORS[0];
                                const currentProxC = edits.proximoCierre ?? t.proximoCierre ?? "";
                                const currentProxV = edits.proximoVencimiento ?? t.proximoVencimiento ?? "";
                                const isDirty = Object.keys(edits).length > 0;
                                const isSaving = savingRowId === t.id;
                                const isSaved = savedSuccessId === t.id;

                                return (
                                    <tr key={t.id}>
                                        {/* Card Name */}
                                        <td>
                                            <div className={styles.cardNameCell}>
                                                <div
                                                    style={{
                                                        width: "12px",
                                                        height: "12px",
                                                        borderRadius: "50%",
                                                        backgroundColor: currentColor,
                                                        flexShrink: 0
                                                    }}
                                                />
                                                <span>{t.nombre}</span>
                                            </div>
                                        </td>

                                        {/* Color Picker */}
                                        <td>
                                            <div className={styles.colorPickerWrapper}>
                                                <div
                                                    className={styles.colorCircle}
                                                    style={{ backgroundColor: currentColor }}
                                                    title="Click para cambiar color"
                                                />
                                                <input
                                                    type="color"
                                                    className={styles.colorInputHidden}
                                                    value={currentColor}
                                                    onChange={(e) => handleFieldChange(t.id, "color", e.target.value)}
                                                />
                                            </div>
                                        </td>

                                        {/* Próximo Cierre */}
                                        <td>
                                            <input
                                                type="text"
                                                className={styles.tableInput}
                                                style={{ maxWidth: "110px" }}
                                                value={currentProxC}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => handleDateFieldChange(t.id, "proximoCierre", e.target.value, currentProxC)}
                                                placeholder="DD/MM/YYYY"
                                                title="Próxima fecha exacta de cierre"
                                            />
                                        </td>

                                        {/* Próximo Vencimiento */}
                                        <td>
                                            <input
                                                type="text"
                                                className={styles.tableInput}
                                                style={{ maxWidth: "110px" }}
                                                value={currentProxV}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => handleDateFieldChange(t.id, "proximoVencimiento", e.target.value, currentProxV)}
                                                placeholder="DD/MM/YYYY"
                                                title="Próxima fecha exacta de vencimiento"
                                            />
                                        </td>

                                        {/* Actions */}
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                                                {onLiquidarCard && (
                                                    <button
                                                        type="button"
                                                        className={styles.liquidarRowBtn}
                                                        onClick={() => onLiquidarCard(t)}
                                                        title={`Liquidar resumen de ${t.nombre}`}
                                                    >
                                                        💳 Liquidar
                                                    </button>
                                                )}

                                                {isDirty ? (
                                                    <button
                                                        className={styles.saveRowBtn}
                                                        onClick={() => handleSaveRow(t.id)}
                                                        disabled={isSaving}
                                                    >
                                                        {isSaving ? "..." : "Guardar"}
                                                    </button>
                                                ) : isSaved ? (
                                                    <span style={{ fontSize: "0.8rem", color: "var(--success-color, #10b981)", fontWeight: 600 }}>
                                                        ✓ Guardado
                                                    </span>
                                                ) : null}

                                                <button
                                                    onClick={() => handleDelete(t.id, t.nombre)}
                                                    className={styles.tableActionBtn}
                                                    style={{ color: "var(--danger-color)" }}
                                                    title="Eliminar tarjeta"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}


"use client";

import { useState } from "react";
import styles from "./ValidationModal.module.css";
import { CATEGORIES, ExtractedItem } from "@/lib/constants";

interface ValidationModalProps {
    items: ExtractedItem[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function ValidationModal({ items, onClose, onSuccess }: ValidationModalProps) {
    const [editableItems, setEditableItems] = useState(
        items.map((item) => ({ ...item, isConfirmed: false }))
    );
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const allConfirmed = editableItems.every((i) => i.isConfirmed);
    const someConfirmed = editableItems.some((i) => i.isConfirmed);

    const handleToggleConfirm = (index: number) => {
        setEditableItems((prev) =>
            prev.map((item, i) =>
                i === index ? { ...item, isConfirmed: !item.isConfirmed } : item
            )
        );
    };

    const handleToggleAll = () => {
        const atLeastOneUnconfirmed = editableItems.some((i) => !i.isConfirmed);
        setEditableItems((prev) =>
            prev.map((item) => ({ ...item, isConfirmed: atLeastOneUnconfirmed }))
        );
    };

    const handleFieldChange = (index: number, field: keyof ExtractedItem, value: string) => {
        setEditableItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        );
    };

    // Defensa: Parseo para formato de Gemini/input type=number
    const parseAmount = (raw: string | number) => {
        if (typeof raw === "number") return raw;
        const cleanStr = String(raw).replace(/[^\d.,-]/g, '');

        // Si tiene una coma, es indudable que viene en notación española (ej: 15.000,50 o 15000,50)
        if (cleanStr.includes(',')) {
            const standardized = cleanStr.replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(standardized);
            return isNaN(parsed) ? 0 : parsed;
        }

        // Si no hay comas, el punto (si lo hay) probablemente sea un separador decimal nativo ("15000.50"),
        // lo cual es lo que genera el <input type="number"> internamente.
        // (Alucinación edge case: Si hay múltiples puntos "1.500.000", los removemos)
        if ((cleanStr.match(/\./g) || []).length > 1) {
            return parseFloat(cleanStr.replace(/\./g, '')) || 0;
        }

        const parsed = parseFloat(cleanStr);
        return isNaN(parsed) ? 0 : parsed;
    };

    const calculateGlobalTotal = () => {
        return editableItems.reduce((acc, curr) => acc + parseAmount(curr.Monto), 0).toFixed(2);
    };

    const calculateConfirmedTotal = () => {
        return editableItems.filter(i => i.isConfirmed).reduce((acc, curr) => acc + parseAmount(curr.Monto), 0).toFixed(2);
    };

    const handleSave = async () => {
        if (!someConfirmed) return;
        setIsSaving(true);
        try {
            // Formato para enviar a Google Sheets: [Fecha, Tipo, Categoría, Subcategoría, Monto, Comentario]
            const rowsToInsert = editableItems.filter(i => i.isConfirmed).map((item) => [
                item.Fecha,
                item.Tipo,
                item.Categoría,
                item.Subcategoría,
                parseAmount(item.Monto),
                item.Comentario,
            ]);

            const res = await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: rowsToInsert }),
            });

            if (!res.ok) throw new Error("Fallo al guardar en Sheets");

            onSuccess();
            window.dispatchEvent(new Event("transaction_added"));
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : "Hubo un error al guardar los datos.");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Revisar y Confirmar</h2>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.scrollArea}>
                    {editableItems.length === 0 ? (
                        <p className={styles.emptyMsg}>No se detectaron ítems válidos.</p>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Tipo</th>
                                    <th>Categoría</th>
                                    <th>Subcategoría</th>
                                    <th>Comentario</th>
                                    <th>Monto</th>
                                    <th style={{ textAlign: "center" }}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={allConfirmed && editableItems.length > 0}
                                            onChange={handleToggleAll}
                                            title="Seleccionar todos"
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {editableItems.map((item, index) => {
                                    const typeCategories = CATEGORIES[item.Tipo as "Egreso" | "Ingreso"];

                                    // Defensa: Si la categoría no existe en nuestro molde maestro, se evita el crash
                                    const subCats = (typeCategories && typeCategories[item.Categoría as keyof typeof typeCategories])
                                        ? typeCategories[item.Categoría as keyof typeof typeCategories]
                                        : [];

                                    return (
                                        <tr key={index} className={item.isConfirmed ? styles.rowConfirmed : ""}>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={styles.inputStyle}
                                                    value={item.Fecha}
                                                    onChange={(e) => handleFieldChange(index, "Fecha", e.target.value)}
                                                    disabled={item.isConfirmed}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className={styles.selectStyle}
                                                    value={item.Tipo}
                                                    onChange={(e) => {
                                                        handleFieldChange(index, "Tipo", e.target.value);
                                                        handleFieldChange(index, "Categoría", ""); // reset child
                                                        handleFieldChange(index, "Subcategoría", ""); // reset child
                                                    }}
                                                    disabled={item.isConfirmed}
                                                >
                                                    <option value="">-</option>
                                                    <option value="Egreso">Egreso</option>
                                                    <option value="Ingreso">Ingreso</option>
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    className={styles.selectStyle}
                                                    value={item.Categoría}
                                                    onChange={(e) => {
                                                        handleFieldChange(index, "Categoría", e.target.value);
                                                        handleFieldChange(index, "Subcategoría", ""); // reset child
                                                    }}
                                                    disabled={item.isConfirmed}
                                                >
                                                    <option value="">-</option>
                                                    {item.Tipo && Object.keys(CATEGORIES[item.Tipo as "Egreso" | "Ingreso"] || {}).map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    className={styles.selectStyle}
                                                    value={item.Subcategoría}
                                                    onChange={(e) => handleFieldChange(index, "Subcategoría", e.target.value)}
                                                    disabled={item.isConfirmed}
                                                >
                                                    <option value="">-</option>
                                                    {subCats.map((sc: string) => (
                                                        <option key={sc} value={sc}>{sc}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={styles.inputStyle}
                                                    value={item.Comentario}
                                                    onChange={(e) => handleFieldChange(index, "Comentario", e.target.value)}
                                                    disabled={item.isConfirmed}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className={`${styles.inputStyle} ${styles.inputNum}`}
                                                    value={item.Monto}
                                                    min="0"
                                                    step="0.01"
                                                    onChange={(e) => handleFieldChange(index, "Monto", e.target.value)}
                                                    disabled={item.isConfirmed}
                                                />
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                                <input
                                                    type="checkbox"
                                                    className={styles.checkbox}
                                                    checked={item.isConfirmed}
                                                    onChange={() => handleToggleConfirm(index)}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className={styles.footer}>
                    <div className={styles.totalsGrid}>
                        <span className={styles.totalsLabel} style={{ color: 'var(--text-muted)' }}>Total:</span>
                        <span className={styles.totalsValue} style={{ color: 'var(--text-muted)' }}>${calculateGlobalTotal()}</span>

                        <span className={styles.totalsLabel}>Total Confirmado:</span>
                        <span className={styles.totalsValue} style={{ color: 'var(--success-color)' }}>${calculateConfirmedTotal()}</span>
                    </div>
                    <div className={styles.actions}>
                        <button
                            className={styles.cancelBtn}
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            Cancelar
                        </button>
                        <button
                            className={someConfirmed ? styles.saveBtn : styles.saveBtnDisabled}
                            disabled={!someConfirmed || isSaving || editableItems.length === 0}
                            onClick={handleSave}
                        >
                            {isSaving ? "Guardando..." : "Confirmar Seleccionados"}
                        </button>
                    </div>
                </div>
            </div>

            {errorMsg && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'var(--bg-color)', padding: 24, borderRadius: 16,
                        width: '90%', maxWidth: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        border: '1px solid var(--glass-border)'
                    }}>
                        <h3 style={{ marginBottom: 12, fontSize: '1.2rem', color: 'var(--text-main)' }}>Vesta dice</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{errorMsg}</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setErrorMsg(null)}
                                style={{
                                    background: 'transparent', color: 'var(--accent-color)',
                                    border: '1px solid var(--accent-color)', padding: '8px 24px',
                                    borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

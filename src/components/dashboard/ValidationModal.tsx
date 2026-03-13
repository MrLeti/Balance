"use client";

import { useState, useEffect } from "react";
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

    // Instalment mode state
    const [isInstalmentMode, setIsInstalmentMode] = useState(false);
    const [instalmentConcept, setInstalmentConcept] = useState("");
    const [instalmentsCount, setInstalmentsCount] = useState("1");
    const [startMonth, setStartMonth] = useState("");
    const [tarjetas, setTarjetas] = useState<{ id: string, nombre: string }[]>([]);
    const [selectedTarjeta, setSelectedTarjeta] = useState("");

    // Initialize start month
    useEffect(() => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = date.getFullYear();
        setStartMonth(`${mm}/${yyyy}`);

        fetch("/api/tarjetas").then(r => r.json()).then(d => {
            if (d.data) {
                setTarjetas(d.data);
            }
        }).catch(e => console.error(e));
    }, []);

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

    const handleEnableInstalmentMode = () => {
        const confirmed = editableItems.filter(i => i.isConfirmed);
        if (confirmed.length === 0) return;

        let initialConcept = "Varias compras";
        if (confirmed.length === 1) {
            initialConcept = confirmed[0].Comentario || confirmed[0].Subcategoría || "Compra";
        }
        setInstalmentConcept(initialConcept);
        setIsInstalmentMode(true);
    };

    const handleSave = async (withInstalment = false) => {
        if (!someConfirmed) return;
        setIsSaving(true);
        try {
            let cuotaId = "";

            // 1. Si eligió pago en cuotas, creamos PRIMERO la cuota para obtener su ID
            if (withInstalment) {
                const totalAmountStr = calculateConfirmedTotal();
                const totalAmount = parseFloat(totalAmountStr);

                const today = new Date();
                const dd = today.getDate().toString().padStart(2, '0');
                const mm = (today.getMonth() + 1).toString().padStart(2, '0');
                const yyyy = today.getFullYear();

                const cuotaRes = await fetch("/api/cuotas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        date: `${dd}/${mm}/${yyyy}`,
                        concept: instalmentConcept,
                        totalAmount: totalAmount,
                        instalmentsCount: parseInt(instalmentsCount),
                        startMonth,
                        tarjeta: selectedTarjeta
                    })
                });

                if (!cuotaRes.ok) throw new Error("Fallo al crear la estructura de Cuotas.");

                const cuotaData = await cuotaRes.json();
                cuotaId = cuotaData.id;
            }

            // 2. Formato para enviar a Google Sheets: [Fecha, Tipo, Categoría, Subcategoría, Monto, Comentario, ID Cuota]
            const rowsToInsert = editableItems.filter(i => i.isConfirmed).map((item) => [
                item.Fecha,
                item.Tipo,
                item.Categoría,
                item.Subcategoría,
                parseAmount(item.Monto),
                item.Comentario,
                cuotaId // Se agregará en la columna H (7mo elemento de los datos devueltos listos para sheets, 8vo contando ID original en el backend)
            ]);

            const res = await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: rowsToInsert }),
            });

            if (!res.ok) throw new Error("Fallo al guardar en Sheets (Transacciones)");

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
                    {isInstalmentMode ? (
                        <div className={styles.instalmentSetup}>
                            <h3 style={{ marginBottom: 16 }}>Configurar Cuotas</h3>
                            <p style={{ marginBottom: 24, color: 'var(--text-muted)' }}>
                                El monto total <strong>${calculateConfirmedTotal()}</strong> se registrará hoy como devengado, y se proyectará en pagos futuros en tu dashboard de Cuotas.
                            </p>

                            <div className={styles.formGrid}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Concepto</label>
                                    <input
                                        type="text"
                                        className={styles.inputStyle}
                                        value={instalmentConcept}
                                        onChange={e => setInstalmentConcept(e.target.value)}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Cantidad de Cuotas</label>
                                    <input
                                        type="number"
                                        min="1" max="72"
                                        className={styles.inputStyle}
                                        value={instalmentsCount}
                                        onChange={e => setInstalmentsCount(e.target.value)}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Tarjeta (Opcional)</label>
                                    <select
                                        className={styles.inputStyle}
                                        value={selectedTarjeta}
                                        onChange={e => setSelectedTarjeta(e.target.value)}
                                    >
                                        <option value="">- Ninguna / General -</option>
                                        {tarjetas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                                    </select>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Mes de Inicio (MM/YYYY)</label>
                                    <input
                                        type="text"
                                        className={styles.inputStyle}
                                        value={startMonth}
                                        onChange={e => setStartMonth(e.target.value)}
                                        pattern="(0[1-9]|1[0-2])\/20[0-9]{2}"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : editableItems.length === 0 ? (
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
                        {isInstalmentMode ? (
                            <>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => setIsInstalmentMode(false)}
                                    disabled={isSaving}
                                >
                                    Volver
                                </button>
                                <button
                                    className={styles.saveBtn}
                                    disabled={isSaving || !instalmentConcept || !instalmentsCount || !startMonth}
                                    onClick={() => handleSave(true)}
                                >
                                    {isSaving ? "Guardando..." : "Confirmar Compra + Cuotas"}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={onClose}
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className={someConfirmed ? styles.instalmentBtn : styles.saveBtnDisabled}
                                    disabled={!someConfirmed || isSaving || editableItems.length === 0}
                                    onClick={handleEnableInstalmentMode}
                                    style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
                                >
                                    Pagar en Cuotas
                                </button>
                                <button
                                    className={someConfirmed ? styles.saveBtn : styles.saveBtnDisabled}
                                    disabled={!someConfirmed || isSaving || editableItems.length === 0}
                                    onClick={() => handleSave(false)}
                                >
                                    {isSaving ? "Guardando..." : "Confirmar"}
                                </button>
                            </>
                        )}
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

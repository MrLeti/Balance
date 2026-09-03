"use client";

import React, { useState, useRef } from "react";
import styles from "./ImportPortfolioModal.module.css";
import * as XLSX from "xlsx";

interface ImportPortfolioModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface ParsedRow {
    id?: string;
    date: string;
    operation: string;
    asset: string;
    assetType?: string;
    quantity: number;
    unitPrice: number;
    commission: number;
    cartera: string;
    comment: string;
    currency: string;
    fxRate?: number;
}

export default function ImportPortfolioModal({ onClose, onSuccess }: ImportPortfolioModalProps) {
    const [fileName, setFileName] = useState<string | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [importMode, setImportMode] = useState<"replace" | "append">("replace");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseValueToNumber = (val: any): number => {
        if (val === null || val === undefined || val === "") return 0;
        if (typeof val === "number") return isNaN(val) ? 0 : val;
        let str = String(val).trim().replace(/[$€£\s]/g, "");

        if (str.includes(",") && str.includes(".")) {
            if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
                // Formato latino: 20.200,00 o 95.282.854,24
                str = str.replace(/\./g, "").replace(",", ".");
            } else {
                // Formato anglosajón: 1,234.56
                str = str.replace(/,/g, "");
            }
        } else if (str.includes(",")) {
            // Coma sola como decimal: 4032,93 o 0,00101547 o 13146,66
            str = str.replace(",", ".");
        } else if (str.includes(".")) {
            const parts = str.split(".");
            if (parts.length > 2) {
                // Múltiples puntos: separador de miles
                str = str.replace(/\./g, "");
            } else if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1) {
                // Un punto con 3 dígitos (ej: 20.200 o 49.080)
                str = str.replace(".", "");
            }
        }

        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    };

    const parseDateValue = (val: any): string => {
        if (!val) return new Date().toLocaleDateString("es-AR");
        if (typeof val === "number" && val > 30000 && val < 80000) {
            // Fecha serial de Excel
            const date = new Date((val - 25569) * 86400 * 1000);
            const d = String(date.getUTCDate()).padStart(2, "0");
            const m = String(date.getUTCMonth() + 1).padStart(2, "0");
            const y = date.getUTCFullYear();
            return `${d}/${m}/${y}`;
        }
        const s = String(val).trim();
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
            const parts = s.split("/");
            return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
        }
        if (s.includes("-")) {
            const parts = s.split("-");
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
                } else {
                    return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
                }
            }
        }
        return s;
    };

    const handleFile = async (file: File) => {
        setErrorMsg(null);
        setFileName(file.name);

        try {
            let rawData: any[] = [];

            if (file.name.toLowerCase().endsWith(".csv")) {
                // Lectura como texto UTF-8 nativo para preservar caracteres como acentos (ó en Jubilación)
                const text = await file.text();
                const wb = XLSX.read(text, { type: "string", raw: true });
                const sheetName = wb.SheetNames[0];
                rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { raw: true, defval: "" });
            } else {
                // Planillas Excel binarias (.xlsx, .xls)
                const buffer = await file.arrayBuffer();
                const wb = XLSX.read(buffer, { type: "array", raw: true });
                const sheetName = wb.SheetNames[0];
                rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { raw: true, defval: "" });
            }

            if (!rawData || rawData.length === 0) {
                throw new Error("El archivo seleccionado está vacío o no contiene filas con datos.");
            }

            // Normalización flexible de columnas (insensible a mayúsculas, tildes y espacios)
            const mapped: ParsedRow[] = rawData.map((row) => {
                const keys = Object.keys(row);
                const findKey = (pattern: RegExp) => keys.find((k) => pattern.test(k.trim()));

                const idKey = findKey(/^(id|id_inversion)$/i);
                const dateKey = findKey(/^(fecha|date|dia)$/i);
                const opKey = findKey(/^(operaci[oó]n|type|tipo|operacion)$/i);
                const assetKey = findKey(/^(activo|ticker|symbol|s[ií]mbolo|asset)$/i);
                const assetTypeKey = findKey(/^(tipo\s*activo|asset\s*type|tipo_activo)$/i);
                const qtyKey = findKey(/^(cantidad|shares|nominales|quantity|cant)$/i);
                const priceKey = findKey(/^(precio\s*unitario|precio|price|unit\s*price|preciounitario)$/i);
                const commKey = findKey(/^(comisi[oó]n|comision|fee|fees|commission)$/i);
                const carteraKey = findKey(/^(cartera|portfolio|cuenta|account)$/i);
                const commentKey = findKey(/^(comentario|comment|notas|notes)$/i);
                const currKey = findKey(/^(moneda|currency)$/i);
                const fxKey = findKey(/^(tipo\s*de\s*cambio|fx_?rate|mep|cotizaci[oó]n|cotizacion|dolar)$/i);

                const rawAsset = assetKey ? String(row[assetKey]).trim().toUpperCase() : "";
                const rawOp = opKey ? String(row[opKey]).trim() : "Compra";

                return {
                    id: idKey ? String(row[idKey]).trim() : undefined,
                    date: dateKey ? parseDateValue(row[dateKey]) : "",
                    operation: rawOp.toLowerCase().includes("vent") ? "Venta" : rawOp.toLowerCase().includes("split") ? "Split" : "Compra",
                    asset: rawAsset,
                    assetType: assetTypeKey ? String(row[assetTypeKey]).trim() : undefined,
                    quantity: qtyKey ? parseValueToNumber(row[qtyKey]) : 0,
                    unitPrice: priceKey ? parseValueToNumber(row[priceKey]) : 0,
                    commission: commKey ? parseValueToNumber(row[commKey]) : 0,
                    cartera: carteraKey && String(row[carteraKey]).trim() !== "" ? String(row[carteraKey]).trim() : "Inversión General",
                    comment: commentKey ? String(row[commentKey]).trim() : "",
                    currency: currKey && String(row[currKey]).trim().toUpperCase() === "USD" ? "USD" : "ARS",
                    fxRate: fxKey ? parseValueToNumber(row[fxKey]) : undefined,
                };
            }).filter((r) => r.asset !== "" && r.quantity > 0);

            if (mapped.length === 0) {
                throw new Error("No se detectaron transacciones válidas. Verifica que el archivo contenga las columnas de Activo y Cantidad.");
            }

            setParsedRows(mapped);
        } catch (err: any) {
            console.error("Error procesando archivo de inversiones:", err);
            setErrorMsg(err.message || "Error al procesar el archivo.");
            setParsedRows([]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleConfirmImport = async () => {
        if (parsedRows.length === 0) return;
        setIsLoading(true);
        setErrorMsg(null);

        try {
            const res = await fetch("/api/investments/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: parsedRows,
                    mode: importMode,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Fallo en la importación de cartera.");
            }

            window.dispatchEvent(new Event("transaction_added"));
            onSuccess();
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || "No se pudo completar la importación.");
        } finally {
            setIsLoading(false);
        }
    };

    const uniqueTickers = [...new Set(parsedRows.map((r) => r.asset))];
    const totalCommissions = parsedRows.reduce((acc, r) => acc + r.commission, 0);
    const totalOperadoYComisiones = parsedRows.reduce((acc, r) => {
        const cost = r.quantity * r.unitPrice + r.commission;
        return acc + cost;
    }, 0);

    const fmtMoney = (n: number) => {
        return `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3 className={styles.title}>📥 Importar Cartera de Inversiones</h3>
                    <button type="button" onClick={onClose} className={styles.closeBtn}>
                        ✕
                    </button>
                </div>

                <div className={styles.body}>
                    {errorMsg && <div className={styles.alertError}>⚠️ {errorMsg}</div>}

                    {/* Zona de subida */}
                    <div
                        className={styles.dropZone}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".csv,.xlsx,.xls"
                            style={{ display: "none" }}
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFile(f);
                            }}
                        />
                        <div className={styles.dropIcon}>📊</div>
                        <p className={styles.dropText}>
                            {fileName ? `Archivo: ${fileName}` : "Haz clic para seleccionar o arrastra tu archivo aquí"}
                        </p>
                        <p className={styles.dropSubtext}>
                            Compatible con archivos <strong>.CSV</strong> (Google Sheets / Brokers) y planillas <strong>.XLSX</strong> de Excel
                        </p>
                    </div>

                    {/* Resumen del archivo analizado */}
                    {parsedRows.length > 0 && (
                        <>
                            <div className={styles.summaryBox}>
                                <h4 className={styles.summaryTitle}>Resumen del Archivo Detectado</h4>
                                <div className={styles.summaryGrid}>
                                    <div className={styles.summaryItem}>
                                        <span className={styles.summaryLabel}>Total Operaciones</span>
                                        <span className={styles.summaryValue}>{parsedRows.length}</span>
                                    </div>
                                    <div className={styles.summaryItem}>
                                        <span className={styles.summaryLabel}>Activos Distintos</span>
                                        <span className={styles.summaryValue}>{uniqueTickers.length}</span>
                                    </div>
                                    <div className={styles.summaryItem}>
                                        <span className={styles.summaryLabel}>Total Comisiones</span>
                                        <span className={styles.summaryValue}>
                                            {fmtMoney(totalCommissions)}
                                        </span>
                                    </div>
                                    <div className={styles.summaryItem}>
                                        <span className={styles.summaryLabel}>Total + Comisiones</span>
                                        <span className={styles.summaryValue} style={{ color: "var(--text-main)" }}>
                                            {fmtMoney(totalOperadoYComisiones)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Selector de Modo */}
                            <div className={styles.modeSelection}>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="importMode"
                                        value="replace"
                                        checked={importMode === "replace"}
                                        onChange={() => setImportMode("replace")}
                                    />
                                    <div>
                                        <div className={styles.radioTitle}>
                                            🔄 Reemplazar cartera completa (Recomendado)
                                        </div>
                                        <p className={styles.radioDesc}>
                                            Limpia las inversiones anteriores y carga las {parsedRows.length} operaciones del archivo, actualizando también los egresos de inversión correspondientes en el Balance General.
                                        </p>
                                    </div>
                                </label>

                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="importMode"
                                        value="append"
                                        checked={importMode === "append"}
                                        onChange={() => setImportMode("append")}
                                    />
                                    <div>
                                        <div className={styles.radioTitle}>
                                            ➕ Agregar a las existentes
                                        </div>
                                        <p className={styles.radioDesc}>
                                            Conserva tus operaciones actuales y añade solo las nuevas filas del archivo a Inversiones y al Balance General.
                                        </p>
                                    </div>
                                </label>
                            </div>

                            {/* Tabla de Vista Previa */}
                            <div>
                                <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 8px 0" }}>
                                    Vista previa (Primeras 5 operaciones detectadas):
                                </h4>
                                <div className={styles.tableWrapper}>
                                    <table className={styles.previewTable}>
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Tipo</th>
                                                <th>Activo</th>
                                                <th>Cant.</th>
                                                <th>Precio</th>
                                                <th>Comisión</th>
                                                <th>Cartera</th>
                                                <th>Moneda</th>
                                                <th>Dólar MEP</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedRows.slice(0, 5).map((r, i) => (
                                                <tr key={i}>
                                                    <td>{r.date}</td>
                                                    <td>{r.operation}</td>
                                                    <td><strong>{r.asset}</strong></td>
                                                    <td>{r.quantity > 0.01 ? r.quantity.toLocaleString("es-AR") : r.quantity}</td>
                                                    <td>{fmtMoney(r.unitPrice)}</td>
                                                    <td>{fmtMoney(r.commission)}</td>
                                                    <td>{r.cartera}</td>
                                                    <td>{r.currency}</td>
                                                    <td>{r.fxRate ? fmtMoney(r.fxRate) : <span style={{ color: "var(--accent-color, #3b82f6)", fontStyle: "italic" }}>⚡ Auto MEP</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.footer}>
                    <button type="button" onClick={onClose} disabled={isLoading} className={styles.cancelBtn}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmImport}
                        disabled={isLoading || parsedRows.length === 0}
                        className={styles.importBtn}
                    >
                        {isLoading ? "Importando..." : `Confirmar e Importar (${parsedRows.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
}

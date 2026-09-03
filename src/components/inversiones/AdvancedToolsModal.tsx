"use client";

import React, { useEffect, useState } from "react";
import styles from "./AdvancedToolsModal.module.css";
import { InvestmentTransaction } from "@/lib/utils/investments";

interface AdvancedToolsModalProps {
    onClose: () => void;
    onOpenImport: () => void;
    transactions: InvestmentTransaction[];
    onCleanSuccess?: () => void;
}

export default function AdvancedToolsModal({
    onClose,
    onOpenImport,
    transactions,
    onCleanSuccess,
}: AdvancedToolsModalProps) {
    const [isCleaning, setIsCleaning] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    // 1. Limpiar Inversiones y Balance General
    const handleClean = async () => {
        const confirmed = window.confirm(
            "⚠️ ¿Estás seguro de que deseas eliminar todas las operaciones del portafolio de inversiones y todos los movimientos de inversión del Balance General?\n\nEsta acción vaciará por completo las inversiones para permitir una carga limpia desde cero."
        );
        if (!confirmed) return;

        setIsCleaning(true);
        setStatusMsg(null);
        try {
            const res = await fetch("/api/admin/clean-investment-transactions", { method: "POST" });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Error al limpiar las inversiones");
            }
            setStatusMsg({ type: "success", text: data.message || "¡Limpieza completada con éxito!" });
            window.dispatchEvent(new Event("transaction_added"));
            if (onCleanSuccess) onCleanSuccess();
        } catch (err: any) {
            setStatusMsg({ type: "error", text: `⚠️ ${err.message || "Error al limpiar"}` });
        } finally {
            setIsCleaning(false);
        }
    };

    // 2. Descargar CSV
    const handleExportCSV = () => {
        if (!transactions || transactions.length === 0) {
            setStatusMsg({ type: "error", text: "No hay transacciones registradas para exportar." });
            return;
        }

        const headers = [
            "ID",
            "Fecha",
            "Tipo",
            "Activo",
            "TipoActivo",
            "Cantidad",
            "PrecioUnitario",
            "Comision",
            "Cartera",
            "Comentario",
            "Moneda",
            "Tipo de Cambio",
        ];

        const escapeCSV = (val: unknown) => {
            if (val === null || val === undefined) return '""';
            const s = String(val).replace(/"/g, '""');
            return `"${s}"`;
        };

        const rows = transactions.map((t) => {
            return [
                escapeCSV(t.id),
                escapeCSV(t.date),
                escapeCSV(t.type),
                escapeCSV(t.asset),
                escapeCSV(t.assetType),
                escapeCSV(t.quantity),
                escapeCSV(t.unitPrice),
                escapeCSV(t.commission || 0),
                escapeCSV(t.cartera || "Inversión General"),
                escapeCSV(t.comment || ""),
                escapeCSV(t.currency || "ARS"),
                escapeCSV(t.fxRate || ""),
            ].join(",");
        });

        // BOM UTF-8 para apertura correcta de caracteres en Excel y Google Sheets
        const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Balance_Inversiones_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setStatusMsg({ type: "success", text: "¡Archivo CSV descargado correctamente!" });
    };

    return (
        <div
            className={styles.overlay}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
            role="dialog"
            aria-modal="true"
        >
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.header}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.3rem" }}>⚙️</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>
                                Herramientas de Inversión
                            </h3>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                Mantenimiento, respaldo y carga de operaciones
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label="Cerrar modal"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className={styles.body}>
                    {statusMsg && (
                        <div
                            className={styles.banner}
                            style={{
                                background: statusMsg.type === "error" ? "rgba(239, 68, 68, 0.15)" : "rgba(139, 92, 246, 0.15)",
                                borderColor: statusMsg.type === "error" ? "rgba(239, 68, 68, 0.4)" : "rgba(139, 92, 246, 0.4)",
                                color: statusMsg.type === "error" ? "#fca5a5" : "#ffffff",
                            }}
                        >
                            <span>{statusMsg.text}</span>
                            <button
                                type="button"
                                onClick={() => setStatusMsg(null)}
                                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Tool 1: Importar Cartera */}
                    <div className={styles.toolCard}>
                        <div className={styles.toolInfo}>
                            <span className={styles.toolTitle}>📥 Importar Cartera (CSV / Excel)</span>
                            <span className={styles.toolDesc}>
                                Carga tus operaciones desde un archivo .CSV (Google Sheets / Brokers) o Excel (.xlsx). Detecta automáticamente activos, comisiones, tipos de cambio MEP y actualiza tu Balance General.
                            </span>
                        </div>
                        <button
                            type="button"
                            className={styles.importBtn}
                            onClick={() => {
                                onClose();
                                onOpenImport();
                            }}
                        >
                            Importar
                        </button>
                    </div>

                    {/* Tool 2: Exportar CSV de Operaciones */}
                    <div className={styles.toolCard}>
                        <div className={styles.toolInfo}>
                            <span className={styles.toolTitle}>📤 Exportar a CSV</span>
                            <span className={styles.toolDesc}>
                                Descarga una copia completa de todas tus operaciones con sus comisiones, precios unitarios, carteras y cotizaciones MEP históricas, lista para respaldar o abrir en Excel/Sheets.
                            </span>
                        </div>
                        <button
                            type="button"
                            className={styles.csvBtn}
                            onClick={handleExportCSV}
                        >
                            Descargar
                        </button>
                    </div>

                    {/* Tool 3: Limpiar Inversiones y Balance */}
                    <div className={styles.toolCard}>
                        <div className={styles.toolInfo}>
                            <span className={styles.toolTitle} style={{ color: "#fca5a5" }}>
                                🗑️ Limpiar Inversiones y Balance
                            </span>
                            <span className={styles.toolDesc}>
                                Elimina de forma permanente todas las operaciones del portafolio de inversiones y sus movimientos asociados en el Balance General. Útil para reiniciar o hacer una importación limpia desde cero.
                            </span>
                        </div>
                        <button
                            type="button"
                            className={styles.cleanBtn}
                            onClick={handleClean}
                            disabled={isCleaning}
                        >
                            {isCleaning ? "⏳ Limpiando..." : "Limpiar Todo"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

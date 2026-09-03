"use client";

import React, { useState, useRef } from "react";
import styles from "./BackupManager.module.css";
import { BackupValidationResult } from "@/lib/backup/format";

declare global {
    interface Window {
        google?: any;
    }
}

export default function BackupManager() {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [alert, setAlert] = useState<{ type: "success" | "error"; message: string; link?: string } | null>(null);

    // Restore state
    const [pendingPayload, setPendingPayload] = useState<any | null>(null);
    const [previewSummary, setPreviewSummary] = useState<BackupValidationResult["summary"] | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helper: Obtain Google Access Token via Google Identity Services (GIS) on demand
    const requestGoogleDriveToken = async (): Promise<string> => {
        // 1. Fetch client ID
        const res = await fetch("/api/backup/config");
        const { clientId } = await res.json();
        if (!clientId) {
            throw new Error("No se encontró GOOGLE_CLIENT_ID configurado en el servidor.");
        }

        // 2. Ensure GIS script is loaded
        if (!window.google?.accounts?.oauth2) {
            await new Promise<void>((resolve, reject) => {
                const existingScript = document.getElementById("google-gis-script");
                if (existingScript) {
                    existingScript.addEventListener("load", () => resolve());
                    existingScript.addEventListener("error", () => reject(new Error("Error cargando Google SDK")));
                    return;
                }
                const script = document.createElement("script");
                script.id = "google-gis-script";
                script.src = "https://accounts.google.com/gsi/client";
                script.async = true;
                script.defer = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("No se pudo cargar la biblioteca de Google."));
                document.body.appendChild(script);
            });
        }

        // 3. Request OAuth Token with drive.file scope (least privileged!)
        return new Promise<string>((resolve, reject) => {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: "https://www.googleapis.com/auth/drive.file",
                callback: (tokenResponse: any) => {
                    if (tokenResponse.error) {
                        reject(new Error(tokenResponse.error_description || tokenResponse.error));
                    } else if (tokenResponse.access_token) {
                        resolve(tokenResponse.access_token);
                    } else {
                        reject(new Error("No se obtuvo token de acceso."));
                    }
                },
            });
            tokenClient.requestAccessToken({ prompt: "" });
        });
    };

    // 1. Descargar copia local .json
    const handleDownloadLocalJson = () => {
        setAlert(null);
        window.location.href = "/api/backup/export-json?download=true";
    };

    // 2. Guardar copia .json en Google Drive
    const handleBackupToGoogleDrive = async () => {
        setLoadingAction("drive-json");
        setAlert(null);
        try {
            const token = await requestGoogleDriveToken();
            const res = await fetch("/api/backup/drive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "upload-json",
                    accessToken: token,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al subir a Google Drive");

            setAlert({
                type: "success",
                message: `✅ Copia de seguridad guardada en la carpeta 'Vesta Backups' de tu Google Drive.`,
                link: data.fileUrl,
            });
        } catch (err: any) {
            setAlert({
                type: "error",
                message: err.message || "No se pudo completar el guardado en Google Drive.",
            });
        } finally {
            setLoadingAction(null);
        }
    };

    // 3. Exportar a Google Sheets
    const handleExportToGoogleSheets = async () => {
        setLoadingAction("sheets");
        setAlert(null);
        try {
            const token = await requestGoogleDriveToken();
            const res = await fetch("/api/backup/drive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "export-sheets",
                    accessToken: token,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al crear la planilla de Google Sheets");

            setAlert({
                type: "success",
                message: `📊 ¡Planilla generada con éxito en tu Google Drive!`,
                link: data.spreadsheetUrl,
            });
        } catch (err: any) {
            setAlert({
                type: "error",
                message: err.message || "No se pudo exportar a Google Sheets.",
            });
        } finally {
            setLoadingAction(null);
        }
    };

    // 4. Descargar Excel (.xlsx)
    const handleDownloadExcel = () => {
        setAlert(null);
        window.location.href = "/api/backup/export-xlsx";
    };

    // 5. Manejar archivo seleccionado para restaurar
    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAlert(null);
        setLoadingAction("reading-file");

        try {
            const text = await file.text();
            const payload = JSON.parse(text);

            // Validate and request preview from server
            const res = await fetch("/api/backup/restore-json?preview=true", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "El archivo de respaldo no es válido.");

            setPendingPayload(payload);
            setPreviewSummary(result.summary);
        } catch (err: any) {
            setAlert({
                type: "error",
                message: err.message || "Error al leer el archivo de copia de seguridad.",
            });
        } finally {
            setLoadingAction(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Confirmar restauración
    const handleConfirmRestore = async () => {
        if (!pendingPayload) return;
        setIsRestoring(true);

        try {
            const res = await fetch("/api/backup/restore-json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pendingPayload),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al restaurar la copia.");

            setPendingPayload(null);
            setPreviewSummary(null);

            setAlert({
                type: "success",
                message: "🎉 ¡Copia de seguridad restaurada con éxito! Actualizando la vista...",
            });

            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err: any) {
            setAlert({
                type: "error",
                message: err.message || "Ocurrió un fallo al restaurar los datos.",
            });
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <div className={styles.container}>
            {alert && (
                <div
                    className={`${styles.feedbackAlert} ${
                        alert.type === "success" ? styles.alertSuccess : styles.alertError
                    }`}
                >
                    <span>{alert.message}</span>
                    {alert.link && (
                        <a href={alert.link} target="_blank" rel="noopener noreferrer" className={styles.alertLink}>
                            Abrir archivo ↗
                        </a>
                    )}
                </div>
            )}

            {/* Input oculto para subir archivo JSON */}
            <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleFileSelected}
            />

            {/* BLOQUE 1: Copias de Seguridad (Snapshot .json) */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>📦</div>
                    <div>
                        <h3 className={styles.cardTitle}>Copias de Seguridad (Snapshot Completo)</h3>
                        <p className={styles.cardDescription}>
                            Guarda una foto instantánea exacta de todas tus finanzas en formato <code>.json</code>.
                            Este archivo contiene todos tus movimientos, cuotas, inversiones y tarjetas, listo para ser
                            restaurado en cualquier momento.
                        </p>
                    </div>
                </div>

                <div className={styles.btnGroup}>
                    <button
                        type="button"
                        onClick={handleBackupToGoogleDrive}
                        disabled={!!loadingAction}
                        className={styles.primaryBtn}
                    >
                        {loadingAction === "drive-json" ? "Conectando con Drive..." : "☁️ Guardar Copia en Google Drive"}
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadLocalJson}
                        disabled={!!loadingAction}
                        className={styles.secondaryBtn}
                    >
                        💾 Descargar una Copia (.json local)
                    </button>

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!!loadingAction}
                        className={styles.secondaryBtn}
                    >
                        🔄 Restaurar Copia de Seguridad
                    </button>
                </div>
            </div>

            {/* BLOQUE 2: Exportación Legible para Usuarios (Excel & Sheets) */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>📊</div>
                    <div>
                        <h3 className={styles.cardTitle}>Exportación para Consulta (Planilla y Excel)</h3>
                        <p className={styles.cardDescription}>
                            Genera planillas con formato legible para humanos con exactamente las mismas columnas
                            originales (ID, Fechas, Categorías, Cuotas, Inversiones, etc.). Ideal para analizar tus
                            números en Excel o Google Sheets.
                        </p>
                    </div>
                </div>

                <div className={styles.btnGroup}>
                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        disabled={!!loadingAction}
                        className={styles.secondaryBtn}
                    >
                        📥 Descargar Planilla Excel (.xlsx)
                    </button>

                    <button
                        type="button"
                        onClick={handleExportToGoogleSheets}
                        disabled={!!loadingAction}
                        className={styles.secondaryBtn}
                    >
                        {loadingAction === "sheets" ? "Creando hoja en Google..." : "📊 Exportar a Google Sheets"}
                    </button>
                </div>
            </div>

            {/* MODAL DE CONFIRMACIÓN DE RESTAURACIÓN */}
            {previewSummary && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <h3 className={styles.modalTitle}>Confirmar Restauración de Datos</h3>
                        <p className={styles.cardDescription}>
                            Se ha analizado el archivo de respaldo. A continuación se detallan los registros que se
                            restaurarán:
                        </p>

                        <div className={styles.modalSummaryGrid}>
                            <div className={styles.summaryItem}>
                                <strong>Transacciones:</strong> {previewSummary.transactionsCount}
                            </div>
                            <div className={styles.summaryItem}>
                                <strong>Cuotas:</strong> {previewSummary.instalmentsCount}
                            </div>
                            <div className={styles.summaryItem}>
                                <strong>Inversiones:</strong> {previewSummary.investmentsCount}
                            </div>
                            <div className={styles.summaryItem}>
                                <strong>Tarjetas:</strong> {previewSummary.cardsCount}
                            </div>
                            <div className={styles.summaryItem}>
                                <strong>Pagos de Tarjetas:</strong> {previewSummary.cardPaymentsCount}
                            </div>
                            <div className={styles.summaryItem}>
                                <strong>Metas de Ahorro:</strong> {previewSummary.savingsGoalsCount}
                            </div>
                            <div className={styles.summaryItem}>
                                <strong>Categorías:</strong> {previewSummary.categoriesCount}
                            </div>
                            <div className={styles.summaryItem}>
                                <strong>Fecha respaldo:</strong>{" "}
                                {new Date(previewSummary.exportedAt).toLocaleDateString()}
                            </div>
                        </div>

                        <div className={styles.warningBox}>
                            ⚠️ <strong>Advertencia importante:</strong> Esta acción reemplazará los datos actuales de tu
                            cuenta por los que contiene este respaldo. Asegúrate de que este es el estado al que deseas
                            revertir.
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                onClick={() => {
                                    setPreviewSummary(null);
                                    setPendingPayload(null);
                                }}
                                disabled={isRestoring}
                                className={styles.secondaryBtn}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRestore}
                                disabled={isRestoring}
                                className={styles.dangerBtn}
                            >
                                {isRestoring ? "Restaurando..." : "Reemplazar y Restaurar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

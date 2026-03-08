"use client";

import { useState } from "react";
import styles from "./TransactionInput.module.css";
import ValidationModal from "@/components/dashboard/ValidationModal";
import { ExtractedItem } from "@/lib/constants";

// --- Utilidad para comprimir imágenes en el celular previniendo el error 413 de Vercel ---
const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    } else {
                        reject(new Error("Fallo de compresión."));
                    }
                }, 'image/jpeg', 0.7); // 70% de calidad es más que perfecto para OCR de tickets
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

export default function TransactionInput() {
    const [textInput, setTextInput] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [isDragging, setIsDragging] = useState(false);

    const handleProcess = async (directFile?: File) => {
        const fileToProcess = directFile || imageFile;
        if (!textInput && !fileToProcess) return;
        setLoading(true);

        try {
            const formData = new FormData();
            if (textInput) formData.append("text", textInput);

            // Comprimir la imagen antes de subirla en background
            if (fileToProcess) {
                let finalFile = fileToProcess;
                if (fileToProcess.type.startsWith("image/")) {
                    finalFile = await compressImage(fileToProcess);
                }
                formData.append("file", finalFile);
            }

            const res = await fetch("/api/process", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                if (res.status === 413) throw new Error("La imagen es demasiado pesada (Límite 5MB).");
                throw new Error("Error en el procesamiento");
            }

            const data = await res.json();
            setExtractedItems(data.items || []);
            setIsModalOpen(true);
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : "Hubo un error al procesar tu solicitud.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const clearForm = () => {
        setTextInput("");
        setImageFile(null);
    };

    // --- Funcionalidad Drag & Drop ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith("image/") || file.type === "application/pdf") {
                setImageFile(file);
                void handleProcess(file);
            }
        }
    };

    // --- Funcionalidad Pegar (Clipboard) ---
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf("image") !== -1 || item.type === "application/pdf") {
                const file = item.getAsFile();
                if (file) {
                    setImageFile(file);
                    void handleProcess(file);
                    // Prevenimos que se pegue también el texto interno a veces asocido a la imagen
                    e.preventDefault();
                    break;
                }
            }
        }
    };

    return (
        <>
            <div
                className={`${styles.inputArea} ${isDragging ? styles.dragActive : ""}`}
                style={{ position: 'relative' }}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onPaste={handlePaste}
            >
                {isDragging && <div className={styles.dragMsg}>Soltá tu ticket acá 📥</div>}

                <textarea
                    className={styles.smartInput}
                    rows={2}
                    placeholder='Ej: "Gasté 5000 en el súper en limpieza" • O pegá tu foto/PDF acá (Ctrl+V) • O arrastralo 📄'
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    disabled={loading}
                />

                {imageFile && (
                    <div className={styles.attachment}>
                        <span className={styles.fileIcon}>📄</span>
                        <span className={styles.fileName}>{imageFile.name}</span>
                        <button onClick={() => setImageFile(null)} className={styles.removeFile}>&times;</button>
                    </div>
                )}

                <div className={styles.inputActions}>
                    <label className={styles.addBtn}>
                        <span>📸</span> Scan
                        <input
                            type="file"
                            accept="image/*, application/pdf"
                            capture="environment"
                            className={styles.hiddenInput}
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    setImageFile(file);
                                    void handleProcess(file);
                                }
                            }}
                        />
                    </label>
                    <button
                        className={loading ? styles.submitBtnLoading : styles.submitBtn}
                        onClick={() => handleProcess()}
                        disabled={loading || (!textInput && !imageFile)}
                    >
                        {loading ? "Pensando..." : "Procesar"} <span className={loading ? styles.spin : ""}>✨</span>
                    </button>
                </div>
            </div>

            {isModalOpen && (
                <ValidationModal
                    items={extractedItems}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        clearForm();
                        // Trigger refresh on the dashboard to show new data
                    }}
                />
            )}

            {errorMsg && (
                <div className={styles.errorOverlay}>
                    <div className={styles.errorModal}>
                        <h3 style={{ marginBottom: 12, fontSize: '1.2rem', color: 'var(--text-main)' }}>Vesta dice</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{errorMsg}</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setErrorMsg(null)}
                                style={{
                                    background: 'transparent',
                                    color: 'var(--accent-color)',
                                    border: '1px solid var(--accent-color)',
                                    padding: '8px 24px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

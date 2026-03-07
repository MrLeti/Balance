"use client";

import { useState } from "react";
import styles from "./TransactionInput.module.css";
import ValidationModal from "@/components/dashboard/ValidationModal";
import { ExtractedItem } from "@/lib/constants";

export default function TransactionInput() {
    const [textInput, setTextInput] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [isDragging, setIsDragging] = useState(false);

    const handleProcess = async () => {
        if (!textInput && !imageFile) return;
        setLoading(true);

        try {
            const formData = new FormData();
            if (textInput) formData.append("text", textInput);
            if (imageFile) formData.append("file", imageFile);

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
            alert(err instanceof Error ? err.message : "Hubo un error al procesar tu solicitud.");
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
        if (files && files.length > 0 && files[0].type.startsWith("image/")) {
            setImageFile(files[0]);
        }
    };

    // --- Funcionalidad Pegar (Clipboard) ---
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    setImageFile(file);
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
                    placeholder='Ej: "Gasté 5000 en el súper en limpieza" • O pegá tu foto acá (Ctrl+V) • O arrastrala 📸'
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
                            accept="image/*"
                            capture="environment"
                            className={styles.hiddenInput}
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setImageFile(e.target.files[0]);
                                }
                            }}
                        />
                    </label>
                    <button
                        className={loading ? styles.submitBtnLoading : styles.submitBtn}
                        onClick={handleProcess}
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
                        // TODO: Trigger refresh on the dashboard to show new data
                    }}
                />
            )}
        </>
    );
}

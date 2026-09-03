"use client";

import { useEffect, useRef } from "react";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Reemplaza window.confirm() con un diálogo React estilizado.
 * No bloquea el hilo principal y es compatible con PWA/iOS.
 *
 * Uso:
 *   const [dialog, setDialog] = useState<{ message: string } | null>(null);
 *
 *   <ConfirmDialog
 *     isOpen={!!dialog}
 *     message={dialog?.message ?? ""}
 *     onConfirm={() => { doAction(); setDialog(null); }}
 *     onCancel={() => setDialog(null)}
 *   />
 */
export default function ConfirmDialog({
    isOpen,
    title = "Confirmar acción",
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = true,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const cancelBtnRef = useRef<HTMLButtonElement>(null);

    // Focus en Cancelar al abrir — "safe default" para acciones destructivas
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => cancelBtnRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Cerrar con Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                <p id="dialog-title" className={styles.title}>{title}</p>
                <p className={styles.message}>{message}</p>
                <div className={styles.actions}>
                    <button
                        ref={cancelBtnRef}
                        className={styles.cancelBtn}
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className={`${styles.confirmBtn} ${danger ? styles.danger : styles.safe}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

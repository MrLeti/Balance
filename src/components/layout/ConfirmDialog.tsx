"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * Reemplaza window.confirm() con un diálogo modal centrado en pantalla
 * montado mediante createPortal en document.body para no alterar la
 * posición de scroll ni depender de contextos de apilamiento ancestros.
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
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Focus en Cancelar al abrir evitando cualquier salto de scroll (preventScroll)
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                cancelBtnRef.current?.focus({ preventScroll: true });
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Añade la clase modal-open para ocultar FABs y estabilizar el viewport
    useEffect(() => {
        if (!isOpen) return;
        document.body.classList.add("modal-open");
        return () => {
            document.body.classList.remove("modal-open");
        };
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

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                <p id="dialog-title" className={styles.title}>{title}</p>
                <p className={styles.message}>{message}</p>
                <div className={styles.actions}>
                    <button
                        ref={cancelBtnRef}
                        type="button"
                        className={styles.cancelBtn}
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`${styles.confirmBtn} ${danger ? styles.danger : styles.safe}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

"use client";

import React, { useEffect } from "react";
import styles from "./InvestmentModal.module.css";
import TransactionForm from "./TransactionForm";

interface InvestmentModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function InvestmentModal({ onClose, onSuccess }: InvestmentModalProps) {
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
                {/* Header Bar */}
                <div className={styles.header}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.3rem" }}>🟣</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>
                                Registrar Inversión
                            </h3>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                Activos Financieros y Cartera
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

                {/* Form Container */}
                <div className={styles.scrollArea}>
                    <TransactionForm
                        onTransactionAdded={() => {
                            onSuccess();
                            onClose();
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

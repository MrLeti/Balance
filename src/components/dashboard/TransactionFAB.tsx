"use client";

import React, { useState, useEffect } from "react";
import styles from "./TransactionFAB.module.css";
import ValidationModal from "./ValidationModal";
import InvestmentModal from "@/components/inversiones/InvestmentModal";
import { TrxType } from "@/lib/constants";

export default function TransactionFAB() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeModalType, setActiveModalType] = useState<TrxType | null>(null);
    const [showInvestmentModal, setShowInvestmentModal] = useState(false);
    const [sharedFile, setSharedFile] = useState<File | null>(null);
    const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

    useEffect(() => {
        // Sync with modal_opened / modal_closed events
        const handleModalOpened = () => setIsAnyModalOpen(true);
        const handleModalClosed = () => setIsAnyModalOpen(false);

        // Listen for files received via Web Share Target
        const handleSharedFile = (e: Event) => {
            const customEvent = e as CustomEvent<{ file: File }>;
            if (customEvent.detail?.file) {
                setSharedFile(customEvent.detail.file);
                setActiveModalType("Egreso");
                setIsMenuOpen(false);
            }
        };

        window.addEventListener("modal_opened", handleModalOpened);
        window.addEventListener("modal_closed", handleModalClosed);
        window.addEventListener("share_target_file", handleSharedFile);

        // MutationObserver to observe document.body.classList
        const observer = new MutationObserver(() => {
            const hasModalOpenClass = document.body.classList.contains("modal-open");
            setIsAnyModalOpen(hasModalOpenClass);
        });

        observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

        return () => {
            window.removeEventListener("modal_opened", handleModalOpened);
            window.removeEventListener("modal_closed", handleModalClosed);
            window.removeEventListener("share_target_file", handleSharedFile);
            observer.disconnect();
        };
    }, []);

    const handleOpenModal = (type: TrxType) => {
        setIsMenuOpen(false);
        if (type === "Inversión") {
            setShowInvestmentModal(true);
        } else {
            setActiveModalType(type);
        }
    };

    const isModalActive = isAnyModalOpen || Boolean(activeModalType) || showInvestmentModal || Boolean(sharedFile);

    return (
        <>
            {/* Backdrop overlay when speed dial is open */}
            {isMenuOpen && (
                <div
                    className={styles.backdrop}
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            <div className={`${styles.fabContainer} ${isModalActive ? styles.fabHidden : ""}`}>
                {/* Main FAB Trigger */}
                <button
                    type="button"
                    className={`${styles.fabButton} ${isMenuOpen ? styles.fabButtonOpen : ""}`}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Registrar nuevo movimiento"
                >
                    <span className={`${styles.fabIcon} ${isMenuOpen ? styles.fabIconRotated : ""}`}>
                        ＋
                    </span>
                    <span className={styles.fabLabel}>
                        {isMenuOpen ? "Cerrar" : "Nuevo Movimiento"}
                    </span>
                </button>

                {/* Speed Dial Menu: Gasto, Ingreso, Ahorro, Inversión */}
                {isMenuOpen && (
                    <div className={styles.speedDialMenu}>
                        {/* 1. Gasto (Rojo) */}
                        <button
                            type="button"
                            className={styles.speedDialItem}
                            onClick={() => handleOpenModal("Egreso")}
                        >
                            <span className={styles.speedDialLabel}>Gasto</span>
                            <div className={`${styles.speedDialCircle} ${styles.circleGasto}`}>
                                💸
                            </div>
                        </button>

                        {/* 2. Ingreso (Verde) */}
                        <button
                            type="button"
                            className={styles.speedDialItem}
                            onClick={() => handleOpenModal("Ingreso")}
                        >
                            <span className={styles.speedDialLabel}>Ingreso</span>
                            <div className={`${styles.speedDialCircle} ${styles.circleIngreso}`}>
                                💰
                            </div>
                        </button>

                        {/* 3. Ahorro (Azul) */}
                        <button
                            type="button"
                            className={styles.speedDialItem}
                            onClick={() => handleOpenModal("Ahorro")}
                        >
                            <span className={styles.speedDialLabel}>Ahorro</span>
                            <div className={`${styles.speedDialCircle} ${styles.circleAhorro || styles.circleGasto}`} style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                                🎯
                            </div>
                        </button>

                        {/* 4. Inversión (Violeta) */}
                        <button
                            type="button"
                            className={styles.speedDialItem}
                            onClick={() => handleOpenModal("Inversión")}
                        >
                            <span className={styles.speedDialLabel}>Inversión</span>
                            <div className={`${styles.speedDialCircle} ${styles.circleInversion}`}>
                                📈
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* Inversión Modal (12-field comprehensive form) */}
            {showInvestmentModal && (
                <InvestmentModal
                    onClose={() => setShowInvestmentModal(false)}
                    onSuccess={() => setShowInvestmentModal(false)}
                />
            )}

            {/* Cashflow, Tickets & Savings Modal (Egreso, Ingreso, Ahorro, Shared File) */}
            {(activeModalType || sharedFile) && (
                <ValidationModal
                    items={[]}
                    initialType={activeModalType || "Egreso"}
                    initialFile={sharedFile || undefined}
                    onClose={() => {
                        setActiveModalType(null);
                        setSharedFile(null);
                    }}
                    onSuccess={() => {
                        setActiveModalType(null);
                        setSharedFile(null);
                    }}
                />
            )}
        </>
    );
}

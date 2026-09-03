"use client";

import React, { useState } from "react";
import styles from "./TransactionFAB.module.css";
import ValidationModal from "./ValidationModal";
import InvestmentModal from "@/components/inversiones/InvestmentModal";
import { TrxType } from "@/lib/constants";

export default function TransactionFAB() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeModalType, setActiveModalType] = useState<TrxType | null>(null);
    const [showInvestmentModal, setShowInvestmentModal] = useState(false);

    const handleOpenModal = (type: TrxType) => {
        setIsMenuOpen(false);
        if (type === "Inversión") {
            setShowInvestmentModal(true);
        } else {
            setActiveModalType(type);
        }
    };

    return (
        <>
            {/* Backdrop overlay when speed dial is open */}
            {isMenuOpen && (
                <div
                    className={styles.backdrop}
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            <div className={styles.fabContainer}>
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

            {/* Cashflow & Savings Modal (Egreso, Ingreso, Ahorro) */}
            {activeModalType && (
                <ValidationModal
                    items={[]}
                    initialType={activeModalType}
                    onClose={() => setActiveModalType(null)}
                    onSuccess={() => setActiveModalType(null)}
                />
            )}
        </>
    );
}

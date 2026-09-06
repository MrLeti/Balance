"use client";

import React, { useState, useRef, useCallback } from "react";
import styles from "./AiPromptBar.module.css";

export interface AiPromptBarProps {
    title?: string;
    hint?: string;
    placeholder?: string;
    buttonText?: string;
    isLoading?: boolean;
    onSubmit: (prompt: string) => void | Promise<void>;
    disabled?: boolean;
    className?: string;
}

/**
 * Reusable AI Prompt Bar with rotating glowing aura, sharp glowing border,
 * and modern action button. Automatically and dynamically adapts its glowing
 * diameter to any aspect ratio and width/height change using ResizeObserver.
 */
export const AiPromptBar: React.FC<AiPromptBarProps> = ({
    title = "Analizar con IA",
    hint = "Escribí o pegá tu consulta en lenguaje natural...",
    placeholder = "Escribí tu consulta aquí...",
    buttonText = "Analizar",
    isLoading = false,
    onSubmit,
    disabled = false,
    className = ""
}) => {
    const [value, setValue] = useState("");

    // Dynamically calculate the glowing aura diameter to adapt to any width/height change
    const glowRoRef = useRef<ResizeObserver | null>(null);
    const aiGlowRef = useCallback((node: HTMLDivElement | null) => {
        if (glowRoRef.current) {
            glowRoRef.current.disconnect();
            glowRoRef.current = null;
        }

        if (node && typeof window !== "undefined") {
            const updateGlowDimensions = () => {
                const rect = node.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return;
                // Calculate diagonal: sqrt(w^2 + h^2) + safety padding for the aura blur
                const diagonal = Math.ceil(Math.hypot(rect.width, rect.height)) + 36;
                node.style.setProperty("--glow-size", `${diagonal}px`);
                node.style.setProperty("--glow-half-size", `${Math.ceil(diagonal / 2)}px`);
            };

            updateGlowDimensions();

            if (typeof ResizeObserver !== "undefined") {
                const ro = new ResizeObserver(updateGlowDimensions);
                ro.observe(node);
                glowRoRef.current = ro;
            }

            window.addEventListener("resize", updateGlowDimensions);
        }
    }, []);

    const handleAction = () => {
        const trimmed = value.trim();
        if (!trimmed || isLoading || disabled) return;
        void onSubmit(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAction();
        }
    };

    return (
        <div className={`${styles.aiGlowOuter} ${className}`} ref={aiGlowRef}>
            {/* Layer 1: Soft, intense rotating outer glow blur */}
            <div className={styles.aiGlowBlur} aria-hidden="true" />

            {/* Layer 2: Rotating crisp border */}
            <div className={styles.aiPromptContainer}>
                {/* Layer 3: Solid Inner Card masking the gradient */}
                <div className={styles.aiPromptCard}>
                    <div className={styles.aiPromptHeader}>
                        <span className={styles.aiSparkleIcon} aria-hidden="true">✨</span>
                        <span className={styles.aiPromptTitle}>{title}</span>
                        {hint && <span className={styles.aiPromptHint}>{hint}</span>}
                    </div>

                    <div className={styles.aiPromptInputRow}>
                        <input
                            type="text"
                            className={styles.aiInputField}
                            placeholder={placeholder}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading || disabled}
                        />
                        <button
                            type="button"
                            className={styles.aiAnalyzeBtn}
                            onClick={handleAction}
                            disabled={isLoading || disabled || !value.trim()}
                        >
                            {isLoading ? (
                                <>
                                    <span className={styles.spinIcon} aria-hidden="true">⏳</span>
                                    <span>Analizando...</span>
                                </>
                            ) : (
                                <>
                                    <span aria-hidden="true">✨</span>
                                    <span>{buttonText}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiPromptBar;

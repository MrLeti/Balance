"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import styles from "../login/page.module.css";

export default function ResetPasswordPage() {
    const router = useRouter();
    const supabase = createClient();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (password.length < 6) {
            setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
            return;
        }

        if (password !== confirmPassword) {
            setMessage({ type: "error", text: "Las contraseñas no coinciden." });
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            setMessage({
                type: "success",
                text: "¡Contraseña actualizada con éxito! Redirigiendo...",
            });

            setTimeout(() => {
                router.push("/");
                router.refresh();
            }, 1800);
        } catch (err: any) {
            setMessage({
                type: "error",
                text: err.message || "No se pudo actualizar la contraseña. El enlace puede haber expirado.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginWrapper}>
            <div className={styles.loginCard}>
                <div className={styles.brandHeader}>
                    <Image
                        src="/icon-192x192.png"
                        unoptimized
                        alt="Vesta Logo"
                        width={56}
                        height={56}
                        className={styles.logoImage}
                        priority
                    />
                    <h1 className={styles.brandTitle}>Nueva Contraseña</h1>
                    <p className={styles.brandSubtitle}>Ingresa tu nueva contraseña para Vesta</p>
                </div>

                {message && (
                    <div
                        className={`${styles.alertBox} ${
                            message.type === "error" ? styles.alertError : styles.alertSuccess
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleUpdatePassword} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nueva Contraseña</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className={styles.input}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Confirmar Contraseña</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repite la contraseña"
                            className={styles.input}
                            autoComplete="new-password"
                        />
                    </div>

                    <button type="submit" disabled={loading} className={styles.submitBtn}>
                        {loading ? "Actualizando..." : "Guardar Nueva Contraseña"}
                    </button>
                </form>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import styles from "./CuotasDashboard.module.css";

interface Tarjeta {
    id: string;
    nombre: string;
}

export default function TarjetasManager() {
    const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [nuevaTarjeta, setNuevaTarjeta] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchTarjetas();
    }, []);

    const fetchTarjetas = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/tarjetas");
            if (res.ok) {
                const json = await res.json();
                setTarjetas(json.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nuevaTarjeta.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/tarjetas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: nuevaTarjeta.trim() })
            });

            if (res.ok) {
                setNuevaTarjeta("");
                fetchTarjetas();
            } else {
                alert("Error al guardar la tarjeta.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, nombre: string) => {
        if (!window.confirm(`¿Seguro que querés eliminar la tarjeta "${nombre}"?\nNota: Eliminar la tarjeta no borra el historial previo de cuotas.`)) return;

        try {
            const res = await fetch(`/api/tarjetas/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchTarjetas();
            } else {
                alert("Error al eliminar.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return <div className={styles.loadingArea}><p>Cargando tarjetas...</p></div>;
    }

    return (
        <section className={`glass-panel ${styles.card}`}>
            <h3 className="text-muted" style={{ marginBottom: "16px" }}>Mis Tarjetas de Crédito</h3>

            <form onSubmit={handleAdd} style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                <input
                    type="text"
                    className={styles.input}
                    value={nuevaTarjeta}
                    onChange={(e) => setNuevaTarjeta(e.target.value)}
                    placeholder="Ej. Visa Galicia"
                    required
                    style={{ flex: 1 }}
                />
                <button type="submit" className={styles.submitBtn} disabled={isSubmitting} style={{ width: "auto" }}>
                    {isSubmitting ? "Añadiendo..." : "Añadir"}
                </button>
            </form>

            {tarjetas.length === 0 ? (
                <p className="text-muted text-center">Aún no hay tarjetas registradas.</p>
            ) : (
                <ul className={styles.txList}>
                    {tarjetas.map(t => (
                        <li key={t.id} className={styles.txItem} style={{ padding: "12px" }}>
                            <div className={styles.txInfo}>
                                <div className={styles.txIcon} style={{ background: "var(--accent-color)", color: "white" }}>💳</div>
                                <div>
                                    <p className={styles.txTitle}>{t.nombre}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(t.id, t.nombre)}
                                style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer", fontSize: "1.2rem", padding: "0 8px" }}
                                title="Eliminar"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

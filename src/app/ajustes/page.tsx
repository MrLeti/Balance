"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./page.module.css";
import ConfirmDialog from "@/components/layout/ConfirmDialog";
import BackupManager from "@/components/ajustes/BackupManager";
import { CategoryItem } from "@/lib/constants";
import { fmt } from "@/lib/utils/format";

const SWATCH_COLORS = [
    "#f59e0b", "#e0726b", "#ec4899", "#0ea5e9",
    "#22c55e", "#14b8a6", "#8b5cf6", "#6366f1",
    "#3b82f6", "#f43f5e", "#d97706", "#64748b"
];

interface PendingDelete {
    type: "category" | "subcategory";
    categoryId: string;
    categoryName: string;
    subCategoryName?: string;
    txCount: number;
    totalAmount: number;
}

export default function AjustesPage() {
    const [mainSection, setMainSection] = useState<"categorias" | "backups">("categorias");
    const [activeTab, setActiveTab] = useState<"Egreso" | "Ingreso">("Egreso");
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    // New Category Form state
    const [newCatName, setNewCatName] = useState("");
    const [newCatColor, setNewCatColor] = useState(SWATCH_COLORS[0]);
    const [newCatSubcats, setNewCatSubcats] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Quick add subcategory state per category
    const [newSubcatInputs, setNewSubcatInputs] = useState<Record<string, string>>({});

    // Delete confirmation state
    const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/categories");
            if (res.ok) {
                const json = await res.json();
                setCategories(json.data || []);
            }
        } catch (e) {
            console.error("Error fetching categories:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const notifyUpdates = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("categories_updated"));
            window.dispatchEvent(new Event("transaction_added"));
        }
    };

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;

        setIsSubmitting(true);
        try {
            const subcats = newCatSubcats
                .split(",")
                .map(s => s.trim())
                .filter(Boolean);

            const res = await fetch("/api/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: activeTab,
                    name: newCatName.trim(),
                    color: newCatColor,
                    subcategories: subcats,
                }),
            });

            if (res.ok) {
                setNewCatName("");
                setNewCatSubcats("");
                // Rotate swatch color
                const nextIdx = (SWATCH_COLORS.indexOf(newCatColor) + 1) % SWATCH_COLORS.length;
                setNewCatColor(SWATCH_COLORS[nextIdx]);
                await fetchCategories();
                notifyUpdates();
            } else {
                const data = await res.json();
                alert(data.error || "Error al crear la categoría.");
            }
        } catch (error) {
            console.error(error);
            alert("No se pudo conectar con el servidor.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddSubcategory = async (cat: CategoryItem) => {
        const subcatName = (newSubcatInputs[cat.id] || "").trim();
        if (!subcatName) return;

        if (cat.subcategories.some(s => s.toLowerCase() === subcatName.toLowerCase())) {
            alert("Esta subcategoría ya existe en esta categoría.");
            return;
        }

        const updatedSubcats = [...cat.subcategories, subcatName];

        try {
            const res = await fetch(`/api/categories/${cat.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subcategories: updatedSubcats }),
            });

            if (res.ok) {
                setNewSubcatInputs(prev => ({ ...prev, [cat.id]: "" }));
                await fetchCategories();
                notifyUpdates();
            } else {
                alert("Error al añadir la subcategoría.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateColor = async (catId: string, newColor: string) => {
        try {
            const res = await fetch(`/api/categories/${catId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ color: newColor }),
            });

            if (res.ok) {
                setCategories(prev => prev.map(c => c.id === catId ? { ...c, color: newColor } : c));
                notifyUpdates();
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Prompt deletion check
    const promptDeleteCategory = async (cat: CategoryItem) => {
        try {
            const res = await fetch(`/api/categories/usage?category=${encodeURIComponent(cat.name)}`);
            const usage = res.ok ? await res.json() : { count: 0, totalAmount: 0 };

            setPendingDelete({
                type: "category",
                categoryId: cat.id,
                categoryName: cat.name,
                txCount: usage.count || 0,
                totalAmount: usage.totalAmount || 0,
            });
        } catch (e) {
            console.error(e);
            setPendingDelete({
                type: "category",
                categoryId: cat.id,
                categoryName: cat.name,
                txCount: 0,
                totalAmount: 0,
            });
        }
    };

    const promptDeleteSubcategory = async (cat: CategoryItem, subcat: string) => {
        try {
            const res = await fetch(
                `/api/categories/usage?category=${encodeURIComponent(cat.name)}&subCategory=${encodeURIComponent(subcat)}`
            );
            const usage = res.ok ? await res.json() : { count: 0, totalAmount: 0 };

            setPendingDelete({
                type: "subcategory",
                categoryId: cat.id,
                categoryName: cat.name,
                subCategoryName: subcat,
                txCount: usage.count || 0,
                totalAmount: usage.totalAmount || 0,
            });
        } catch (e) {
            console.error(e);
            setPendingDelete({
                type: "subcategory",
                categoryId: cat.id,
                categoryName: cat.name,
                subCategoryName: subcat,
                txCount: 0,
                totalAmount: 0,
            });
        }
    };

    const handleConfirmDelete = async () => {
        if (!pendingDelete) return;

        setIsDeleting(true);
        try {
            let url = `/api/categories/${pendingDelete.categoryId}?cascade=true`;
            if (pendingDelete.type === "subcategory" && pendingDelete.subCategoryName) {
                url += `&subCategory=${encodeURIComponent(pendingDelete.subCategoryName)}`;
            }

            const res = await fetch(url, { method: "DELETE" });
            if (res.ok) {
                setPendingDelete(null);
                await fetchCategories();
                notifyUpdates();
            } else {
                alert("Error al eliminar.");
            }
        } catch (e) {
            console.error(e);
            alert("Error al conectar con el servidor.");
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredCategories = categories.filter(c => c.type === activeTab);

    return (
        <div className={styles.container}>
            {/* Delete Confirmation Dialog with movement details */}
            <ConfirmDialog
                isOpen={!!pendingDelete}
                title={
                    pendingDelete?.type === "category"
                        ? `Eliminar Categoría "${pendingDelete?.categoryName}"`
                        : `Eliminar Subcategoría "${pendingDelete?.subCategoryName}"`
                }
                message={
                    pendingDelete
                        ? pendingDelete.txCount > 0
                            ? `⚠️ ATENCIÓN: Esta ${pendingDelete.type === "category" ? "categoría" : "subcategoría"} tiene ${pendingDelete.txCount} movimiento(s) registrado(s) por un total de ${fmt(pendingDelete.totalAmount)}.\n\nSi aceptas, se eliminará la ${pendingDelete.type === "category" ? "categoría" : "subcategoría"} y TODOS sus movimientos asociados permanentemente.`
                            : `¿Estás seguro de eliminar esta ${pendingDelete.type === "category" ? "categoría" : "subcategoría"}?`
                        : ""
                }
                confirmLabel={pendingDelete?.txCount && pendingDelete.txCount > 0 ? "Eliminar Todo" : "Eliminar"}
                cancelLabel="Cancelar"
                danger
                onConfirm={handleConfirmDelete}
                onCancel={() => setPendingDelete(null)}
            />

            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Ajustes de Cuenta</h1>
                    <p className={styles.subtitle}>
                        Personaliza tus categorías de finanzas y gestiona tus copias de seguridad.
                    </p>
                </div>
            </div>

            {/* Selector de Sección Principal */}
            <div className={styles.tabsContainer} style={{ marginBottom: "8px" }}>
                <button
                    type="button"
                    className={`${styles.tabBtn} ${mainSection === "categorias" ? styles.activeTab : ""}`}
                    onClick={() => setMainSection("categorias")}
                >
                    🏷️ Categorías y Subcategorías
                </button>
                <button
                    type="button"
                    className={`${styles.tabBtn} ${mainSection === "backups" ? styles.activeTab : ""}`}
                    onClick={() => setMainSection("backups")}
                >
                    📦 Copias de Seguridad y Exportación
                </button>
            </div>

            {mainSection === "backups" ? (
                <BackupManager />
            ) : (
                <>
                    {/* Tabs */}
                    <div className={styles.tabsContainer}>
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${activeTab === "Egreso" ? styles.activeTab : ""}`}
                            onClick={() => setActiveTab("Egreso")}
                        >
                            📉 Egresos (Gastos)
                        </button>
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${activeTab === "Ingreso" ? styles.activeTab : ""}`}
                            onClick={() => setActiveTab("Ingreso")}
                        >
                            ✅ Ingresos
                        </button>
                    </div>

            {/* Create Category Form Card */}
            <section className={styles.addCard}>
                <h3 className={styles.addCardTitle}>
                    + Nueva Categoría de {activeTab === "Egreso" ? "Gasto" : "Ingreso"}
                </h3>
                <form onSubmit={handleCreateCategory}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Nombre de la Categoría</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={newCatName}
                                onChange={e => setNewCatName(e.target.value)}
                                placeholder="Ej. Educación, Mascotas, etc."
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Color Identificador</label>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className={styles.colorPickerWrapper}>
                                    <div className={styles.colorCircle} style={{ backgroundColor: newCatColor }} />
                                    <input
                                        type="color"
                                        className={styles.colorInputHidden}
                                        value={newCatColor}
                                        onChange={e => setNewCatColor(e.target.value)}
                                        title="Color personalizado"
                                    />
                                </div>
                                <div className={styles.colorSwatches}>
                                    {SWATCH_COLORS.slice(0, 6).map(c => (
                                        <button
                                            type="button"
                                            key={c}
                                            className={`${styles.swatchBtn} ${newCatColor === c ? styles.swatchActive : ""}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setNewCatColor(c)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Subcategorías Iniciales (separadas por coma)</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={newCatSubcats}
                                onChange={e => setNewCatSubcats(e.target.value)}
                                placeholder="Ej: Veterinaria, Alimento, Juguetes"
                            />
                        </div>

                        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                            {isSubmitting ? "Creando..." : "+ Crear Categoría"}
                        </button>
                    </div>
                </form>
            </section>

            {/* Categories Display */}
            {loading ? (
                <div className={styles.loadingArea}>
                    <div className={styles.spinner} />
                    <p className="text-muted">Cargando categorías...</p>
                </div>
            ) : filteredCategories.length === 0 ? (
                <div className={styles.emptyArea}>
                    <p>No tienes categorías de {activeTab.toLowerCase()} creadas aún.</p>
                </div>
            ) : (
                <div className={styles.categoriesGrid}>
                    {filteredCategories.map(cat => (
                        <div key={cat.id} className={styles.categoryCard}>
                            {/* Card Header: Color, Name, Actions */}
                            <div className={styles.categoryHeader}>
                                <div className={styles.categoryTitleArea}>
                                    <div className={styles.colorPickerWrapper}>
                                        <div
                                            className={styles.colorCircle}
                                            style={{ backgroundColor: cat.color }}
                                            title="Click para cambiar color"
                                        />
                                        <input
                                            type="color"
                                            className={styles.colorInputHidden}
                                            value={cat.color}
                                            onChange={e => handleUpdateColor(cat.id, e.target.value)}
                                        />
                                    </div>
                                    <span className={styles.categoryName}>{cat.name}</span>
                                </div>

                                <div className={styles.cardActions}>
                                    <button
                                        type="button"
                                        className={styles.actionBtn}
                                        title="Eliminar categoría"
                                        onClick={() => promptDeleteCategory(cat)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>

                            {/* Subcategories */}
                            <div className={styles.subcategoriesSection}>
                                <span className={styles.subcatLabel}>
                                    Subcategorías ({cat.subcategories.length})
                                </span>

                                <div className={styles.subcatChips}>
                                    {cat.subcategories.length === 0 ? (
                                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                            Sin subcategorías aún.
                                        </span>
                                    ) : (
                                        cat.subcategories.map(subcat => (
                                            <div key={subcat} className={styles.chip}>
                                                <span>{subcat}</span>
                                                <button
                                                    type="button"
                                                    className={styles.chipDeleteBtn}
                                                    title={`Eliminar subcategoría ${subcat}`}
                                                    onClick={() => promptDeleteSubcategory(cat, subcat)}
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Quick Add Subcategory Input */}
                                <form
                                    className={styles.addSubcatForm}
                                    onSubmit={e => {
                                        e.preventDefault();
                                        handleAddSubcategory(cat);
                                    }}
                                >
                                    <input
                                        type="text"
                                        className={styles.subcatInput}
                                        placeholder="+ Nueva subcategoría"
                                        value={newSubcatInputs[cat.id] || ""}
                                        onChange={e =>
                                            setNewSubcatInputs(prev => ({
                                                ...prev,
                                                [cat.id]: e.target.value,
                                            }))
                                        }
                                    />
                                    <button type="submit" className={styles.addSubcatBtn}>
                                        Añadir
                                    </button>
                                </form>
                            </div>
                        </div>
                    ))}
                </div>
            )}
                </>
            )}
        </div>
    );
}

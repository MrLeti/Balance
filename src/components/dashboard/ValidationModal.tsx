"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import styles from "./ValidationModal.module.css";
import { CATEGORIES, ExtractedItem, TrxType, CategoryItem } from "@/lib/constants";
import { parseSafeAmount, fmt } from "@/lib/utils/format";

interface ValidationModalProps {
    items?: ExtractedItem[];
    initialType?: TrxType;
    onClose: () => void;
    onSuccess: () => void;
}

// Image compression helper for mobile uploads
const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
                    } else {
                        reject(new Error("Fallo de compresión."));
                    }
                }, "image/jpeg", 0.7);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

const getTodayFormatted = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

// Date conversions for HTML5 date input <-> DD/MM/YYYY
const toIsoDate = (dStr: string) => {
    if (!dStr) return "";
    const parts = dStr.split("/");
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return dStr;
};

const fromIsoDate = (isoStr: string) => {
    if (!isoStr) return getTodayFormatted();
    const parts = isoStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
};

export default function ValidationModal({ items, initialType = "Egreso", onClose, onSuccess }: ValidationModalProps) {
    const defaultType = initialType || "Egreso";
    const initialItems = items && items.length > 0
        ? items.map(item => ({
            Fecha: item.Fecha || getTodayFormatted(),
            Tipo: (item.Tipo as TrxType) || defaultType,
            Categoría: item.Categoría || "",
            Subcategoría: item.Subcategoría || "",
            Monto: item.Monto !== undefined && item.Monto !== null ? String(item.Monto) : "",
            Comentario: item.Comentario || "",
            isConfirmed: true
        }))
        : [{
            Fecha: getTodayFormatted(),
            Tipo: defaultType,
            Categoría: "",
            Subcategoría: "",
            Monto: "",
            Comentario: "",
            isConfirmed: true
        }];

    const [editableItems, setEditableItems] = useState(initialItems);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Currency mode: ARS or USD with MEP conversion
    const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
    const [mepRate, setMepRate] = useState<number | null>(null);

    // Investment operation action: Compra (salida de caja) vs Venta (entrada de caja)
    const [invOperation, setInvOperation] = useState<"Compra" | "Venta">("Compra");

    // Instalment mode state
    const [isInstalmentMode, setIsInstalmentMode] = useState(false);
    const [instalmentConcept, setInstalmentConcept] = useState("");
    const [instalmentsCount, setInstalmentsCount] = useState("1");
    const [startMonth, setStartMonth] = useState("");
    const [tarjetas, setTarjetas] = useState<{ id: string; nombre: string }[]>([]);
    const [selectedTarjeta, setSelectedTarjeta] = useState("");

    // AI & Scanning state
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [showAiPrompt, setShowAiPrompt] = useState(false);
    const [aiTextPrompt, setAiTextPrompt] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    const [dynamicSavingsGoals, setDynamicSavingsGoals] = useState<string[]>([]);
    const [dynamicCategories, setDynamicCategories] = useState<CategoryItem[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch dynamic categories
    useEffect(() => {
        const loadCategories = () => {
            fetch("/api/categories")
                .then(r => r.ok ? r.json() : null)
                .then(d => {
                    if (d && Array.isArray(d.data)) {
                        setDynamicCategories(d.data);
                    }
                })
                .catch(() => {});
        };

        loadCategories();
        window.addEventListener("categories_updated", loadCategories);
        return () => window.removeEventListener("categories_updated", loadCategories);
    }, []);

    // Fetch Dolar MEP rate on mount
    useEffect(() => {
        fetch("/api/dolar")
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d && (d.mep || d.bolsa || d.ccl)) {
                    setMepRate(d.mep || d.bolsa || d.ccl);
                }
            })
            .catch(() => {
                // Fallback default
                setMepRate(1300);
            });

        fetch("/api/savings/goals")
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d && Array.isArray(d.goals)) {
                    setDynamicSavingsGoals(d.goals.map((g: any) => g.name));
                }
            })
            .catch(() => {});
    }, []);

    // Close on Escape & Lock body scroll
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isSaving && !isProcessingAI) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [onClose, isSaving, isProcessingAI]);

    // Initialize start month and tarjetas
    useEffect(() => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        const mm = (date.getMonth() + 1).toString().padStart(2, "0");
        const yyyy = date.getFullYear();
        setStartMonth(`${mm}/${yyyy}`);

        fetch("/api/tarjetas")
            .then((r) => r.json())
            .then((d) => {
                if (d.data) {
                    setTarjetas(d.data);
                }
            })
            .catch((e) => console.error(e));
    }, []);

    // Current item being edited
    const currentItem = editableItems[currentIndex] || editableItems[0];

    const handleFieldChange = (field: keyof ExtractedItem, value: string) => {
        setEditableItems((prev) =>
            prev.map((item, i) => (i === currentIndex ? { ...item, [field]: value } : item))
        );
    };

    const handleTypeChange = (newType: TrxType) => {
        setEditableItems((prev) =>
            prev.map((item, i) => {
                if (i === currentIndex) {
                    return {
                        ...item,
                        Tipo: newType,
                        Categoría: "",
                        Subcategoría: ""
                    };
                }
                return item;
            })
        );
    };

    // Process AI OCR or text directly in the modal
    const processWithAI = async (fileToProcess?: File, textToProcess?: string) => {
        if (!fileToProcess && !textToProcess) return;
        setIsProcessingAI(true);
        setErrorMsg(null);

        try {
            const formData = new FormData();
            if (textToProcess) formData.append("text", textToProcess);

            if (fileToProcess) {
                let finalFile = fileToProcess;
                if (fileToProcess.type.startsWith("image/")) {
                    finalFile = await compressImage(fileToProcess);
                }
                formData.append("file", finalFile);
            }

            const res = await fetch("/api/process", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                if (res.status === 413) throw new Error("El archivo es demasiado pesado (Límite 5MB).");
                throw new Error("Error en el procesamiento con IA.");
            }

            const data = await res.json();
            if (data.items && data.items.length > 0) {
                const newItems = data.items.map((it: ExtractedItem) => ({
                    Fecha: it.Fecha || getTodayFormatted(),
                    Tipo: (it.Tipo as TrxType) || "Egreso",
                    Categoría: it.Categoría || "",
                    Subcategoría: it.Subcategoría || "",
                    Monto: it.Monto !== undefined && it.Monto !== null ? String(it.Monto) : "",
                    Comentario: it.Comentario || "",
                    isConfirmed: true
                }));
                setEditableItems(newItems);
                setCurrentIndex(0);
                setShowAiPrompt(false);
                setAiTextPrompt("");
            } else {
                throw new Error("No se pudieron extraer datos del comprobante.");
            }
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : "Hubo un error al procesar el comprobante.");
            console.error(err);
        } finally {
            setIsProcessingAI(false);
        }
    };

    // Multi-item management
    const handleAddNewItem = () => {
        const newItem = {
            Fecha: getTodayFormatted(),
            Tipo: currentItem?.Tipo || "Egreso",
            Categoría: "",
            Subcategoría: "",
            Monto: "",
            Comentario: "",
            isConfirmed: true
        };
        setEditableItems((prev) => [...prev, newItem]);
        setCurrentIndex(editableItems.length);
    };

    const handleRemoveCurrentItem = () => {
        if (editableItems.length <= 1) return;
        setEditableItems((prev) => prev.filter((_, i) => i !== currentIndex));
        setCurrentIndex((prev) => Math.max(0, prev - 1));
    };

    // Calculate totals in ARS
    const calculateTotal = () => {
        const rawTotal = editableItems.reduce((acc, curr) => acc + parseSafeAmount(curr.Monto), 0);
        if (currency === "USD" && mepRate && mepRate > 0) {
            return (rawTotal * mepRate).toFixed(2);
        }
        return rawTotal.toFixed(2);
    };

    const isFormValid = () => {
        if (editableItems.length === 0) return false;
        const amt = parseSafeAmount(currentItem.Monto);
        if (amt === 0 || isNaN(amt)) return false;
        if ((currentItem.Tipo === "Ingreso" || currentItem.Tipo === "Inversión") && amt < 0) return false;
        if (isInstalmentMode) {
            const tot = parseFloat(calculateTotal());
            const count = parseInt(instalmentsCount, 10);
            if (isNaN(tot) || tot <= 0 || isNaN(count) || count < 1) return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!isFormValid() || isSaving) return;
        setIsSaving(true);
        setErrorMsg(null);

        let cuotaId = "";

        try {
            // 1. Si eligió cuotas (sólo para Egreso)
            if (isInstalmentMode && currentItem.Tipo === "Egreso") {
                const totalAmount = parseFloat(calculateTotal());
                if (totalAmount <= 0) {
                    throw new Error("El monto total para pagar en cuotas debe ser mayor a cero.");
                }
                const count = parseInt(instalmentsCount, 10) || 1;
                if (count < 1) {
                    throw new Error("La cantidad de cuotas debe ser al menos 1.");
                }

                const today = new Date();
                const dd = today.getDate().toString().padStart(2, "0");
                const mm = (today.getMonth() + 1).toString().padStart(2, "0");
                const yyyy = today.getFullYear();

                const concept = instalmentConcept.trim() || currentItem.Comentario || currentItem.Subcategoría || "Compra en cuotas";

                const cuotaRes = await fetch("/api/cuotas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        date: `${dd}/${mm}/${yyyy}`,
                        concept: concept,
                        totalAmount: totalAmount,
                        instalmentsCount: count,
                        startMonth,
                        tarjeta: selectedTarjeta
                    })
                });

                const cuotaData = await cuotaRes.json().catch(() => ({}));
                if (!cuotaRes.ok || !cuotaData.id) {
                    throw new Error(cuotaData.error || "Fallo al crear la estructura de Cuotas.");
                }

                cuotaId = cuotaData.id;
            }

            // 2. Formatear para backend en ARS: [Fecha, Tipo, Categoría, Subcategoría, MontoARS, Comentario, ID Cuota]
            const rowsToInsert = editableItems
                .filter((item) => {
                    const val = parseSafeAmount(item.Monto);
                    if (val === 0 || isNaN(val)) return false;
                    if ((item.Tipo === "Ingreso" || item.Tipo === "Inversión") && val < 0) return false;
                    return true;
                })
                .map((item) => {
                    const rawVal = parseSafeAmount(item.Monto);
                    let finalVal = rawVal;
                    let commentWithFx = item.Comentario;

                    // Si fue ingresado en USD, convertir a ARS al Dólar MEP
                    if (currency === "USD" && mepRate && mepRate > 0) {
                        finalVal = Math.round(rawVal * mepRate * 100) / 100;
                        commentWithFx = item.Comentario 
                            ? `${item.Comentario} (USD ${rawVal} @ MEP $${mepRate})`
                            : `USD ${rawVal} (MEP $${mepRate})`;
                    }

                    // Si es inversión y es venta, añadir tag si no está
                    if (item.Tipo === "Inversión" && invOperation === "Venta") {
                        commentWithFx = commentWithFx ? `${commentWithFx} [Venta/Rescate]` : `[Venta/Rescate]`;
                    }

                    return [
                        item.Fecha,
                        item.Tipo,
                        item.Categoría || (item.Tipo === "Inversión" ? "Ahorro" : "Otros"),
                        item.Subcategoría || (item.Tipo === "Inversión" ? "Emergencia" : "Otros"),
                        finalVal,
                        commentWithFx,
                        cuotaId
                    ];
                });

            if (rowsToInsert.length === 0) {
                throw new Error("Por favor ingresa un monto válido distinto de cero.");
            }

            const res = await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: rowsToInsert }),
            });

            const resData = await res.json().catch(() => ({}));
            if (!res.ok || !resData.success) {
                throw new Error(resData.error || "Fallo al guardar los movimientos en la base de datos.");
            }

            if (resData.sheetsSynced === false) {
                window.dispatchEvent(new CustomEvent("sheets_sync_failed", {
                    detail: {
                        type: "transactions",
                        items: resData.rawItemsForSheets || rowsToInsert,
                        error: resData.sheetsError
                    }
                }));
            }

            onSuccess();
            window.dispatchEvent(new Event("transaction_added"));
        } catch (err: unknown) {
            // Rollback compensatorio: Si la cuota se creó pero la transacción falló, eliminar la cuota huérfana
            if (cuotaId) {
                try {
                    await fetch(`/api/cuotas/${cuotaId}`, { method: "DELETE" });
                    console.info(`Rollback ejecutado con éxito: cuota ${cuotaId} eliminada tras falla en transacciones.`);
                } catch (rollbackErr) {
                    console.error("Error intentando revertir cuota huérfana:", rollbackErr);
                }
            }

            setErrorMsg(err instanceof Error ? err.message : "Hubo un error al guardar los datos. Verificá tu conexión e intentá de nuevo.");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    // Dynamic Category and subcategory options
    const { availableCategories, availableSubcategories } = useMemo(() => {
        if (currentItem.Tipo === "Ahorro") {
            return {
                availableCategories: ["Aporte", "Retiro"],
                availableSubcategories: dynamicSavingsGoals.length > 0
                    ? dynamicSavingsGoals
                    : ["Fondo de Emergencia", "General", "Viaje", "Nueva PC", "Auto", "Otros ahorros"]
            };
        }

        if (currentItem.Tipo === "Inversión") {
            return {
                availableCategories: ["Activos Financieros"],
                availableSubcategories: ["Acciones", "Cedears", "Bonos", "ETFs", "Cripto", "Otros activos"]
            };
        }

        // Egreso or Ingreso from dynamicCategories
        const typeCats = dynamicCategories.filter(c => c.type === currentItem.Tipo);
        if (typeCats.length > 0) {
            const catNames = typeCats.map(c => c.name);
            const selectedCatObj = typeCats.find(c => c.name === currentItem.Categoría);
            const subcats = selectedCatObj ? selectedCatObj.subcategories : [];
            return {
                availableCategories: catNames,
                availableSubcategories: subcats
            };
        }

        // Fallback to static CATEGORIES if dynamic categories not yet loaded
        const fallbackMap = CATEGORIES[currentItem.Tipo as keyof typeof CATEGORIES] || {};
        const fallbackCatNames = Object.keys(fallbackMap);
        const fallbackSubcats = (fallbackMap as Record<string, string[]>)[currentItem.Categoría] || [];
        return {
            availableCategories: fallbackCatNames,
            availableSubcategories: fallbackSubcats
        };
    }, [currentItem.Tipo, currentItem.Categoría, dynamicCategories, dynamicSavingsGoals]);

    // Drag and Drop listeners
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
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith("image/") || file.type === "application/pdf") {
                void processWithAI(file);
            }
        }
    };

    return (
        <div
            className={styles.overlay}
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSaving && !isProcessingAI) {
                    onClose();
                }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className={`${styles.modal} ${isDragging ? styles.dragActive : ""}`} role="dialog" aria-modal="true">
                {/* Header Bar matching reference image: Close button left, Guardar button right */}
                <div className={styles.header}>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={onClose}
                        disabled={isSaving || isProcessingAI}
                        aria-label="Cerrar modal"
                    >
                        ✕
                    </button>

                    <button
                        type="button"
                        className={styles.headerSaveBtn}
                        onClick={handleSave}
                        disabled={!isFormValid() || isSaving || isProcessingAI}
                        aria-label="Guardar movimiento"
                    >
                        {isSaving ? "Guardando..." : "Guardar"}
                    </button>
                </div>

                <div className={styles.scrollArea}>
                    {/* Multi-item banner if AI OCR extracted multiple items */}
                    {editableItems.length > 1 && (
                        <div className={styles.multiItemNav}>
                            <span className={styles.multiItemTitle}>
                                Ítem {currentIndex + 1} de {editableItems.length} (Total: ${calculateTotal()})
                            </span>
                            <div className={styles.multiItemActions}>
                                <button
                                    type="button"
                                    className={styles.navArrowBtn}
                                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                                    disabled={currentIndex === 0}
                                    title="Ítem anterior"
                                >
                                    ◀
                                </button>
                                <button
                                    type="button"
                                    className={styles.navArrowBtn}
                                    onClick={() => setCurrentIndex((prev) => Math.min(editableItems.length - 1, prev + 1))}
                                    disabled={currentIndex === editableItems.length - 1}
                                    title="Siguiente ítem"
                                >
                                    ▶
                                </button>
                                <button
                                    type="button"
                                    className={styles.navArrowBtn}
                                    onClick={handleAddNewItem}
                                    title="Agregar otro ítem"
                                >
                                    ＋
                                </button>
                                <button
                                    type="button"
                                    className={styles.navArrowBtn}
                                    style={{ color: "var(--danger-color)" }}
                                    onClick={handleRemoveCurrentItem}
                                    title="Eliminar este ítem"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Segmented Toggle: Gasto / Ingreso / Ahorro / Inversión */}
                    <div className={styles.typeToggleWrapper}>
                        <div className={styles.segmentedControl}>
                            <button
                                type="button"
                                className={`${styles.segmentedBtn} ${currentItem.Tipo === "Egreso" ? `${styles.segmentedBtnActive} ${styles.segmentedBtnActiveGasto}` : ""}`}
                                onClick={() => handleTypeChange("Egreso")}
                            >
                                <span>Gasto</span>
                            </button>
                            <button
                                type="button"
                                className={`${styles.segmentedBtn} ${currentItem.Tipo === "Ingreso" ? `${styles.segmentedBtnActive} ${styles.segmentedBtnActiveIngreso}` : ""}`}
                                onClick={() => handleTypeChange("Ingreso")}
                            >
                                <span>Ingreso</span>
                            </button>
                            <button
                                type="button"
                                className={`${styles.segmentedBtn} ${currentItem.Tipo === "Ahorro" ? `${styles.segmentedBtnActive} ${styles.segmentedBtnActiveAhorro}` : ""}`}
                                onClick={() => handleTypeChange("Ahorro")}
                            >
                                <span>Ahorro</span>
                            </button>
                            <button
                                type="button"
                                className={`${styles.segmentedBtn} ${currentItem.Tipo === "Inversión" ? `${styles.segmentedBtnActive} ${styles.segmentedBtnActiveInversion}` : ""}`}
                                onClick={() => handleTypeChange("Inversión")}
                            >
                                <span>Inversión</span>
                            </button>
                        </div>
                    </div>

                    {/* Operación para Inversión: Compra / Aporte vs Venta / Rescate */}
                    {currentItem.Tipo === "Inversión" && (
                        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <button
                                type="button"
                                onClick={() => setInvOperation("Compra")}
                                style={{
                                    flex: 1,
                                    padding: "8px 12px",
                                    borderRadius: "10px",
                                    border: invOperation === "Compra" ? "1px solid #8b5cf6" : "1px solid var(--glass-border)",
                                    background: invOperation === "Compra" ? "rgba(139, 92, 246, 0.18)" : "var(--bg-color)",
                                    color: invOperation === "Compra" ? "var(--text-main)" : "var(--text-muted)",
                                    fontWeight: invOperation === "Compra" ? 700 : 500,
                                    fontSize: "0.85rem",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease"
                                }}
                            >
                                🟢 Compra / Aporte (Salida de caja)
                            </button>
                            <button
                                type="button"
                                onClick={() => setInvOperation("Venta")}
                                style={{
                                    flex: 1,
                                    padding: "8px 12px",
                                    borderRadius: "10px",
                                    border: invOperation === "Venta" ? "1px solid #8b5cf6" : "1px solid var(--glass-border)",
                                    background: invOperation === "Venta" ? "rgba(139, 92, 246, 0.18)" : "var(--bg-color)",
                                    color: invOperation === "Venta" ? "var(--text-main)" : "var(--text-muted)",
                                    fontWeight: invOperation === "Venta" ? 700 : 500,
                                    fontSize: "0.85rem",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease"
                                }}
                            >
                                🔴 Venta / Rescate (Entrada a caja)
                            </button>
                        </div>
                    )}

                    {/* MONTO Section con Selector ARS / USD (MEP) */}
                    <div className={styles.sectionBlock}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label className={styles.sectionLabel} htmlFor="trx-amount">
                                Monto
                            </label>
                            {currency === "USD" && mepRate && (
                                <span style={{ fontSize: "0.75rem", color: "#8b5cf6", fontWeight: 600 }}>
                                    Dólar MEP: ${mepRate} · Equivalente: {fmt(parseSafeAmount(currentItem.Monto) * mepRate)}
                                </span>
                            )}
                        </div>
                        <div className={styles.amountCard}>
                            <div 
                                className={styles.currencyBadge}
                                onClick={() => setCurrency(currency === "ARS" ? "USD" : "ARS")}
                                title="Cambiar divisa ARS / USD (conversión automática al Dólar MEP)"
                                style={{ cursor: "pointer", userSelect: "none" }}
                            >
                                <span>{currency}</span>
                                <span className={styles.currencyArrow}>▾</span>
                            </div>
                            <div className={styles.amountDivider} />
                            <div className={styles.amountInputWrapper}>
                                <span className={styles.amountPrefix}>{currency === "USD" ? "u$s" : "$"}</span>
                                <input
                                    id="trx-amount"
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    min="0"
                                    className={styles.amountInput}
                                    placeholder="0,00"
                                    value={currentItem.Monto}
                                    onChange={(e) => handleFieldChange("Monto", e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>

                    {/* Grid of Fields: Categoría & Subcategoría, Nota & Fecha */}
                    <div className={styles.formGrid}>
                        {/* Categoría */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="trx-category">
                                Categoría
                            </label>
                            <select
                                id="trx-category"
                                className={styles.selectStyle}
                                value={currentItem.Categoría}
                                onChange={(e) => {
                                    handleFieldChange("Categoría", e.target.value);
                                    handleFieldChange("Subcategoría", "");
                                }}
                            >
                                <option value="">Seleccionar</option>
                                {availableCategories.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Subcategoría */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="trx-subcategory">
                                Subcategoría
                            </label>
                            <select
                                id="trx-subcategory"
                                className={styles.selectStyle}
                                value={currentItem.Subcategoría}
                                onChange={(e) => handleFieldChange("Subcategoría", e.target.value)}
                                disabled={!currentItem.Categoría}
                            >
                                <option value="">
                                    {currentItem.Categoría ? "Seleccionar" : "- Elige categoría -"}
                                </option>
                                {availableSubcategories.map((subCat) => (
                                    <option key={subCat} value={subCat}>
                                        {subCat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Nota (Opcional) */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="trx-comment">
                                Nota (Opcional)
                            </label>
                            <input
                                id="trx-comment"
                                type="text"
                                className={styles.inputStyle}
                                placeholder='Ej: "Aporte a Fondo de Emergencia" o "10 AAPL"'
                                value={currentItem.Comentario}
                                onChange={(e) => handleFieldChange("Comentario", e.target.value)}
                            />
                        </div>

                        {/* Fecha */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="trx-date">
                                Fecha
                            </label>
                            <div className={styles.dateWrapper}>
                                <span className={styles.dateIcon}>📅</span>
                                <input
                                    id="trx-date"
                                    type="date"
                                    className={`${styles.inputStyle} ${styles.dateInput}`}
                                    value={toIsoDate(currentItem.Fecha)}
                                    onChange={(e) => handleFieldChange("Fecha", fromIsoDate(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Opciones Adicionales (sólo para Gastos o OCR) */}
                    <div className={styles.optionsSection}>
                        <div className={styles.optionsTitle}>
                            <span>Opciones adicionales</span>
                        </div>
                        <div className={styles.optionsPills}>
                            {/* Cuotas Pill (Sólo para Gastos) */}
                            {currentItem.Tipo === "Egreso" && (
                                <button
                                    type="button"
                                    className={`${styles.optionPill} ${isInstalmentMode ? styles.optionPillActive : ""}`}
                                    onClick={() => {
                                        const next = !isInstalmentMode;
                                        setIsInstalmentMode(next);
                                        if (next && !instalmentConcept) {
                                            setInstalmentConcept(currentItem.Comentario || currentItem.Subcategoría || "Compra en cuotas");
                                        }
                                    }}
                                >
                                    <span>💳</span>
                                    <span>{isInstalmentMode ? "Pagar en cuotas ✓" : "+ Pagar en cuotas"}</span>
                                </button>
                            )}

                            {/* Scan Ticket Pill */}
                            <label className={styles.optionPill} style={{ cursor: "pointer" }}>
                                <span>📸</span>
                                <span>{isProcessingAI ? "Escaneando..." : "Escanear comprobante"}</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*, application/pdf"
                                    capture="environment"
                                    className={styles.hiddenInput}
                                    disabled={isProcessingAI}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            void processWithAI(e.target.files[0]);
                                            e.target.value = "";
                                        }
                                    }}
                                />
                            </label>

                            {/* Text AI prompt */}
                            <button
                                type="button"
                                className={`${styles.optionPill} ${showAiPrompt ? styles.optionPillActive : ""}`}
                                onClick={() => setShowAiPrompt(!showAiPrompt)}
                            >
                                <span>✨</span>
                                <span>Autocompletar con IA</span>
                            </button>
                        </div>
                    </div>

                    {/* Expandable AI Prompt Input */}
                    {showAiPrompt && (
                        <div className={styles.cuotasCard}>
                            <label className={styles.label}>Escribe lo que gastaste, ingresaste o invertiste</label>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <input
                                    type="text"
                                    className={styles.inputStyle}
                                    placeholder='Ej: "Invertí 50000 en CEDEARs de Apple" o "Gasté 4500 en farmacia"'
                                    value={aiTextPrompt}
                                    onChange={(e) => setAiTextPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && aiTextPrompt.trim()) {
                                            e.preventDefault();
                                            void processWithAI(undefined, aiTextPrompt);
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className={styles.saveBtn}
                                    onClick={() => processWithAI(undefined, aiTextPrompt)}
                                    disabled={isProcessingAI || !aiTextPrompt.trim()}
                                >
                                    {isProcessingAI ? "..." : "✨ Procesar"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Expandable Cuotas Configuration */}
                    {isInstalmentMode && currentItem.Tipo === "Egreso" && (
                        <div className={styles.cuotasCard}>
                            <div className={styles.cuotasDesc}>
                                El monto total <strong>${calculateTotal()}</strong> se registrará hoy como devengado y se proyectará en pagos futuros en tu dashboard de Cuotas.
                            </div>

                            <div className={styles.cuotasGrid}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Concepto</label>
                                    <input
                                        type="text"
                                        className={styles.inputStyle}
                                        value={instalmentConcept}
                                        onChange={(e) => setInstalmentConcept(e.target.value)}
                                        placeholder="Ej: Zapatillas"
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Cantidad de Cuotas</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="72"
                                        className={styles.inputStyle}
                                        value={instalmentsCount}
                                        onChange={(e) => setInstalmentsCount(e.target.value)}
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Tarjeta (Opcional)</label>
                                    <select
                                        className={styles.selectStyle}
                                        value={selectedTarjeta}
                                        onChange={(e) => setSelectedTarjeta(e.target.value)}
                                    >
                                        <option value="">- Ninguna / General -</option>
                                        {tarjetas.map((t) => (
                                            <option key={t.id} value={t.nombre}>
                                                {t.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Mes de Inicio (MM/YYYY)</label>
                                    <input
                                        type="text"
                                        className={styles.inputStyle}
                                        value={startMonth}
                                        onChange={(e) => setStartMonth(e.target.value)}
                                        placeholder="MM/YYYY"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div
                        style={{
                            background: "rgba(239, 68, 68, 0.15)",
                            borderTop: "1px solid var(--danger-color)",
                            padding: "12px 20px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.85rem",
                            color: "var(--text-main)"
                        }}
                    >
                        <span>⚠️ {errorMsg}</span>
                        <button
                            type="button"
                            onClick={() => setErrorMsg(null)}
                            style={{
                                background: "none",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                fontSize: "1rem"
                            }}
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

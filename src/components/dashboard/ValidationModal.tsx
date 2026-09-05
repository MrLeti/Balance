"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./ValidationModal.module.css";
import { CATEGORIES, ExtractedItem, TrxType, CategoryItem } from "@/lib/constants";
import { parseSafeAmount, fmt } from "@/lib/utils/format";

interface ValidationModalProps {
    items?: ExtractedItem[];
    initialType?: TrxType;
    onClose: () => void;
    onSuccess: () => void;
}

// Image compression helper for mobile uploads to prevent Vercel 413 error
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
    const hasInitialItems = Boolean(items && items.length > 0);

    const initialItems = hasInitialItems
        ? (items || []).map(item => ({
            Fecha: item.Fecha || getTodayFormatted(),
            Tipo: (item.Tipo as TrxType) || defaultType,
            Categoría: item.Categoría || "",
            Subcategoría: item.Subcategoría || "",
            Monto: item.Monto !== undefined && item.Monto !== null ? String(item.Monto) : "",
            Comentario: item.Comentario || "",
            isConfirmed: false // Starts unchecked so user reviews and marks them, or clicks "Seleccionar todos"
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
    // If opened with items (e.g. from ticket OCR), default to list view
    const [viewMode, setViewMode] = useState<"list" | "single">(hasInitialItems ? "list" : "single");
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

    // AI & Scanning state (AI analyze input is always visible)
    const [isProcessingAI, setIsProcessingAI] = useState(false);
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

    // Selection helper computations
    const allConfirmed = editableItems.length > 0 && editableItems.every(i => i.isConfirmed);
    const someConfirmed = editableItems.some(i => i.isConfirmed);
    const confirmedCount = editableItems.filter(i => i.isConfirmed).length;
    const hasConfirmedEgreso = editableItems.some(i => i.isConfirmed && i.Tipo === "Egreso");

    const handleToggleConfirm = (index: number) => {
        setEditableItems(prev =>
            prev.map((item, i) => i === index ? { ...item, isConfirmed: !item.isConfirmed } : item)
        );
    };

    const handleToggleAll = () => {
        const nextState = !allConfirmed;
        setEditableItems(prev =>
            prev.map(item => ({ ...item, isConfirmed: nextState }))
        );
    };

    const handleFieldChange = (index: number, field: keyof ExtractedItem, value: string) => {
        setEditableItems(prev =>
            prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        );
    };

    const handleTypeChange = (index: number, newType: TrxType) => {
        setEditableItems(prev =>
            prev.map((item, i) => {
                if (i === index) {
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

    const handleAddNewItem = () => {
        const newItem = {
            Fecha: getTodayFormatted(),
            Tipo: defaultType,
            Categoría: "",
            Subcategoría: "",
            Monto: "",
            Comentario: "",
            isConfirmed: true
        };
        setEditableItems(prev => [...prev, newItem]);
        setViewMode("list");
    };

    const handleRemoveItem = (index: number) => {
        if (editableItems.length <= 1) {
            setEditableItems([{
                Fecha: getTodayFormatted(),
                Tipo: defaultType,
                Categoría: "",
                Subcategoría: "",
                Monto: "",
                Comentario: "",
                isConfirmed: true
            }]);
            return;
        }
        setEditableItems(prev => prev.filter((_, i) => i !== index));
    };

    // Calculate totals in ARS
    const calculateGlobalTotal = () => {
        const rawTotal = editableItems.reduce((acc, curr) => acc + parseSafeAmount(curr.Monto), 0);
        if (currency === "USD" && mepRate && mepRate > 0) {
            return (rawTotal * mepRate).toFixed(2);
        }
        return rawTotal.toFixed(2);
    };

    const calculateConfirmedTotal = () => {
        const rawTotal = editableItems
            .filter(i => i.isConfirmed)
            .reduce((acc, curr) => acc + parseSafeAmount(curr.Monto), 0);
        if (currency === "USD" && mepRate && mepRate > 0) {
            return (rawTotal * mepRate).toFixed(2);
        }
        return rawTotal.toFixed(2);
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
                    Tipo: (it.Tipo as TrxType) || defaultType,
                    Categoría: it.Categoría || "",
                    Subcategoría: it.Subcategoría || "",
                    Monto: it.Monto !== undefined && it.Monto !== null ? String(it.Monto) : "",
                    Comentario: it.Comentario || "",
                    isConfirmed: false // User reviews and checks individual items, or uses "Seleccionar todos"
                }));
                setEditableItems(newItems);
                setViewMode("list"); // Automatically activate list view for reviewing ticket/invoice items!
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

    // Helper to get available categories and subcategories for a given item
    const getRowCategoryOptions = (tipo: TrxType, currentCategory: string) => {
        if (tipo === "Ahorro") {
            const cats = ["Aporte", "Retiro"];
            const subcats = dynamicSavingsGoals.length > 0
                ? dynamicSavingsGoals
                : ["Fondo de Emergencia", "General", "Viaje", "Nueva PC", "Auto", "Otros ahorros"];
            return { categories: cats, subcategories: subcats };
        }

        if (tipo === "Inversión") {
            const cats = ["Activos Financieros"];
            const subcats = ["Acciones", "Cedears", "Bonos", "ETFs", "Cripto", "Otros activos"];
            return { categories: cats, subcategories: subcats };
        }

        const typeCats = dynamicCategories.filter(c => c.type === tipo);
        if (typeCats.length > 0) {
            const catNames = typeCats.map(c => c.name);
            const foundCat = typeCats.find(c => c.name === currentCategory);
            return {
                categories: catNames,
                subcategories: foundCat ? foundCat.subcategories : []
            };
        }

        const fallbackMap = CATEGORIES[tipo as keyof typeof CATEGORIES] || {};
        const fallbackCats = Object.keys(fallbackMap);
        const fallbackSubcats = (fallbackMap as Record<string, string[]>)[currentCategory] || [];
        return {
            categories: fallbackCats,
            subcategories: fallbackSubcats
        };
    };

    const handleEnableInstalmentMode = () => {
        const confirmedEgresos = editableItems.filter(i => i.isConfirmed && i.Tipo === "Egreso");
        if (confirmedEgresos.length === 0) {
            setErrorMsg("Seleccioná al menos un ítem de tipo Gasto para pagar en cuotas.");
            return;
        }

        let initialConcept = "Varias compras";
        if (confirmedEgresos.length === 1) {
            initialConcept = confirmedEgresos[0].Comentario || confirmedEgresos[0].Subcategoría || "Compra en cuotas";
        }
        setInstalmentConcept(initialConcept);
        setIsInstalmentMode(true);
    };

    const isFormValid = () => {
        if (editableItems.length === 0) return false;
        const confirmedItems = editableItems.filter(i => i.isConfirmed);
        if (confirmedItems.length === 0) return false;

        const hasValidAmounts = confirmedItems.every(i => {
            const amt = parseSafeAmount(i.Monto);
            if (amt === 0 || isNaN(amt)) return false;
            if ((i.Tipo === "Ingreso" || i.Tipo === "Inversión") && amt < 0) return false;
            return true;
        });
        if (!hasValidAmounts) return false;

        if (isInstalmentMode) {
            const tot = parseFloat(calculateConfirmedTotal());
            const count = parseInt(instalmentsCount, 10);
            if (isNaN(tot) || tot <= 0 || isNaN(count) || count < 1) return false;
        }
        return true;
    };

    const handleSave = async (withInstalment = false) => {
        if (!isFormValid() || isSaving) return;
        setIsSaving(true);
        setErrorMsg(null);

        let cuotaId = "";

        try {
            // 1. Si eligió cuotas (sólo para los egresos confirmados)
            if (withInstalment) {
                const totalAmount = parseFloat(calculateConfirmedTotal());
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

                const concept = instalmentConcept.trim() || "Compra en cuotas";

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

            // 2. Formatear para backend en ARS ÚNICAMENTE los ítems marcados con isConfirmed: true
            const rowsToInsert = editableItems
                .filter((item) => {
                    if (!item.isConfirmed) return false;
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
                        item.Tipo === "Egreso" ? cuotaId : ""
                    ];
                });

            if (rowsToInsert.length === 0) {
                throw new Error("Por favor seleccioná al menos un ítem con monto válido.");
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
            // Rollback compensatorio si la cuota se creó pero la transacción falló
            if (cuotaId) {
                try {
                    await fetch(`/api/cuotas/${cuotaId}`, { method: "DELETE" });
                    console.info(`Rollback ejecutado: cuota ${cuotaId} eliminada tras falla en transacciones.`);
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

    // Single item reference for single-item form mode
    const singleItem = editableItems[0] || {
        Fecha: getTodayFormatted(),
        Tipo: defaultType,
        Categoría: "",
        Subcategoría: "",
        Monto: "",
        Comentario: "",
        isConfirmed: true
    };
    const singleOptions = getRowCategoryOptions(singleItem.Tipo as TrxType, singleItem.Categoría);

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
            <div 
                className={`${styles.modal} ${viewMode === "list" ? styles.modalList : ""} ${isDragging ? styles.dragActive : ""}`} 
                role="dialog" 
                aria-modal="true"
            >
                {/* Header Bar */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <button
                            type="button"
                            className={styles.closeBtn}
                            onClick={onClose}
                            disabled={isSaving || isProcessingAI}
                            aria-label="Cerrar modal"
                        >
                            ✕
                        </button>
                        <div className={styles.titleWrapper}>
                            <h2 className={styles.title}>
                                {isInstalmentMode 
                                    ? "Configurar Cuotas" 
                                    : viewMode === "list" 
                                        ? "Revisar y Confirmar Comprobante" 
                                        : "Nuevo Movimiento"}
                            </h2>
                            {viewMode === "list" && !isInstalmentMode && (
                                <span className={styles.itemCountBadge}>
                                    {editableItems.length} {editableItems.length === 1 ? "ítem detectado" : "ítems detectados"}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className={styles.headerRight}>
                        {/* Scan ticket button */}
                        <label 
                            className={styles.actionPillBtn} 
                            title="Escanear ticket o factura (foto / PDF)"
                            style={{ cursor: isProcessingAI ? "wait" : "pointer" }}
                        >
                            <span>📸</span>
                            <span className={styles.actionPillText}>{isProcessingAI ? "Escaneando..." : "Escanear ticket"}</span>
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

                        {/* View Mode Toggle when entering manually */}
                        {editableItems.length <= 1 && !isInstalmentMode && (
                            <button
                                type="button"
                                className={styles.viewModeToggleBtn}
                                onClick={() => setViewMode(viewMode === "list" ? "single" : "list")}
                                title={viewMode === "list" ? "Cambiar a formulario simple" : "Cambiar a vista de lista"}
                            >
                                {viewMode === "list" ? "📝 Formulario" : "📋 Modo Lista"}
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.scrollArea}>
                    {/* ALWAYS VISIBLE AI ANALYZE BAR WITH ROTATING GLOWING AURA */}
                    {!isInstalmentMode && (
                        <div className={styles.aiGlowOuter}>
                            {/* Layer 1: Soft, intense rotating outer glow */}
                            <div className={styles.aiGlowBlur} aria-hidden="true" />
                            {/* Layer 2: Rotating border with inner card */}
                            <div className={styles.aiPromptContainer}>
                                <div className={styles.aiPromptCard}>
                                    <div className={styles.aiPromptHeader}>
                                        <span className={styles.aiSparkleIcon}>✨</span>
                                        <span className={styles.aiPromptTitle}>Analizar con IA</span>
                                        <span className={styles.aiPromptHint}>
                                            Escribí o pegá lo que compraste (ej: &quot;4500 en súper y 1200 en farmacia&quot;)
                                        </span>
                                    </div>
                                    <div className={styles.aiPromptInputRow}>
                                        <input
                                            type="text"
                                            className={styles.aiInputField}
                                            placeholder='Escribí lo que compraste, gastaste o ingresaste...'
                                            value={aiTextPrompt}
                                            onChange={(e) => setAiTextPrompt(e.target.value)}
                                            disabled={isProcessingAI}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && aiTextPrompt.trim() && !isProcessingAI) {
                                                    e.preventDefault();
                                                    void processWithAI(undefined, aiTextPrompt);
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className={styles.aiAnalyzeBtn}
                                            onClick={() => processWithAI(undefined, aiTextPrompt)}
                                            disabled={isProcessingAI || !aiTextPrompt.trim()}
                                        >
                                            {isProcessingAI ? (
                                                <>
                                                    <span className={styles.spinIcon}>⏳</span>
                                                    <span>Analizando...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>✨</span>
                                                    <span>Analizar</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW MODE 1: CUOTAS CONFIGURATION */}
                    {isInstalmentMode ? (
                        <div className={styles.cuotasCard}>
                            <div className={styles.cuotasDesc}>
                                El monto total confirmado de <strong>${calculateConfirmedTotal()}</strong> se registrará hoy como gasto devengado y se proyectará en pagos futuros en tu calendario de Cuotas.
                            </div>

                            <div className={styles.cuotasGrid}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Concepto</label>
                                    <input
                                        type="text"
                                        className={styles.inputStyle}
                                        value={instalmentConcept}
                                        onChange={(e) => setInstalmentConcept(e.target.value)}
                                        placeholder="Ej: Compra Coto en cuotas"
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
                    ) : viewMode === "list" ? (
                        /* VIEW MODE 2: THE RESTORED LIST-BASED SYSTEM FOR INVOICES & TICKETS */
                        <div className={styles.listContainer}>
                            {/* Toolbar with "Seleccionar todos" and "＋ Agregar ítem" */}
                            <div className={styles.listToolbar}>
                                <label className={styles.selectAllLabel} title="Marcar o desmarcar todos los movimientos">
                                    <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={allConfirmed && editableItems.length > 0}
                                        onChange={handleToggleAll}
                                        aria-label="Seleccionar todos los movimientos"
                                    />
                                    <span className={styles.selectAllText}>
                                        {allConfirmed ? "Deseleccionar todos" : "Seleccionar todos los movimientos"}
                                    </span>
                                    <span className={styles.selectionCounter}>
                                        ({confirmedCount} de {editableItems.length} marcados)
                                    </span>
                                </label>

                                <div className={styles.toolbarActions}>
                                    <button
                                        type="button"
                                        className={styles.addBtnSmall}
                                        onClick={handleAddNewItem}
                                    >
                                        <span>＋</span> Agregar fila
                                    </button>
                                </div>
                            </div>

                            {/* Responsive Table / Cards */}
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th className={styles.thCheckbox} style={{ textAlign: "center" }}>
                                                <input
                                                    type="checkbox"
                                                    className={styles.checkbox}
                                                    checked={allConfirmed && editableItems.length > 0}
                                                    onChange={handleToggleAll}
                                                    title="Seleccionar todos"
                                                    aria-label="Seleccionar todos"
                                                />
                                            </th>
                                            <th className={styles.thFecha}>Fecha</th>
                                            <th className={styles.thTipo}>Tipo</th>
                                            <th className={styles.thCategoria}>Categoría</th>
                                            <th className={styles.thSubcategoria}>Subcategoría</th>
                                            <th className={styles.thComentario}>Detalle / Producto</th>
                                            <th className={styles.thMonto} style={{ textAlign: "right" }}>Monto</th>
                                            <th className={styles.thActions} style={{ textAlign: "center" }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editableItems.map((item, index) => {
                                            const options = getRowCategoryOptions(item.Tipo as TrxType, item.Categoría);

                                            return (
                                                <tr
                                                    key={index}
                                                    className={`${item.isConfirmed ? styles.rowConfirmed : styles.rowUnconfirmed}`}
                                                >
                                                    {/* 1. Checkbox */}
                                                    <td className={styles.cellCheckbox}>
                                                        <label className={styles.checkboxLabel}>
                                                            <input
                                                                type="checkbox"
                                                                className={styles.checkbox}
                                                                checked={item.isConfirmed}
                                                                onChange={() => handleToggleConfirm(index)}
                                                                aria-label={`Seleccionar ítem ${index + 1}`}
                                                            />
                                                            <span className={styles.itemIndexBadge}>#{index + 1}</span>
                                                        </label>
                                                    </td>

                                                    {/* 2. Fecha */}
                                                    <td className={styles.cellFecha}>
                                                        <input
                                                            type="date"
                                                            className={styles.inputStyle}
                                                            value={toIsoDate(item.Fecha)}
                                                            onChange={(e) => handleFieldChange(index, "Fecha", fromIsoDate(e.target.value))}
                                                            title="Fecha del movimiento"
                                                        />
                                                    </td>

                                                    {/* 3. Tipo */}
                                                    <td className={styles.cellTipo}>
                                                        <select
                                                            className={`${styles.selectStyle} ${
                                                                item.Tipo === "Egreso" ? styles.selectTipoEgreso :
                                                                item.Tipo === "Ingreso" ? styles.selectTipoIngreso :
                                                                item.Tipo === "Ahorro" ? styles.selectTipoAhorro :
                                                                styles.selectTipoInversion
                                                            }`}
                                                            value={item.Tipo}
                                                            onChange={(e) => handleTypeChange(index, e.target.value as TrxType)}
                                                        >
                                                            <option value="Egreso">Egreso</option>
                                                            <option value="Ingreso">Ingreso</option>
                                                            <option value="Ahorro">Ahorro</option>
                                                            <option value="Inversión">Inversión</option>
                                                        </select>
                                                    </td>

                                                    {/* 4. Categoría */}
                                                    <td className={styles.cellCategoria}>
                                                        <select
                                                            className={styles.selectStyle}
                                                            value={item.Categoría}
                                                            onChange={(e) => {
                                                                handleFieldChange(index, "Categoría", e.target.value);
                                                                handleFieldChange(index, "Subcategoría", "");
                                                            }}
                                                        >
                                                            <option value="">- Categoría -</option>
                                                            {options.categories.map((cat) => (
                                                                <option key={cat} value={cat}>{cat}</option>
                                                            ))}
                                                        </select>
                                                    </td>

                                                    {/* 5. Subcategoría */}
                                                    <td className={styles.cellSubcategoria}>
                                                        <select
                                                            className={styles.selectStyle}
                                                            value={item.Subcategoría}
                                                            onChange={(e) => handleFieldChange(index, "Subcategoría", e.target.value)}
                                                            disabled={!item.Categoría}
                                                        >
                                                            <option value="">{item.Categoría ? "- Subcategoría -" : "- Elegí cat -"}</option>
                                                            {options.subcategories.map((sub) => (
                                                                <option key={sub} value={sub}>{sub}</option>
                                                            ))}
                                                        </select>
                                                    </td>

                                                    {/* 6. Comentario */}
                                                    <td className={styles.cellComentario}>
                                                        <input
                                                            type="text"
                                                            className={styles.inputStyle}
                                                            placeholder="Descripción o producto..."
                                                            value={item.Comentario}
                                                            onChange={(e) => handleFieldChange(index, "Comentario", e.target.value)}
                                                        />
                                                    </td>

                                                    {/* 7. Monto */}
                                                    <td className={styles.cellMonto}>
                                                        <div className={styles.montoWrapper}>
                                                            <span className={styles.montoPrefix}>$</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                className={`${styles.inputStyle} ${styles.inputNum}`}
                                                                placeholder="0,00"
                                                                value={item.Monto}
                                                                onChange={(e) => handleFieldChange(index, "Monto", e.target.value)}
                                                            />
                                                        </div>
                                                    </td>

                                                    {/* 8. Acciones (Eliminar) */}
                                                    <td className={styles.cellActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.deleteRowBtn}
                                                            onClick={() => handleRemoveItem(index)}
                                                            title="Eliminar este ítem"
                                                            aria-label={`Eliminar ítem ${index + 1}`}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* VIEW MODE 3: SINGLE QUICK FORM */
                        <div className={styles.singleFormContainer}>
                            {/* Segmented Toggle: Gasto / Ingreso / Ahorro / Inversión */}
                            <div className={styles.typeToggleWrapper}>
                                <div className={styles.segmentedControl}>
                                    <button
                                        type="button"
                                        className={`${styles.segmentedBtn} ${singleItem.Tipo === "Egreso" ? `${styles.segmentedBtnActive} ${styles.segmentedBtnActiveGasto}` : ""}`}
                                        onClick={() => handleTypeChange(0, "Egreso")}
                                    >
                                        <span>Gasto</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.segmentedBtn} ${singleItem.Tipo === "Ingreso" ? `${styles.segmentedBtnActive} ${styles.segmentedBtnActiveIngreso}` : ""}`}
                                        onClick={() => handleTypeChange(0, "Ingreso")}
                                    >
                                        <span>Ingreso</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.segmentedBtn} ${singleItem.Tipo === "Ahorro" ? `${styles.segmentedBtnActive} ${styles.segmentedBtnActiveAhorro}` : ""}`}
                                        onClick={() => handleTypeChange(0, "Ahorro")}
                                    >
                                        <span>Ahorro</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.segmentedBtn} ${singleItem.Tipo === "Inversión" ? `${styles.segmentedBtnActive} ${styles.segmentedBtnActiveInversion}` : ""}`}
                                        onClick={() => handleTypeChange(0, "Inversión")}
                                    >
                                        <span>Inversión</span>
                                    </button>
                                </div>
                            </div>

                            {/* Operación para Inversión: Compra / Aporte vs Venta / Rescate */}
                            {singleItem.Tipo === "Inversión" && (
                                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                                    <button
                                        type="button"
                                        onClick={() => setInvOperation("Compra")}
                                        className={styles.invActionBtn}
                                        style={{
                                            border: invOperation === "Compra" ? "1px solid #8b5cf6" : "1px solid var(--glass-border)",
                                            background: invOperation === "Compra" ? "rgba(139, 92, 246, 0.18)" : "var(--bg-color)",
                                            color: invOperation === "Compra" ? "var(--text-main)" : "var(--text-muted)",
                                            fontWeight: invOperation === "Compra" ? 700 : 500,
                                        }}
                                    >
                                        🟢 Compra / Aporte (Salida)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInvOperation("Venta")}
                                        className={styles.invActionBtn}
                                        style={{
                                            border: invOperation === "Venta" ? "1px solid #8b5cf6" : "1px solid var(--glass-border)",
                                            background: invOperation === "Venta" ? "rgba(139, 92, 246, 0.18)" : "var(--bg-color)",
                                            color: invOperation === "Venta" ? "var(--text-main)" : "var(--text-muted)",
                                            fontWeight: invOperation === "Venta" ? 700 : 500,
                                        }}
                                    >
                                        🔴 Venta / Rescate (Entrada)
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
                                            Dólar MEP: ${mepRate} · Equivalente: {fmt(parseSafeAmount(singleItem.Monto) * mepRate)}
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
                                            value={singleItem.Monto}
                                            onChange={(e) => handleFieldChange(0, "Monto", e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Grid of Fields: Categoría & Subcategoría, Nota & Fecha */}
                            <div className={styles.formGrid}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label} htmlFor="trx-category">Categoría</label>
                                    <select
                                        id="trx-category"
                                        className={styles.selectStyle}
                                        value={singleItem.Categoría}
                                        onChange={(e) => {
                                            handleFieldChange(0, "Categoría", e.target.value);
                                            handleFieldChange(0, "Subcategoría", "");
                                        }}
                                    >
                                        <option value="">Seleccionar</option>
                                        {singleOptions.categories.map((cat) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.inputGroup}>
                                    <label className={styles.label} htmlFor="trx-subcategory">Subcategoría</label>
                                    <select
                                        id="trx-subcategory"
                                        className={styles.selectStyle}
                                        value={singleItem.Subcategoría}
                                        onChange={(e) => handleFieldChange(0, "Subcategoría", e.target.value)}
                                        disabled={!singleItem.Categoría}
                                    >
                                        <option value="">
                                            {singleItem.Categoría ? "Seleccionar" : "- Elige categoría -"}
                                        </option>
                                        {singleOptions.subcategories.map((subCat) => (
                                            <option key={subCat} value={subCat}>{subCat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.inputGroup}>
                                    <label className={styles.label} htmlFor="trx-comment">Nota (Opcional)</label>
                                    <input
                                        id="trx-comment"
                                        type="text"
                                        className={styles.inputStyle}
                                        placeholder='Ej: "Supermercado Coto" o "Aporte"'
                                        value={singleItem.Comentario}
                                        onChange={(e) => handleFieldChange(0, "Comentario", e.target.value)}
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label className={styles.label} htmlFor="trx-date">Fecha</label>
                                    <div className={styles.dateWrapper}>
                                        <span className={styles.dateIcon}>📅</span>
                                        <input
                                            id="trx-date"
                                            type="date"
                                            className={`${styles.inputStyle} ${styles.dateInput}`}
                                            value={toIsoDate(singleItem.Fecha)}
                                            onChange={(e) => handleFieldChange(0, "Fecha", fromIsoDate(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className={styles.errorBanner}>
                        <span>⚠️ {errorMsg}</span>
                        <button
                            type="button"
                            onClick={() => setErrorMsg(null)}
                            className={styles.errorDismissBtn}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Footer Bar */}
                <div className={styles.footer}>
                    <div className={styles.totalsGrid}>
                        <div className={styles.totalItem}>
                            <span className={styles.totalsLabel}>Total:</span>
                            <span className={styles.totalsValue}>${calculateGlobalTotal()}</span>
                        </div>
                        <div className={styles.totalItem}>
                            <span className={styles.totalsLabel} style={{ color: "var(--success-color)" }}>A guardar:</span>
                            <span className={styles.totalsValue} style={{ color: "var(--success-color)" }}>${calculateConfirmedTotal()}</span>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        {isInstalmentMode ? (
                            <>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => setIsInstalmentMode(false)}
                                    disabled={isSaving}
                                >
                                    Volver
                                </button>
                                <button
                                    type="button"
                                    className={styles.saveBtn}
                                    disabled={isSaving || !instalmentConcept || !instalmentsCount || !startMonth}
                                    onClick={() => handleSave(true)}
                                >
                                    {isSaving ? "Guardando..." : "Confirmar Compra + Cuotas"}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={onClose}
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </button>

                                {hasConfirmedEgreso && (
                                    <button
                                        type="button"
                                        className={styles.instalmentBtn}
                                        onClick={handleEnableInstalmentMode}
                                        disabled={isSaving || !someConfirmed}
                                    >
                                        💳 Pagar en Cuotas
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className={someConfirmed ? styles.saveBtn : styles.saveBtnDisabled}
                                    disabled={!someConfirmed || isSaving || editableItems.length === 0}
                                    onClick={() => handleSave(false)}
                                >
                                    {isSaving ? "Guardando..." : `Confirmar y Guardar (${confirmedCount})`}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

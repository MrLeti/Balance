import React, { useState, useMemo } from 'react';
import styles from "./TransactionsList.module.css";
import EditableTable, { ColumnDef, FilterDef } from "@/components/shared/EditableTable";
import { parseSafeAmount, fmt } from "@/lib/utils/format";

interface TransactionsListProps {
    transactions: (string | number)[][];
    totalCount: number;
    searchTerm?: string;
    setSearchTerm?: (term: string) => void;
    txLimit?: number;
    setTxLimit?: (limit: number) => void;
    onDelete: (tx: (string | number)[]) => void;
    onEdit: (id: string, field: string, value: unknown) => Promise<void>;
}

// Map array row → plain object for EditableTable
function rowToObj(row: (string | number)[]): Record<string, unknown> {
    return {
        id: row[0],
        date: row[1],
        type: row[2],
        category: row[3],
        sub_category: row[4],
        amount: row[5],
        comment: row[6],
        cuota_ref: row[7],
        investment_ref: row[8],
        _raw: row,  // keep original for delete
    };
}

const COLUMNS: ColumnDef[] = [
    { key: "date",         header: "Fecha",         editable: true,  type: "date",   width: "110px" },
    { key: "type",         header: "Tipo",          editable: true,  type: "select", options: ["Ingreso", "Egreso", "Ahorro", "Inversión"], width: "100px" },
    { key: "category",     header: "Categoría",     editable: true,  type: "text",   width: "140px" },
    { key: "sub_category", header: "Subcategoría",  editable: true,  type: "text",   width: "140px" },
    {
        key: "amount",
        header: "Importe",
        editable: true,
        type: "number",
        width: "130px",
        render: (val, row) => {
            const n = parseSafeAmount(val);
            const isIncome = row.type === "Ingreso";
            const isDiscount = row.type === "Egreso" && n < 0;
            const isSavingsOrInv = row.type === "Ahorro" || row.type === "Inversión";
            const color = isIncome
                ? "var(--success-color)"
                : isDiscount
                ? "var(--accent-color)"
                : isSavingsOrInv
                ? "var(--accent-color, #0061a4)"
                : "var(--danger-color)";
            const sign = isIncome ? "+" : isDiscount ? "🏷️ -" : "-";
            return <span style={{ color, fontWeight: 600 }}>{sign}{fmt(Math.abs(n))}</span>;
        }
    },
    { key: "comment",      header: "Comentario",    editable: true,  type: "text" },
];

export default function TransactionsList({
    transactions, totalCount, searchTerm, setSearchTerm, txLimit = 20, setTxLimit, onDelete, onEdit
}: TransactionsListProps) {
    const rows = useMemo(() => transactions.map(rowToObj), [transactions]);

    const handleDelete = (id: string) => {
        // Find original raw row and pass to parent
        const match = transactions.find(tx => String(tx[0]) === id);
        if (match) onDelete(match);
    };

    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

    // Build tree relationships: Tipo -> Categorías -> Subcategorías and detected months
    const {
        monthsDetected,
        typeToCategories,
        categoryToSubCategories,
        allCategories,
        allSubCategories,
    } = useMemo(() => {
        const monthsSet = new Set<string>();
        const typeCats = new Map<string, Set<string>>();
        const catSubs = new Map<string, Set<string>>();
        const cats = new Set<string>();
        const subs = new Set<string>();

        transactions.forEach((tx) => {
            const dateStr = String(tx[1] || '').trim();
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                monthsSet.add(`${parts[1]}/${parts[2]}`);
            }

            const type = String(tx[2] || '').trim();
            const cat = String(tx[3] || '').trim();
            const sub = String(tx[4] || '').trim();

            if (type) {
                if (!typeCats.has(type)) typeCats.set(type, new Set());
                if (cat) typeCats.get(type)!.add(cat);
            }
            if (cat) {
                cats.add(cat);
                if (!catSubs.has(cat)) catSubs.set(cat, new Set());
                if (sub) catSubs.get(cat)!.add(sub);
            }
            if (sub) {
                subs.add(sub);
            }
        });

        const sortedMonths = Array.from(monthsSet).sort((a, b) => {
            const [ma, ya] = a.split('/').map(Number);
            const [mb, yb] = b.split('/').map(Number);
            return (yb * 12 + mb) - (ya * 12 + ma);
        });

        return {
            monthsDetected: sortedMonths,
            typeToCategories: typeCats,
            categoryToSubCategories: catSubs,
            allCategories: Array.from(cats).sort((a, b) => a.localeCompare(b)),
            allSubCategories: Array.from(subs).sort((a, b) => a.localeCompare(b)),
        };
    }, [transactions]);

    // Dynamically filter categories based on selected Type
    const availableCategories = useMemo(() => {
        if (activeFilters.type && typeToCategories.has(activeFilters.type)) {
            return Array.from(typeToCategories.get(activeFilters.type)!).sort((a, b) => a.localeCompare(b));
        }
        return allCategories;
    }, [activeFilters.type, typeToCategories, allCategories]);

    // Dynamically filter subcategories based on selected Category (or Type)
    const availableSubCategories = useMemo(() => {
        if (activeFilters.category && categoryToSubCategories.has(activeFilters.category)) {
            return Array.from(categoryToSubCategories.get(activeFilters.category)!).sort((a, b) => a.localeCompare(b));
        }
        if (activeFilters.type && typeToCategories.has(activeFilters.type)) {
            const subsForType = new Set<string>();
            const catsForType = typeToCategories.get(activeFilters.type)!;
            catsForType.forEach((c) => {
                if (categoryToSubCategories.has(c)) {
                    categoryToSubCategories.get(c)!.forEach((s) => subsForType.add(s));
                }
            });
            return Array.from(subsForType).sort((a, b) => a.localeCompare(b));
        }
        return allSubCategories;
    }, [activeFilters.category, activeFilters.type, categoryToSubCategories, typeToCategories, allSubCategories]);

    // Handle filter transitions preserving tree hierarchy consistency
    const handleFilterChange = (key: string, value: string) => {
        setActiveFilters((prev) => {
            const next = { ...prev, [key]: value };

            // When Tipo changes: check if current category belongs to new type
            if (key === 'type') {
                if (value && next.category) {
                    const validCats = typeToCategories.get(value);
                    if (!validCats || !validCats.has(next.category)) {
                        next.category = '';
                        next.sub_category = '';
                    }
                }
            }

            // When Categoría changes: check if current subcategory belongs to new category
            if (key === 'category') {
                if (value && next.sub_category) {
                    const validSubs = categoryToSubCategories.get(value);
                    if (!validSubs || !validSubs.has(next.sub_category)) {
                        next.sub_category = '';
                    }
                } else if (!value) {
                    next.sub_category = '';
                }
            }

            // When Date preset changes away from 'custom', clear custom range
            if (key === 'date' && value !== 'custom') {
                delete next.date_from;
                delete next.date_to;
            }

            return next;
        });
    };

    // 4 Column Filters: Fecha (rango + presets), Tipo, Categoría, Subcategoría en cascada
    const filters: FilterDef[] = useMemo(() => {
        return [
            {
                key: "date",
                label: "Fecha",
                options: [
                    { value: "", label: "Todas las fechas" },
                    { value: "current_month", label: "📅 Este mes" },
                    { value: "last_month", label: "📅 Mes pasado" },
                    { value: "current_year", label: "📅 Este año" },
                    { value: "custom", label: "📆 Personalizado (Rango)..." },
                    ...monthsDetected.map((m) => ({ value: m, label: m })),
                ],
            },
            {
                key: "type",
                label: "Tipo",
                options: [
                    { value: "", label: "Todos los tipos" },
                    { value: "Ingreso", label: "Ingreso" },
                    { value: "Egreso", label: "Egreso" },
                    { value: "Ahorro", label: "Ahorro" },
                    { value: "Inversión", label: "Inversión" },
                ],
            },
            {
                key: "category",
                label: "Categoría",
                options: [
                    { value: "", label: "Todas las categorías" },
                    ...availableCategories.map((c) => ({ value: c, label: c })),
                ],
            },
            {
                key: "sub_category",
                label: "Subcategoría",
                options: [
                    { value: "", label: "Todas las subcategorías" },
                    ...availableSubCategories.map((s) => ({ value: s, label: s })),
                ],
            },
        ];
    }, [monthsDetected, availableCategories, availableSubCategories]);

    return (
        <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`}>
            <div className={styles.headerWithTabs} style={{ marginBottom: "16px" }}>
                <h3 className="text-muted" style={{ margin: 0 }}>Historial de Movimientos</h3>
            </div>
            <EditableTable
                columns={COLUMNS}
                rows={rows}
                onEdit={onEdit}
                onDelete={handleDelete}
                idField="id"
                searchable={true}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                defaultSortKey="date"
                defaultSortDir="desc"
                initialLimit={20}
                loadMoreLabel="Ver todos los movimientos"
                collapseLabel="Mostrar solo primeros 20 movimientos ☝️"
                onLimitChange={(newLimit) => {
                    if (newLimit === null && setTxLimit) {
                        setTxLimit(totalCount);
                    }
                }}
                emptyMessage="No hay movimientos registrados aún."
            />
            {/* Fallback load-more button only when totalCount exceeds both txLimit and current row slice (e.g. mock test harnesses) */}
            {totalCount > txLimit && rows.length <= 20 && (
                <button
                    type="button"
                    className={styles.loadMoreBtn}
                    onClick={() => setTxLimit?.(totalCount)}
                >
                    Ver Todos los Movimientos 👇
                </button>
            )}
        </section>
    );
}

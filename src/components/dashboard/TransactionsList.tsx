import React, { useMemo } from 'react';
import styles from "./DashboardData.module.css";
import EditableTable, { ColumnDef, FilterDef } from "@/components/shared/EditableTable";
import { parseSafeAmount, fmt } from "@/lib/utils/format";

interface TransactionsListProps {
    transactions: any[][];
    totalCount: number;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    txLimit: number;
    setTxLimit: (limit: number) => void;
    onDelete: (tx: any) => void;
    onEdit: (id: string, field: string, value: unknown) => Promise<void>;
}

// Map array row → plain object for EditableTable
function rowToObj(row: any[]): Record<string, unknown> {
    return {
        id: row[0],
        date: row[1],
        type: row[2],
        category: row[3],
        sub_category: row[4],
        amount: row[5],
        comment: row[6],
        cuota_ref: row[7],
        _raw: row,  // keep original for delete
    };
}

const COLUMNS: ColumnDef[] = [
    { key: "date",         header: "Fecha",         editable: true,  type: "date",   width: "110px" },
    { key: "type",         header: "Tipo",          editable: true,  type: "select", options: ["Ingreso", "Egreso"], width: "90px" },
    { key: "category",     header: "Categoría",     editable: true,  type: "text",   width: "130px" },
    { key: "sub_category", header: "Subcategoría",  editable: true,  type: "text",   width: "140px" },
    {
        key: "amount",
        header: "Importe",
        editable: true,
        type: "number",
        width: "120px",
        render: (val, row) => {
            const n = parseSafeAmount(val);
            const isDiscount = row.type === "Egreso" && n < 0;
            const color = row.type === "Ingreso"
                ? "var(--success-color)"
                : isDiscount ? "var(--accent-color)" : "var(--danger-color)";
            const sign = row.type === "Ingreso" ? "+" : isDiscount ? "🏷️ -" : "-";
            return <span style={{ color, fontWeight: 600 }}>{sign}{fmt(Math.abs(n))}</span>;
        }
    },
    { key: "comment",      header: "Comentario",    editable: true,  type: "text" },
];

const FILTERS: FilterDef[] = [
    {
        key: "type",
        label: "Tipo",
        options: [
            { value: "", label: "Todos" },
            { value: "Ingreso", label: "✅ Ingresos" },
            { value: "Egreso",  label: "📉 Egresos" },
        ]
    }
];

export default function TransactionsList({
    transactions, totalCount, searchTerm, setSearchTerm, txLimit, setTxLimit, onDelete, onEdit
}: TransactionsListProps) {
    const rows = useMemo(() => transactions.map(rowToObj), [transactions]);

    const handleDelete = (id: string) => {
        // Find original raw row and pass to parent
        const match = transactions.find(tx => String(tx[0]) === id);
        if (match) onDelete(match);
    };

    return (
        <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`}>
            <div className={styles.headerWithTabs} style={{ marginBottom: "16px" }}>
                <h3 className="text-muted">Historial de Movimientos</h3>
            </div>
            <EditableTable
                columns={COLUMNS}
                rows={rows}
                onEdit={onEdit}
                onDelete={handleDelete}
                idField="id"
                searchable={true}
                filters={FILTERS}
                defaultSortKey="date"
                defaultSortDir="desc"
                emptyMessage="No hay movimientos registrados aún."
            />
            {totalCount > txLimit && (
                <button className={styles.loadMoreBtn} onClick={() => setTxLimit(totalCount)}>
                    Ver Todos los Movimientos 👇
                </button>
            )}
        </section>
    );
}



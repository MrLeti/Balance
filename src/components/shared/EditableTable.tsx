import React, { useState, useMemo, useRef } from 'react';
import styles from './EditableTable.module.css';
import { parseArithmeticExpression } from '@/lib/utils/format';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDef {
  key: string;
  header: string;
  editable?: boolean;
  type?: 'text' | 'number' | 'date' | 'select' | 'readonly';
  options?: string[];
  width?: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  formatDisplay?: (value: unknown) => string;
}

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface EditableTableProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  onEdit?: (id: string, field: string, newValue: unknown) => Promise<void>;
  onDelete?: (id: string) => void;
  idField?: string;
  searchable?: boolean;
  filters?: FilterDef[];
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  emptyMessage?: string;
  isLoading?: boolean;
  initialLimit?: number;
  loadMoreLabel?: string;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function ddmmyyyy_to_htmldate(s: string): string {
  // 'DD/MM/YYYY' → 'YYYY-MM-DD'
  if (!s || typeof s !== 'string') return '';
  const parts = s.split('/');
  if (parts.length !== 3) return s;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function htmldate_to_ddmmyyyy(s: string): string {
  // 'YYYY-MM-DD' → 'DD/MM/YYYY'
  if (!s || typeof s !== 'string') return '';
  const parts = s.split('-');
  if (parts.length !== 3) return s;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditableTable(props: EditableTableProps) {
  const {
    columns,
    rows,
    onEdit,
    onDelete,
    idField = 'id',
    searchable = true,
    filters = [],
    defaultSortKey = '',
    defaultSortDir = 'desc',
    emptyMessage = 'No hay datos para mostrar.',
    isLoading = false,
    initialLimit,
    loadMoreLabel = 'Cargar total',
  } = props;

  // --- Local state ---
  const [sortKey, setSortKey] = useState<string>(defaultSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState<number | null>(initialLimit ?? null);
  const [pending, setPending] = useState<{

    id: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [cellDraft, setCellDraft] = useState<string>('');
  const [savingCell, setSavingCell] = useState<{ id: string; field: string } | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // --- Computed rows ---
  const displayed = useMemo(() => {
    let result = [...rows];

    // Apply search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((v) => {
          if (v === null || v === undefined) return false;
          return String(v).toLowerCase().includes(q);
        })
      );
    }

    // Apply extra filters
    Object.entries(activeFilters).forEach(([key, val]) => {
      if (!val) return;
      result = result.filter((row) => String(row[key] ?? '') === val);
    });

    // Sort
    if (sortKey) {
      const colDef = columns.find((c) => c.key === sortKey);
      result = [...result].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;

        let cmp = 0;
        if (
          colDef?.type === 'date' ||
          (typeof av === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(av))
        ) {
          const parseDate = (d: unknown) => {
            if (!d || typeof d !== 'string') return 0;
            const parts = d.split('/');
            if (parts.length === 3) {
              return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
            }
            return 0;
          };
          cmp = parseDate(av) - parseDate(bv);
        } else {
          const an = Number(av);
          const bn = Number(bv);
          if (!isNaN(an) && !isNaN(bn) && typeof av !== 'boolean' && typeof bv !== 'boolean') {
            cmp = an - bn;
          } else {
            cmp = String(av).localeCompare(String(bv));
          }
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }


    return result;
  }, [rows, search, activeFilters, sortKey, sortDir]);

  const visibleRows = useMemo(() => {
    if (limit && displayed.length > limit) {
      return displayed.slice(0, limit);
    }
    return displayed;
  }, [displayed, limit]);

  // --- Handlers ---


  function handleHeaderClick(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function getDisplayValue(col: ColumnDef, value: unknown): string {
    if (col.formatDisplay) return col.formatDisplay(value);
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function startEditing(rowId: string, col: ColumnDef, value: unknown) {
    if (!col.editable || col.type === 'readonly') return;
    if (savingCell?.id === rowId) return;
    if (pending) return;

    let draft = getDisplayValue(col, value);
    if (col.type === 'date') {
      draft = ddmmyyyy_to_htmldate(draft);
    }
    setEditingCell({ id: rowId, field: col.key });
    setCellDraft(draft);
  }

  function commitDraft(rowId: string, col: ColumnDef, currentValue: unknown) {
    let finalValue: unknown = cellDraft;
    if (col.type === 'date') {
      finalValue = htmldate_to_ddmmyyyy(cellDraft);
    } else if (col.type === 'number') {
      finalValue = cellDraft === '' ? '' : parseArithmeticExpression(cellDraft);
    }

    const displayOld = getDisplayValue(col, currentValue);
    const displayNew = col.type === 'date'
      ? htmldate_to_ddmmyyyy(cellDraft)
      : col.type === 'number'
      ? String(parseArithmeticExpression(cellDraft))
      : cellDraft;

    if (displayOld === displayNew) {
      setEditingCell(null);
      return;
    }

    setEditingCell(null);
    setPending({ id: rowId, field: col.key, oldValue: currentValue, newValue: finalValue });
  }


  function handleInputKeyDown(
    e: React.KeyboardEvent,
    rowId: string,
    col: ColumnDef,
    currentValue: unknown
  ) {
    if (e.key === 'Enter') {
      commitDraft(rowId, col, currentValue);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }

  async function handleConfirm() {
    if (!pending || !onEdit) return;
    const { id, field, newValue } = pending;
    setSavingCell({ id, field });
    setPending(null);
    setTableError(null);
    try {
      await onEdit(id, field, newValue);
    } catch (err: unknown) {
      console.error("Error al guardar la edición:", err);
      const msg = err instanceof Error ? err.message : "Error al guardar el cambio en la tabla.";
      setTableError(msg);
    } finally {
      setSavingCell(null);
    }
  }

  function handleReject() {
    setPending(null);
  }

  function handleFilterChange(key: string, value: string) {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderCellContent(
    col: ColumnDef,
    row: Record<string, unknown>,
    rowId: string
  ) {
    const value = row[col.key];
    const isEditing =
      editingCell?.id === rowId && editingCell?.field === col.key;
    const isSaving =
      savingCell?.id === rowId && savingCell?.field === col.key;
    const isPending =
      pending?.id === rowId && pending?.field === col.key;

    // Saving spinner
    if (isSaving) {
      return <span className={styles.savingSpinner} aria-label="Guardando…" />;
    }

    // Pending confirmation bubble + value
    const bubble =
      isPending ? (
        <div className={styles.pendingBubble} onClick={(e) => e.stopPropagation()}>
          <span>¿Confirmar cambio?</span>
          <button
            className={styles.confirmBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleConfirm();
            }}
          >
            ✓ Sí
          </button>
          <button
            className={styles.rejectBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleReject();
            }}
          >
            ✗ No
          </button>
        </div>
      ) : null;


    // Active editor
    if (isEditing) {
      if (col.type === 'select' && col.options) {
        return (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            className={styles.cellInput}
            value={cellDraft}
            autoFocus
            onChange={(e) => setCellDraft(e.target.value)}
            onBlur={() => commitDraft(rowId, col, value)}
          >
            {col.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className={styles.cellInput}
          type={col.type === 'date' ? 'date' : 'text'}
          value={cellDraft}
          autoFocus
          onChange={(e) => setCellDraft(e.target.value)}
          onBlur={() => commitDraft(rowId, col, value)}
          onKeyDown={(e) => handleInputKeyDown(e, rowId, col, value)}
        />
      );

    }

    // Custom renderer
    if (col.render) {
      return (
        <>
          {bubble}
          <span className={styles.cellValue}>{col.render(value, row)}</span>
        </>
      );
    }

    // Default display
    const display = getDisplayValue(col, value);
    return (
      <>
        {bubble}
        <span className={styles.cellValue}>{display}</span>
      </>
    );
  }

  function getCellClassName(col: ColumnDef, rowId: string) {
    const isEditable = col.editable && col.type !== 'readonly';
    const isSavingRow = savingCell?.id === rowId;
    const hasPending = pending !== null;
    const classes = [styles.td];
    if (isEditable && !isSavingRow && !hasPending) {
      classes.push(styles.tdEditable);
    }
    return classes.join(' ');
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={styles.wrapper}>
      {tableError && (
        <div style={{
          color: "var(--danger-color, #ef4444)",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          padding: "8px 14px",
          borderRadius: "6px",
          marginBottom: "12px",
          fontSize: "0.85rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>⚠️ {tableError}</span>
          <button
            onClick={() => setTableError(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1 }}
            title="Cerrar advertencia"
          >
            &times;
          </button>
        </div>
      )}

      {/* Controls */}
      {(searchable || filters.length > 0) && (
        <div className={styles.controls}>
          {searchable && (
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          {filters.map((f) => (
            <select
              key={f.key}
              className={styles.filterSelect}
              value={activeFilters[f.key] ?? ''}
              onChange={(e) => handleFilterChange(f.key, e.target.value)}
            >
              <option value="">{f.label}</option>
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
          <span className={styles.count}>
            {limit && displayed.length > limit
              ? `Mostrando ${visibleRows.length} de ${displayed.length} fila${displayed.length !== 1 ? 's' : ''}`
              : `${displayed.length} fila${displayed.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              {columns.map((col) => {
                const isActive = sortKey === col.key;
                const thClass = [styles.th, isActive ? styles.thActive : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <th
                    key={col.key}
                    className={thClass}
                    style={{ width: col.width }}
                    onClick={() => handleHeaderClick(col.key)}
                  >
                    {col.header}
                    {isActive && (
                      <span className={styles.sortIcon}>
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                );
              })}
              {onDelete && (
                <th className={styles.th} style={{ width: '48px' }} />
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className={styles.emptyMsg}
                  colSpan={columns.length + (onDelete ? 1 : 0)}
                >
                  Cargando…
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td
                  className={styles.emptyMsg}
                  colSpan={columns.length + (onDelete ? 1 : 0)}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const rowId = String(row[idField] ?? '');
                return (
                  <tr key={rowId} className={styles.tr}>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={getCellClassName(col, rowId)}
                        style={{ width: col.width }}
                        onClick={() => {
                          if (
                            col.editable &&
                            col.type !== 'readonly' &&
                            !savingCell &&
                            !pending &&
                            !(editingCell?.id === rowId && editingCell?.field === col.key)
                          ) {
                            startEditing(rowId, col, row[col.key]);
                          }
                        }}
                      >
                        {renderCellContent(col, row, rowId)}
                      </td>
                    ))}
                    {onDelete && (
                      <td className={styles.td} style={{ width: '48px' }}>
                        <button
                          className={styles.deleteBtn}
                          title="Eliminar fila"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(rowId);
                          }}
                          disabled={savingCell?.id === rowId}
                        >
                          ×
                        </button>
                      </td>
                    )}

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Load all / pagination toggle */}
      {limit && displayed.length > limit && (
        <button
          type="button"
          className={styles.loadMoreBtn}
          onClick={() => setLimit(null)}
        >
          {loadMoreLabel} ({displayed.length} en total) 👇
        </button>
      )}
      {initialLimit && !limit && displayed.length > initialLimit && (
        <button
          type="button"
          className={styles.loadMoreBtn}
          onClick={() => setLimit(initialLimit)}
        >
          Mostrar solo primeras {initialLimit} filas ☝️
        </button>
      )}
    </div>
  );
}


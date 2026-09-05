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
  matchMode?: 'exact' | 'contains' | 'month';
  filterFn?: (rowValue: unknown, filterValue: string, row: Record<string, unknown>) => boolean;
}

export interface EditableTableProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  onEdit?: (id: string, field: string, newValue: unknown) => Promise<void>;
  onDelete?: (id: string) => void;
  idField?: string;
  searchable?: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  filters?: FilterDef[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  emptyMessage?: string;
  isLoading?: boolean;
  initialLimit?: number;
  loadMoreLabel?: string;
  collapseLabel?: string;
  onLimitChange?: (limit: number | null) => void;
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
// Highlighting helpers
// ---------------------------------------------------------------------------

export function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query || !query.trim() || !text) return text;
  const q = query.trim();
  if (text.trim().toLowerCase() === q.toLowerCase()) {
    return <mark className={styles.highlight}>{text}</mark>;
  }
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return (
    <>
      <span
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {text}
      </span>
      <span aria-hidden="true">
        {parts.map((part, i) => {
          if (part.toLowerCase() === q.toLowerCase()) {
            return (
              <mark key={i} className={styles.highlight}>
                {part}
              </mark>
            );
          }
          return part;
        })}
      </span>
    </>
  );
}

export function highlightNode(node: React.ReactNode, query: string): React.ReactNode {
  if (!query || !query.trim() || node === null || node === undefined) return node;
  if (typeof node === 'string') {
    return highlightMatches(node, query);
  }
  if (typeof node === 'number') {
    return highlightMatches(String(node), query);
  }
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    if (element.props && element.props.children !== undefined) {
      const children = element.props.children;
      if (typeof children === 'string') {
        return React.cloneElement(element, undefined, highlightMatches(children, query));
      }
      if (Array.isArray(children)) {
        return React.cloneElement(
          element,
          undefined,
          children.map((child, idx) => {
            const key = React.isValidElement(child) && child.key != null ? child.key : idx;
            return <React.Fragment key={key}>{highlightNode(child, query)}</React.Fragment>;
          })
        );
      }
      return React.cloneElement(element, undefined, highlightNode(children, query));
    }
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((child, idx) => {
      const key = React.isValidElement(child) && child.key != null ? child.key : idx;
      return <React.Fragment key={key}>{highlightNode(child, query)}</React.Fragment>;
    });
  }
  return node;
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
    searchTerm: externalSearch,
    onSearchChange,
    filters = [],
    activeFilters: externalActiveFilters,
    onFilterChange: externalOnFilterChange,
    defaultSortKey = '',
    defaultSortDir = 'desc',
    emptyMessage = 'No hay datos para mostrar.',
    isLoading = false,
    initialLimit,
    loadMoreLabel = 'Cargar total',
    collapseLabel,
    onLimitChange,
  } = props;

  // --- Local state ---
  const [sortKey, setSortKey] = useState<string>(defaultSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [internalSearch, setInternalSearch] = useState(externalSearch ?? '');
  const search = externalSearch !== undefined && onSearchChange ? externalSearch : internalSearch;

  const handleSearchChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    }
    setInternalSearch(val);
  };

  const [internalActiveFilters, setInternalActiveFilters] = useState<Record<string, string>>({});
  const activeFilters = externalActiveFilters !== undefined ? externalActiveFilters : internalActiveFilters;

  function handleFilterChange(key: string, value: string) {
    if (externalOnFilterChange) {
      externalOnFilterChange(key, value);
    }
    setInternalActiveFilters((prev) => ({ ...prev, [key]: value }));
  }

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

    // Apply global search across all historical rows
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((row) =>
        Object.entries(row).some(([k, v]) => {
          if (k.startsWith('_')) return false; // skip internal meta like _raw
          if (v === null || v === undefined) return false;
          if (typeof v === 'object') return false;
          return String(v).toLowerCase().includes(q);
        })
      );
    }

    // Apply extra column filters
    Object.entries(activeFilters).forEach(([key, val]) => {
      if (!val) return;
      if (key === 'date_from' || key === 'date_to') return; // Handled within 'date'
      const filterDef = filters.find((f) => f.key === key);
      if (filterDef?.filterFn) {
        result = result.filter((row) => filterDef.filterFn!(row[key], val, row));
      } else if (filterDef?.matchMode === 'contains') {
        result = result.filter((row) =>
          String(row[key] ?? '').toLowerCase().includes(val.toLowerCase())
        );
      } else if (key === 'date') {
        result = result.filter((row) => {
          const str = String(row[key] ?? '').trim();
          if (!str) return false;
          const parts = str.split('/');
          if (parts.length !== 3) return false;
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const y = parseInt(parts[2], 10);
          if (isNaN(d) || isNaN(m) || isNaN(y)) return false;

          const rowDate = new Date(y, m - 1, d);
          const now = new Date();

          if (val === 'current_month') {
            return m === (now.getMonth() + 1) && y === now.getFullYear();
          }
          if (val === 'last_month') {
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return m === (lastMonthDate.getMonth() + 1) && y === lastMonthDate.getFullYear();
          }
          if (val === 'current_year') {
            return y === now.getFullYear();
          }
          if (val === 'custom') {
            const fromStr = activeFilters['date_from'];
            const toStr = activeFilters['date_to'];
            if (fromStr) {
              const fromDate = new Date(fromStr + 'T00:00:00');
              if (rowDate < fromDate) return false;
            }
            if (toStr) {
              const toDate = new Date(toStr + 'T23:59:59');
              if (rowDate > toDate) return false;
            }
            return true;
          }
          if (str === val) return true;
          if (/^\d{2}\/\d{4}$/.test(val)) {
            return `${String(m).padStart(2, '0')}/${y}` === val;
          }
          return str.includes(val);
        });
      } else if (filterDef?.matchMode === 'month' || (key === 'date' && /^\d{2}\/\d{4}$/.test(val))) {
        result = result.filter((row) => {
          const str = String(row[key] ?? '');
          if (str === val) return true;
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(str) && str.slice(3) === val) return true;
          return str.includes(val);
        });
      } else {
        result = result.filter((row) => String(row[key] ?? '') === val);
      }
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
  }, [rows, search, activeFilters, sortKey, sortDir, columns, filters]);

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

    let draft = getDisplayValue(col, value);
    if (col.type === 'date') {
      draft = ddmmyyyy_to_htmldate(draft);
    }
    setEditingCell({ id: rowId, field: col.key });
    setCellDraft(draft);
  }

  async function handleSave(rowId: string, col: ColumnDef, currentValue: unknown) {
    if (!editingCell || editingCell.id !== rowId || editingCell.field !== col.key) return;

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

    setEditingCell(null);

    // If unchanged, do not invoke onEdit
    if (displayOld === displayNew) {
      return;
    }

    if (!onEdit) return;

    setSavingCell({ id: rowId, field: col.key });
    setTableError(null);
    try {
      await onEdit(rowId, col.key, finalValue);
    } catch (err: unknown) {
      console.error("Error al guardar la edición:", err);
      const msg = err instanceof Error ? err.message : "Error al guardar el cambio en la tabla.";
      setTableError(msg);
    } finally {
      setSavingCell(null);
    }
  }

  function handleCancel() {
    setEditingCell(null);
    setCellDraft('');
  }

  function handleInputKeyDown(
    e: React.KeyboardEvent,
    rowId: string,
    col: ColumnDef,
    currentValue: unknown
  ) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave(rowId, col, currentValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
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

    // Pending confirmation bubble + value (backwards compatibility)
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

    // Active in-situ editor with immediate action buttons
    if (isEditing) {
      return (
        <div className={styles.inlineEditorContainer} onClick={(e) => e.stopPropagation()}>
          <div className={styles.editorInputWrapper}>
            {col.type === 'select' && col.options ? (
              <select
                ref={inputRef as React.RefObject<HTMLSelectElement>}
                className={styles.cellInput}
                value={cellDraft}
                autoFocus
                onChange={(e) => setCellDraft(e.target.value)}
                onKeyDown={(e) => handleInputKeyDown(e, rowId, col, value)}
              >
                {col.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                className={styles.cellInput}
                type={col.type === 'date' ? 'date' : 'text'}
                value={cellDraft}
                autoFocus
                onChange={(e) => setCellDraft(e.target.value)}
                onKeyDown={(e) => handleInputKeyDown(e, rowId, col, value)}
              />
            )}
          </div>
          <div className={styles.actionPills}>
            <button
              type="button"
              className={styles.pillSave}
              title="Guardar (Enter)"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSave(rowId, col, value);
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleSave(rowId, col, value);
              }}
            >
              ✓
            </button>
            <button
              type="button"
              className={styles.pillCancel}
              title="Cancelar (Esc)"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
            >
              ✗
            </button>
          </div>
        </div>
      );
    }

    // Custom renderer with highlighting
    if (col.render) {
      return (
        <>
          {bubble}
          <span className={styles.cellValue}>{highlightNode(col.render(value, row), search)}</span>
        </>
      );
    }

    // Default display with highlighting
    const display = getDisplayValue(col, value);
    return (
      <>
        {bubble}
        <span className={styles.cellValue}>{highlightMatches(display, search)}</span>
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
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          )}
          {filters.map((f) => {
            const hasEmptyOpt = f.options.some((opt) => opt.value === '');
            const isCustomDate = f.key === 'date' && activeFilters['date'] === 'custom';
            return (
              <React.Fragment key={f.key}>
                <select
                  aria-label={`Filtrar por ${f.label}`}
                  className={styles.filterSelect}
                  value={activeFilters[f.key] ?? ''}
                  onChange={(e) => handleFilterChange(f.key, e.target.value)}
                >
                  {!hasEmptyOpt && <option value="">{f.label}</option>}
                  {f.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {isCustomDate && (
                  <div className={styles.customDateRange}>
                    <div className={styles.dateInputWrapper}>
                      <span className={styles.dateInputLabel}>Desde</span>
                      <input
                        type="date"
                        aria-label="Fecha desde"
                        className={styles.dateInput}
                        value={activeFilters['date_from'] ?? ''}
                        onChange={(e) => handleFilterChange('date_from', e.target.value)}
                      />
                    </div>
                    <div className={styles.dateInputWrapper}>
                      <span className={styles.dateInputLabel}>Hasta</span>
                      <input
                        type="date"
                        aria-label="Fecha hasta"
                        className={styles.dateInput}
                        value={activeFilters['date_to'] ?? ''}
                        onChange={(e) => handleFilterChange('date_to', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
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
          onClick={() => {
            setLimit(null);
            onLimitChange?.(null);
          }}
        >
          {loadMoreLabel} ({displayed.length} en total) 👇
        </button>
      )}
      {initialLimit && !limit && displayed.length > initialLimit && (
        <button
          type="button"
          className={styles.loadMoreBtn}
          onClick={() => {
            setLimit(initialLimit);
            onLimitChange?.(initialLimit);
          }}
        >
          {collapseLabel ?? `Mostrar solo primeras ${initialLimit} filas ☝️`}
        </button>
      )}
    </div>
  );
}

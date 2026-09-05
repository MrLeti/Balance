# Test Infrastructure & Specification: Vesta Dashboard Multi-View Architecture

## 1. Test Philosophy

### 1.1 Opaque-Box & Behavioral Testing
All tests in this suite treat components and utilities as opaque systems. Tests interact strictly with public interfaces:
- For UI components: DOM nodes, ARIA roles (`tab`, `tablist`, `table`, `row`, `cell`, `button`, `textbox`, `combobox`), user interaction events (`click`, `change`, `keyDown`, `mouseDown`), and visible text content.
- For utility functions: input parameters and observable return values (e.g. `CanvasGradient` objects, color stop configurations).
- **Zero internal spying or implementation coupling**: tests do not assert private component state, private helper functions, or CSS module class names, ensuring that refactoring internal structure never breaks behavioral contracts.

### 1.2 Requirement-Driven Traceability
Every test directly maps to requirements defined in `ORIGINAL_REQUEST.md` and architecture specifications in `PROJECT.md`:
- **R1**: Sub-Navigation Tabs (`SubNavTabs.tsx`, view switching, default tab, URL synchronization, accessibility).
- **R2 & R3**: Chart Gradient Utility (`chartGradients.ts`, canvas linear gradients fading to `rgba(r,g,b,0)` at bottom, theme adaptation, error handling for missing `chartArea`).
- **R4**: Movimientos Table & Enhanced `EditableTable` (20-record initial pagination with toggle, 4 column filters, global history search with `<mark>` highlighting, in-situ immediate Save ✓ and Cancel ✗ pill action buttons).

### 1.3 Progressive Testability & Isolation
- Each test is completely isolated and self-contained: sets up its own mock data, DOM containers, and cleanups.
- Tests do not rely on execution order or side effects from preceding tests.
- When implementation milestones are in progress, tests assert interface contracts cleanly and descriptively.

---

## 2. Methodology

### 2.1 Category-Partitioning
Input domains are partitioned into equivalence classes:
1. **Tabs**: Valid keys (`'dashboard'`, `'analisis'`, `'movimientos'`), initial defaults, invalid/absent URL parameters.
2. **Table Records**: Zero records, fewer than 20 records (e.g. 5), exactly 20 records (boundary), more than 20 records (e.g. 25, 50).
3. **Filter Options**: Single column active, multiple columns active simultaneously, empty filter ("Todos"), non-matching filter.
4. **Search Queries**: Empty string, exact match, partial substring, case-insensitive query, numbers and special characters (`$`, `(`, `[`, `*`, `+`).
5. **Editing Actions**: Text input, number input, date input, select dropdown, valid commit, cancel action, keyboard triggers (`Enter`, `Escape`).

### 2.2 Boundary Value Analysis (BVA)
Critical boundaries under rigorous verification:
- **Pagination**:
  - $N = 0$: renders accessible empty message (`No hay datos para mostrar.`).
  - $N = 19$: renders all 19 rows; toggle button does not appear.
  - $N = 20$: renders all 20 rows; toggle button does not appear.
  - $N = 21$: renders 20 rows; toggle button appears with text indicating total count.
- **Search Highlighting**:
  - Match at start of text, middle of text, end of text, multiple occurrences in single string, whole string match.
- **Chart Area**:
  - `chartArea` fully defined with positive height (`bottom > top`).
  - `chartArea` missing / undefined (e.g. during initial layout calculation).
  - Degenerate `chartArea` (`bottom <= top` or zero height).

### 2.3 Pairwise & Combinatorial Testing
Interaction matrices for table filtering and search:
- `Filter(Tipo: Egreso)` + `Search("Supermercado")`
- `Filter(Fecha: 09/2026)` + `Filter(Categoría: Alimentación)` + `Search("Almuerzo")`
- `Filter(Tipo: Ingreso)` + `TogglePagination("Ver todos")` + In-situ edit of amount
- Rapid sequential tab switches: `dashboard` -> `analisis` -> `movimientos` -> `dashboard`.

### 2.4 Real-World Workflows
End-to-end user journeys simulated in integration tests:
1. **Dashboard Entry & Navigation**: User lands on `/` -> observes default active 'Dashboard' tab -> clicks 'Movimientos' -> tab changes without full page reload -> URL reflects `?tab=movimientos`.
2. **Movements Exploration & In-Situ Editing**: User enters Movimientos -> sees initial 20 records -> searches for "Farmacia" -> matching text is highlighted in `<mark>` elements -> user clicks on amount to edit -> immediate Save (✓) and Cancel (✗) action buttons appear -> user modifies value and clicks ✓ -> `onEdit` callback is invoked with updated payload.
3. **Cancellation Workflow**: User starts editing a cell -> types new value -> clicks ✗ (or presses `Escape`) -> edit is discarded and previous value is restored.

### 2.5 Adversarial & Edge Case Invariants
- **Regex Metacharacter Escaping**: Searching for strings with regex special characters (`?`, `*`, `+`, `(`, `)`, `[`, `]`, `\`) does not cause runtime `SyntaxError` and correctly matches literal characters.
- **Transparent Black Canvas Bug Prevention**: Gradient utility must create color stops using `rgba(R, G, B, 0)` rather than `'transparent'` (`rgba(0, 0, 0, 0)`), preventing dark halos on light backgrounds.
- **Blur vs Click Event Race Condition**: In-situ Save and Cancel buttons utilize `onMouseDown` with `preventDefault()` so clicking an action button does not trigger an input `blur` before the button click registers.

---

## 3. Feature Inventory & Test Tier Mapping

| Tier | Focus Area | Components / Utilities | Key Test Scenarios |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Core Critical & Primary Paths** | `SubNavTabs.tsx`, `EditableTable.tsx` | - Default tab 'dashboard'<br>- Tab switching invoking `onTabChange`<br>- ARIA roles (`tab`, `tablist`, `aria-selected`)<br>- Initial 20-row limit in table<br>- In-situ edit activation on click<br>- Save ✓ commit behavior |
| **Tier 2** | **Filtering & Visual Data Utilities** | `chartGradients.ts`, `TransactionsList.tsx` | - Canvas linear gradient creation<br>- Color stops at 0 and 1 with `rgba(r,g,b,0)`<br>- Graceful handling of missing `chartArea`<br>- Light vs dark theme alpha scaling<br>- Column filtering by Fecha, Tipo, Categoría, Subcategoría |
| **Tier 3** | **Search, Highlighting & Data Propagation** | `EditableTable.tsx`, `TransactionsList.tsx` | - Global search across entire history<br>- Highlighting of matching text with `<mark>`<br>- Case-insensitive search matching<br>- Toggle button to expand all records and collapse back |
| **Tier 4** | **Edge Cases, Security & Adversarial** | All modules | - Regex special characters in search (`/`, `*`, `+`, `(`, `)`)<br>- Cancellation via ✗ button and `Escape` key<br>- Input blur handling without double commit<br>- Empty data states & missing properties<br>- Zero-height canvas chartArea<br>- Mobile touch ergonomics and button sizing |

---

## 4. Test Environment & Tooling

- **Test Runner**: Vitest `v4.0.18`
- **DOM Environment**: `jsdom` `v28.1.0`
- **Component Testing**: `@testing-library/react` `v16.3.2`, `@testing-library/user-event`
- **Execution Command**:
  ```bash
  npm test -- --run
  ```
- **Configuration**: Defined in `vitest.config.ts` with React plugin and `@/` path alias pointing to `./src`.

# Handoff Report: Codebase Navigation & Architecture Exploration

**Agent**: Explorer 1 (Codebase Navigation & Architecture Explorer)  
**Date**: 2026-09-04T21:39:00Z  
**Working Directory**: `c:\Users\alexi\Proyectos\Balance\.agents\explorer_survey_1`  
**Target Milestone**: Multi-view Sub-Tab Navigation for Route `/` (Dashboard, Análisis, Movimientos)

---

## 1. Observation

### 1.1 Project Stack & Infrastructure
- **Framework**: Next.js 16.1.6 (App Router, Turbopack supported), React 19.2.3, TypeScript 5, Vitest 4.0.18 (`package.json`, lines 12-41).
- **Visualization**: Chart.js 4.5.1, `react-chartjs-2` 5.3.1, `chartjs-chart-sankey` 0.14.0 (`package.json`, lines 17-24).
- **Current Build & Test Status**:
  - Command: `npm test -- --run`
    - Result: 5 test files passed, 60 tests passed (100% success).
  - Command: `npm run build`
    - Result: Compiled successfully with zero TypeScript or ESLint errors (`Exit Code: 0`).

### 1.2 Root Components & Layout Architecture
- **Root Layout** (`src/app/layout.tsx`, lines 24-35):
  ```tsx
  <body>
    <AuthProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          {children}
        </div>
      </div>
      <TransactionFAB />
    </AuthProvider>
  </body>
  ```
  - `AuthProvider` wraps the application shell.
  - `.app-shell` (`src/app/globals.css`, lines 202-214) provides flex layout with desktop `.app-main` margin `240px`.
  - On mobile (`max-width: 768px`), `Sidebar` collapses into `.mobileBottomNav` (`src/components/layout/Sidebar.module.css`, lines 254-280), fixed at `bottom: 0`, `height: 60px`, `z-index: 1000`. `.app-main` receives `padding-bottom: 76px`.
  - `TransactionFAB` (`src/components/dashboard/TransactionFAB.tsx`) is mounted **globally** in `RootLayout` at root level, outside `.app-shell`.

### 1.3 Route `'/'` Structure & Current Dashboard Rendering
- **Server Entry Point** (`src/app/page.tsx`, lines 8-27):
  - Server Component marked with `export const dynamic = "force-dynamic";`.
  - Authenticates user via `supabase.auth.getUser()`, redirects unauthenticated users to `/login`.
  - Renders `<DashboardData />` inside `.dashboardContainer` > `.dashboardGrid`.
- **Monolithic Dashboard Component** (`src/components/dashboard/DashboardData.tsx`, lines 1-918):
  - Manages primary financial data via `fetch("/api/dashboard")` and silently updates on `window.addEventListener("transaction_added", handleReload)` (lines 181-189).
  - Manages period filtering via `balanceMonth` (`MM/YYYY` or `"Total"` or `"YYYY"`).
  - Currently renders all 8 widgets sequentially into a CSS 2-column grid:
    1. `HealthMetrics` (spans `1 / -1`, lines 660-672).
    2. `IntelligenceAlerts` (spans `1 / -1`, lines 674-685).
    3. Gráfico Torta Desglose (column 1, lines 688-747).
    4. Columna Derecha: Filtro de Período + Balance General (column 2, lines 749-788).
    5. Flujo de Dinero - SankeyChart (spans `1 / -1`, lines 791-796).
    6. Evolución en el Tiempo - Line Chart with tabs: Comparativo, Categorías, Acumulado (spans `1 / -1`, lines 799-843).
    7. Comparación Personalizada - Line Chart A vs B (spans `1 / -1`, lines 846-901).
    8. `TransactionsList` - Movimientos List wrapping `EditableTable` (spans `1 / -1`, lines 904-913).

### 1.4 Floating Action Button (`TransactionFAB`)
- **Mount Location**: Global in `src/app/layout.tsx` (line 32).
- **Position & Z-Index** (`src/components/dashboard/TransactionFAB.module.css`, lines 3-12, 157-167):
  - Desktop: `position: fixed; bottom: 28px; right: 28px; z-index: 999;`.
  - Mobile (`max-width: 640px`): `bottom: 20px; right: 20px;`.
  - **Conflict**: Mobile bottom navigation in `Sidebar.module.css` has `height: 60px; z-index: 1000;`. At `bottom: 20px` and `z-index: 999`, the FAB on mobile can collide or sit partially under the bottom navigation bar.
- **Reactivity Model**:
  - Expanding speed-dial options: Gasto (`ValidationModal`), Ingreso (`ValidationModal`), Ahorro (`ValidationModal`), Inversión (`InvestmentModal`).
  - Upon successful transaction submission, modals dispatch `window.dispatchEvent(new Event("transaction_added"))`.
  - `DashboardData` listens to `"transaction_added"` and triggers `fetchDataSilent()`.

### 1.5 Theme System & Design Tokens
- **Theme Engine** (`src/app/globals.css`, lines 1-152):
  - Material Design 3 design tokens defined on `:root` (light) and `[data-theme="dark"]` / `@media (prefers-color-scheme: dark)`.
  - Color Tokens:
    - Primary: `--md-sys-color-primary` (`#0061a4` light, `#9ecaeb` dark).
    - Success: `--md-sys-color-success` (`#146c2e` / `#22c55e` light, `#81c995` dark).
    - Danger / Error: `--md-sys-color-error` (`#ba1a1a` / `#ef4444` light, `#ffb4ab` dark).
    - Background: `--bg-color` (`#fdfcff` light, `#0f1418` dark).
    - Text: `--text-main` (`#1a1c1e` light, `#e1e2e6` dark), `--text-muted` (`#42474e` light, `#c3c7cf` dark).
  - Glassmorphism Tokens:
    - Light: `--glass-bg: rgba(253, 252, 255, 0.85);`, `--glass-border: rgba(255, 255, 255, 0.8);`, `--glass-shadow: 0 4px 6px -1px rgba(0,0,0,0.05)`.
    - Dark: `--glass-bg: rgba(19, 23, 26, 0.85);`, `--glass-border: rgba(255, 255, 255, 0.08);`, `--glass-shadow: 0 10px 30px -10px rgba(0,0,0,0.5)`.
    - Utility class: `.glass-panel` with `backdrop-filter: blur(16px)`.
- **Chart.js Theme Sync** (`src/components/dashboard/DashboardData.tsx`, lines 160-180):
  - `MutationObserver` on `document.documentElement` (`attributeFilter: ['data-theme']`) increments `themeTrigger`.
  - Calculates `chartTextColor` (`#e2e8f0` dark, `#475569` light) and `chartGridColor` (`rgba(255, 255, 255, 0.08)` dark, `rgba(0, 0, 0, 0.08)` light).

### 1.6 Current Table & Transactions Limitations (Relative to R4)
- `TransactionsList.tsx` currently only passes `type` as a filter in `FILTERS` (lines 56-66).
- `DashboardData.tsx` lines 552-565 pre-slices transactions to `txLimit = 10` and filters by `balanceMonth`. Consequently, searching in the table only searches the selected month, not the full history (`data`).
- `EditableTable.tsx` (lines 192-242, 292-314) does not show save/cancel buttons during cell editing; it requires the user to hit Enter or click away (`blur`), after which an absolute `pendingBubble` appears.
- No match highlighting exists inside table cells when searching.

---

## 2. Logic Chain

### 2.1 Sub-Tab Navigation Architecture (R1)
1. **Observation**: Route `'/'` is served by `app/page.tsx` rendering `DashboardData.tsx`. `DashboardData` is already a client component containing all state and calculations.
2. **Inference**: Placing the sub-tab navigation state inside `DashboardData` (or a dedicated `DashboardTabsContainer`) keeps state centralized and avoids re-fetching the entire dataset on tab switches. Tab changes will be instantaneous (<16ms, 60fps) without network requests or page reloads.
3. **Observation**: URL query synchronization (`/?tab=dashboard|analisis|movimientos`) allows deep linking and back/forward browser navigation.
4. **Inference**: Using `window.history.replaceState` (or Next.js shallow navigation) updates the URL query without triggering an RSC re-render, satisfying acceptance criteria: *"Las tres pestañas (Dashboard, Análisis, Movimientos) permiten alternar instantáneamente sin recargar la página completa"*.
5. **Observation**: Default tab requirement: *"El Dashboard debe ser la pestaña activa por defecto al ingresar a la aplicación"*.
6. **Inference**: Initializing state with:
   ```ts
   const [activeTab, setActiveTab] = useState<'dashboard' | 'analisis' | 'movimientos'>(() => {
     if (typeof window !== 'undefined') {
       const params = new URLSearchParams(window.location.search);
       const tab = params.get('tab');
       if (tab === 'analisis' || tab === 'movimientos') return tab;
     }
     return 'dashboard';
   });
   ```
   guarantees that `/` defaults to `'dashboard'` while honoring explicit deep links like `/?tab=analisis`.

### 2.2 Component Partitioning & View Structure (R2, R3, R4)
1. **View 1: "Dashboard"**:
   - `HealthMetrics` (KPIs: Balance, Ingresos, Egresos, Inversiones, Ahorros, Vesta Score, TAN, DTI, mini bar chart).
   - Period selector (`balanceMonth`: month/year or total).
   - `IntelligenceAlerts` (alerts, emergency fund, 50/30/20 budget).
   - **NEW**: Line chart for total Ingresos vs Egresos over time for the selected period, equipped with vertical gradient fill (green `#22c55e` and red `#ef4444` fading to transparent).
2. **View 2: "Análisis"**:
   - Dedicated Period Selector for temporal analysis.
   - Desglose (Pie/Doughnut with interactive drilldown into subcategories).
   - Balance General summary card.
   - Flujo de Dinero (`SankeyChart`).
   - Evolución en el Tiempo (Line chart with tabs: Comparativo G/I, Egresos/Cat, Acumulado) + vertical gradient fill.
   - Comparativa Personalizada (Selector ítem A vs ítem B) + vertical gradient fill.
3. **View 3: "Movimientos"**:
   - Historial de Movimientos (`TransactionsList` / `EditableTable`).
   - Unbounded data source (receives all historical `data` for global search).
   - Column filters: **Fecha**, **Tipo**, **Categoría**, **Subcategoría**.
   - Default pagination of **20 records**, with a toggle button to show all.
   - Global search covering entire historical records.
   - Visual match highlighting (`<mark>` or theme-harmonic highlight pill).
   - In-situ editing with immediate **Guardar (✓)** and **Cancelar (✗)** pill buttons visible during active typing/editing.

### 2.3 TransactionFAB Visibility & Ergonomic Mobile Positioning
1. **Observation**: `TransactionFAB` is mounted in `app/layout.tsx` at the root, so it is already mounted regardless of which sub-tab is active.
2. **Observation**: When any transaction is created or deleted, a `transaction_added` DOM event is dispatched. `DashboardData` already listens to this event and calls `fetchDataSilent()`.
3. **Inference**: Reactivity across all three views is intrinsically guaranteed because the shared `data` state in `DashboardData` updates automatically when `transaction_added` fires.
4. **Observation**: On mobile (`max-width: 768px`), `.mobileBottomNav` has `height: 60px; z-index: 1000;`, while `fabContainer` currently has `bottom: 20px; z-index: 999;`.
5. **Inference**: To prevent overlap or obscuring the FAB on mobile, `TransactionFAB.module.css` should set:
   ```css
   @media (max-width: 768px) {
     .fabContainer {
       bottom: 76px; /* 60px nav + 16px clearance */
       right: 16px;
       z-index: 1001; /* float cleanly above bottom nav */
     }
   }
   ```

### 2.4 Chart.js Gradient Fill Implementation
1. **Observation**: Chart.js 4.5.1 has `Filler` plugin already registered in `DashboardData.tsx`.
2. **Observation**: In Chart.js line charts, `backgroundColor` can be defined as a scriptable function `(context: ScriptableContext<'line'>) => ...`.
3. **Inference**: A reusable gradient generator ensures clean, non-repetitive code:
   ```ts
   export function createVerticalGradient(
     ctx: CanvasRenderingContext2D,
     chartArea: { top: number; bottom: number },
     colorRgb: string, // e.g. '34, 197, 94'
     topOpacity = 0.35,
     bottomOpacity = 0.0
   ) {
     const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
     gradient.addColorStop(0, `rgba(${colorRgb}, ${topOpacity})`);
     gradient.addColorStop(1, `rgba(${colorRgb}, ${bottomOpacity})`);
     return gradient;
   }
   ```
   When `chartArea` is undefined during initial layout calculation, the scriptable function returns a fallback `rgba(${colorRgb}, ${topOpacity})`.

### 2.5 EditableTable Enhancements (R4)
1. **Global Search**:
   - `TransactionsList` must pass all historical transactions (`data`) to `EditableTable` (not pre-sliced to 10 or pre-filtered to `balanceMonth`).
   - `initialLimit={20}` passed directly to `EditableTable`.
2. **Column Filters**:
   - Dynamically extract distinct values from `data` for:
     - `date`: Month/Year options (or custom date range/month filter).
     - `type`: `["Ingreso", "Egreso"]`.
     - `category`: Sorted list of distinct categories in `data`.
     - `sub_category`: Sorted list of distinct subcategories in `data`.
3. **Match Highlighting**:
   - In `EditableTable.tsx`, create a helper `highlightText(text: string, search: string)`.
   - If search query exists, wrap matches in `<mark className={styles.highlightText}>{match}</mark>`.
   - In `EditableTable.module.css`:
     ```css
     .highlightText {
       background: rgba(245, 158, 11, 0.25);
       color: var(--text-main);
       border-radius: 4px;
       padding: 1px 3px;
       font-weight: 600;
     }
     [data-theme="dark"] .highlightText {
       background: rgba(234, 179, 8, 0.3);
       color: #fef08a;
     }
     ```
4. **Immediate In-Situ Edit Action Buttons**:
   - Inside `renderCellContent` when `isEditing` is true, render an inline wrapper containing the input/select alongside immediate save and cancel pill buttons:
     ```tsx
     <div className={styles.inlineEditorContainer}>
       {inputElement}
       <div className={styles.inlineActionButtons}>
         <button
           type="button"
           className={styles.savePillBtn}
           onMouseDown={(e) => { e.preventDefault(); commitDraft(rowId, col, value); }}
           title="Guardar (Enter)"
         >
           ✓
         </button>
         <button
           type="button"
           className={styles.cancelPillBtn}
           onMouseDown={(e) => { e.preventDefault(); setEditingCell(null); }}
           title="Cancelar (Esc)"
         >
           ✗
         </button>
       </div>
     </div>
     ```
   - Using `onMouseDown` with `e.preventDefault()` prevents the input from firing an unwanted `blur` event before the click registers, ensuring smooth and instant execution on desktop and touch devices.

---

## 3. Architectural Design Proposal

### 3.1 Component Hierarchy
```
src/app/
├── layout.tsx                [RootLayout: AuthProvider, Sidebar, TransactionFAB]
└── page.tsx                  [Server Component checking auth, rendering DashboardData]

src/components/dashboard/
├── DashboardData.tsx         [Orchestrator: fetches /api/dashboard, manages activeTab & shared state]
├── SubNavTabs.tsx            [Glassmorphism top pill navigation: Dashboard | Análisis | Movimientos]
├── SubNavTabs.module.css
├── tabs/
│   ├── DashboardTab.tsx      [HealthMetrics, PeriodSelector, IntelligenceAlerts, DashboardIncomeExpenseChart]
│   ├── DashboardIncomeExpenseChart.tsx [Line chart: Total Ingresos vs Egresos with vertical gradient fill]
│   ├── AnalisisTab.tsx       [Analysis PeriodSelector, Desglose Pie, Balance General, Sankey, Evolución, Comparativa]
│   └── MovimientosTab.tsx    [TransactionsList with 20-pagination, global search, column filters, highlighting, in-situ edit]
```

### 3.2 Sub-Navigation Bar Specification (`SubNavTabs.tsx`)
- **Structure**: Glassmorphism segmented control pill centered or aligned with the header.
- **Tabs**:
  - `dashboard`: `📊 Dashboard`
  - `analisis`: `📈 Análisis`
  - `movimientos`: `💳 Movimientos`
- **Styles**:
  - Container:
    ```css
    .subNavContainer {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;
      grid-column: 1 / -1;
      width: 100%;
    }
    .segmentedPill {
      display: inline-flex;
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      box-shadow: var(--glass-shadow);
      border-radius: 16px;
      padding: 5px;
      gap: 6px;
    }
    .tabButton {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 12px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .tabButton:hover {
      color: var(--text-main);
      background: var(--surface-hover);
    }
    .tabButtonActive {
      background: var(--accent-color);
      color: var(--md-sys-color-on-primary, #ffffff) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    ```
- **Transitions**:
  - Fade and slide entrance animation on tab switch:
    ```css
    @keyframes viewEnter {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .viewContainer {
      animation: viewEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      display: contents; /* preserves CSS grid children alignment */
    }
    ```

### 3.3 Theme System Harmony Matrix

| Element | Light Theme Token | Dark Theme Token | CSS Variable Reference |
| :--- | :--- | :--- | :--- |
| **SubNav Background** | `rgba(253, 252, 255, 0.85)` | `rgba(19, 23, 26, 0.85)` | `var(--glass-bg)` |
| **SubNav Border** | `rgba(255, 255, 255, 0.8)` | `rgba(255, 255, 255, 0.08)` | `var(--glass-border)` |
| **Active Tab Pill** | `#0061a4` (Primary) | `#9ecaeb` (Primary Dark) | `var(--accent-color)` |
| **Active Tab Text** | `#ffffff` | `#003258` | `var(--md-sys-color-on-primary)` |
| **Ingresos Line & Gradient** | `#22c55e` (rgba 0.35 → 0.0) | `#22c55e` (rgba 0.35 → 0.0) | `var(--success-color)` |
| **Egresos Line & Gradient** | `#ef4444` (rgba 0.35 → 0.0) | `#ef4444` (rgba 0.35 → 0.0) | `var(--danger-color)` |
| **Save Pill (✓)** | `#146c2e` / `#22c55e` | `#81c995` / `#22c55e` | `var(--success-color)` |
| **Cancel Pill (✗)** | `#ba1a1a` / `#ef4444` | `#ffb4ab` / `#ef4444` | `var(--danger-color)` |
| **Search Highlight** | `rgba(245, 158, 11, 0.2)` | `rgba(234, 179, 8, 0.3)` | Custom highlight token |

---

## 4. Caveats

- **Existing EditableTable Consumers**: `EditableTable.tsx` is also utilized in `CuotasDashboard.tsx` and `InversionesDashboard.tsx`. Any enhancements made to `EditableTable` (such as inline action buttons and highlighting) must remain backwards-compatible with existing props and call signatures.
- **URL Parameter vs Prerendering**: Because `app/page.tsx` already uses `export const dynamic = "force-dynamic";`, reading URL search parameters or using client-side `window.location.search` will not violate static generation constraints.
- **Chart.js Canvas Resize**: Canvas elements in CSS grid containers can trigger resize loops if their parents don't have `min-width: 0`. The existing `.card { min-width: 0; }` in `DashboardData.module.css` already adheres to this best practice.

---

## 5. Conclusion

1. **Root Architecture**: Next.js App Router with server auth at `app/page.tsx`, rendering `DashboardData.tsx` inside an app shell.
2. **TransactionFAB**: Already mounted globally in `app/layout.tsx`. To achieve full mobile ergonomics, its bottom offset on mobile (`<= 768px`) must be adjusted to `76px` to clear the `60px` bottom navigation bar. Reactivity is automatically maintained through the `"transaction_added"` event bus.
3. **Sub-Nav Architecture**: Cleanly implemented by orchestrating tabs within `DashboardData` with shallow URL synchronization (`/?tab=dashboard|analisis|movimientos`), defaulting to `'dashboard'`, with zero-reload transitions.
4. **Charts with Gradients**: Chart.js 4.5.1 with registered `Filler` enables scriptable `ctx.createLinearGradient` to achieve smooth vertical gradient fades to transparent across Dashboard and Análisis views.
5. **Movimientos View**: Decoupling `TransactionsList` from the single-month `filteredData` slice will allow full global search over all historical transactions (`data`), with 20-item initial pagination, 4 column filters (Fecha, Tipo, Categoría, Subcategoría), keyword highlighting, and immediate in-situ save/cancel action pill buttons.

---

## 6. Verification Method

### Independent Reproduction Commands
1. **Run Unit Tests**:
   ```bash
   npm test -- --run
   ```
   *Expected result*: All 5 test suites pass with 60 passed tests.
2. **Run Production Build**:
   ```bash
   npm run build
   ```
   *Expected result*: Build succeeds with exit code 0 and no TypeScript/ESLint errors.
3. **Verify Files Inspected**:
   - `src/app/layout.tsx` (Root layout, FAB mounting at line 32)
   - `src/app/page.tsx` (Page entry point)
   - `src/app/globals.css` (Tokens and glassmorphism)
   - `src/components/layout/Sidebar.tsx` & `Sidebar.module.css` (Navigation & mobile bottom bar)
   - `src/components/dashboard/DashboardData.tsx` (Current 918-line monolithic dashboard)
   - `src/components/dashboard/TransactionFAB.tsx` & `TransactionFAB.module.css` (FAB position & modals)
   - `src/components/dashboard/TransactionsList.tsx` (Current table wrapper)
   - `src/components/shared/EditableTable.tsx` & `EditableTable.module.css` (Shared table & edit flow)

### Invalidation Conditions
- If changing tabs triggers a full page reload or network re-fetch of `/api/dashboard`.
- If `TransactionFAB` is unmounted or obscured when switching to Análisis or Movimientos.
- If editing a cell in `EditableTable` fails to display immediate Save (✓) and Cancel (✗) action buttons.
- If global search in Movimientos is restricted to the current month instead of searching across all historical records.

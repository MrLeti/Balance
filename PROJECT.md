# Project: Vesta Dashboard Multi-View Architecture & Enhancements

## Architecture
- **Framework & Runtime**: Next.js 16.1.6 App Router, React 19.2.3, TypeScript 5, Vitest 4.0.18 + jsdom + @testing-library/react.
- **Routing & Views**: Route `/` serves `DashboardData.tsx` orchestrating three distinct interactive sub-views (`Dashboard`, `Análisis`, `Movimientos`) via a glassmorphism sub-nav bar (`SubNavTabs.tsx`) with zero-reload switching and shallow URL parameter synchronization (`?tab=...`).
- **Data Flow & Global State**:
  - `DashboardData.tsx` queries `/api/dashboard` once, caches full transaction history in `data`, and updates silently on `window.dispatchEvent(new Event("transaction_added"))`.
  - `dashboardPeriod` governs `HealthMetrics`, `IntelligenceAlerts`, and the new `DashboardIncomeExpenseChart`.
  - `analysisPeriod` independently governs `Desglose` (donut), `Balance General`, `SankeyChart`, `Evolución en el Tiempo`, and `Comparativa Personalizada`.
  - Movimientos tab receives the full historical `data` array, enabling global search across the entire history unconstrained by period filters or initial 20-row pagination.
- **Visual Design & Theme System**:
  - Material Design 3 tokens on `:root` and `[data-theme="dark"]`.
  - Glassmorphism panels (`.glass-panel`, `--glass-bg`, `--glass-border`, `--glass-shadow`).
  - Chart.js 4.5.1 with registered `Filler` plugin using canvas linear gradients fading down to `rgba(r,g,b,0)` at `chartArea.bottom`.
  - Floating Action Button (`TransactionFAB`) mounted globally in `app/layout.tsx`, responsive with `76px` bottom clearance on mobile to avoid collision with the `60px` bottom navigation bar.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Sub-Nav Tabs Component | Glassmorphism segmented pill control on `/` for Dashboard, Análisis, Movimientos with active indicator | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Default Tab & Smooth Transition | Default active tab 'Dashboard' on initial load; instantaneous transitions (<16ms) without page reload; URL sync | M1 | ORIGINAL_REQUEST §R1 |
| 3 | TransactionFAB Reactivity & Mobile Ergonomics | FAB visible and reactive across all 3 sub-views; mobile clearance at bottom 76px above bottom nav | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Theme Consistency & Tokens | Full light/dark mode support across all views with CSS variables and glassmorphism styling | M1, M2, M3, M4 | ORIGINAL_REQUEST §R1, R2, R3, R4 |
| 5 | Chart Gradient Engine | Reusable helper for vertical linear gradients fading to `rgba(r,g,b,0)` with theme-adjusted opacities | M2 | ORIGINAL_REQUEST §R2, R3 |
| 6 | Dashboard KPIs & Alerts Preservation | Maintain `HealthMetrics` and `IntelligenceAlerts` with period selector on Dashboard view | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Dashboard Income vs Expenses Line Chart | Line chart for total Income vs Expenses over time for selected period with smooth vertical gradient fills | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Análisis View Migration & Independent Period | Dedicated `analysisPeriod` selector; migration of Desglose, Balance General, and SankeyChart | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Análisis Gradient Line Charts | Vertical gradient fills fading to transparent on Evolución en el Tiempo (all 3 tabs) and Comparativa Personalizada | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Movimientos Full History Feed | Decouple `TransactionsList` from single-month slice; pass full `data` array for global search | M4 | ORIGINAL_REQUEST §R4 |
| 11 | Movimientos Column Filters | Direct/dropdown filters for Fecha (month/all), Tipo (Ingreso/Egreso/etc.), Categoría, and Subcategoría | M4 | ORIGINAL_REQUEST §R4 |
| 12 | Movimientos 20-Row Pagination | Default initial display of 20 records with toggle button to view all records and collapse back | M4 | ORIGINAL_REQUEST §R4 |
| 13 | Movimientos Global Search Highlighting | Search across all history with visual `<mark>` highlighting in matching table cells | M4 | ORIGINAL_REQUEST §R4 |
| 14 | In-situ Immediate Editing with Pill Action Buttons | Visible Save (✓) and Cancel (✗) pill buttons during active editing with semantic colors and desktop/mobile ergonomics | M4 | ORIGINAL_REQUEST §R4 |
| 15 | Test Suite & Build Verification | Pass 100% of unit/integration/E2E test suite (`npm test -- --run`) and build (`npm run build`) | M5 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Sub-Nav Navigation & View Shell | SubNavTabs component, tab state, URL sync, smooth transitions, mobile FAB clearance | none | DONE |
| M2 | Chart Gradient Utility & Dashboard View | `chartGradients.ts`, `DashboardIncomeExpenseChart`, DashboardTab integration | M1 | DONE |
| M3 | Análisis View Migration & Gradient Charts | Move 5 cards to AnálisisTab, apply gradient fills to Evolución & Comparativa, analysisPeriod | M1, M2 | DONE |
| M4 | Movimientos View & Enhanced Table | MovimientosTab, 20-row pagination, 4 column filters, global search highlight, in-situ pill action buttons | M1 | DONE |
| M5 | Integration & Comprehensive Verification | E2E and component test suites, 100% pass on npm test and build, adversarial hardening | M1, M2, M3, M4 | DONE |

## Interface Contracts

### SubNavTabs ↔ DashboardData
```typescript
export type DashboardTabKey = 'dashboard' | 'analisis' | 'movimientos';

export interface SubNavTabsProps {
  activeTab: DashboardTabKey;
  onTabChange: (tab: DashboardTabKey) => void;
}
```

### Chart Gradient Utility (`src/lib/utils/chartGradients.ts`)
```typescript
import { ScriptableContext } from 'chart.js';

export function createVerticalGradient(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number; bottom: number },
  colorHex: string,
  isDark: boolean,
  topAlpha?: number
): CanvasGradient | undefined;
```

### EditableTable Enhanced Props (`src/components/shared/EditableTable.tsx`)
```typescript
export interface ColumnDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select';
  editable?: boolean;
  options?: string[];
  render?: (val: any, row: any, highlightHelper?: (text: string) => React.ReactNode) => React.ReactNode;
}

export interface EditableTableProps {
  data: any[];
  columns: ColumnDef[];
  filters?: FilterDef[];
  search?: string;
  onSearchChange?: (val: string) => void;
  initialLimit?: number;
  highlightSearch?: boolean;
  onEdit?: (id: string, field: string, value: unknown) => Promise<void>;
  onDelete?: (row: any) => void;
  // Fully backwards-compatible with CuotasDashboard and InversionesDashboard
}
```

## Code Layout
- `src/lib/utils/chartGradients.ts` — Canvas gradient generator for Chart.js. Owned by M2.
- `src/components/dashboard/SubNavTabs.tsx` & `.module.css` — Sub-tab pill navigation bar. Owned by M1.
- `src/components/dashboard/DashboardData.tsx` & `.module.css` — View orchestrator & state manager. Owned by M1 (layout), M2 (dashboard view), M3 (analisis view), M4 (movimientos view).
- `src/components/dashboard/DashboardIncomeExpenseChart.tsx` — Dashboard line chart with gradient fill. Owned by M2.
- `src/components/dashboard/TransactionFAB.module.css` — FAB positioning adjustment. Owned by M1.
- `src/components/dashboard/TransactionsList.tsx` & `.module.css` — Table container with 4 column filters. Owned by M4.
- `src/components/shared/EditableTable.tsx` & `.module.css` — Shared table with in-situ pill action buttons, pagination toggle, and search highlighting. Owned by M4.
- `src/components/dashboard/__tests__/` & `src/components/shared/__tests__/` — Test files for components and user workflows. Owned by E2E Testing Track / M5.

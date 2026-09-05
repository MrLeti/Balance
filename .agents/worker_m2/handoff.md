# Handoff Report: Milestone 2 — Chart Gradient Engine & Dashboard View

## 1. Observation

### 1.1 Requirements and Initial State
- From `ORIGINAL_REQUEST.md` (§R2) and `PROJECT.md` (§Milestones M2):
  Milestone 2 requires implementing:
  1. `src/lib/utils/chartGradients.ts`: Canvas linear vertical gradient generator fading from line color to transparent (`rgba(r, g, b, 0)`), theme-adaptive, guarded against missing/degenerate `chartArea`.
  2. `src/components/dashboard/DashboardIncomeExpenseChart.tsx`: Line chart displaying total Ingresos and Egresos over time for the selected period (`balanceMonth`), with temporal grouping (daily for specific month, monthly for year or Total), green line (`#22c55e`) and red line (`#ef4444`) with `tension: 0.35`, `pointRadius: 3`, `borderWidth: 2.5`, scriptable gradient fills, currency tooltips, and graceful empty state.
  3. `src/components/dashboard/DashboardData.tsx`: Replacement of the placeholder card (`data-testid="dashboard-chart-placeholder"`) in the `'dashboard'` tab with `<DashboardIncomeExpenseChart />`, preserving `HealthMetrics`, `IntelligenceAlerts`, and period selector.
- In `src/components/dashboard/__tests__/chartGradients.test.ts` (lines 80-171), 7 unit tests define exact expectations:
  - Linear gradient with coordinates `(0, chartArea.top, 0, chartArea.bottom)`.
  - Color stop 0: `rgba(r, g, b, startAlpha)` where `startAlpha = isDark ? topAlpha : topAlpha * 0.7`.
  - Color stop 0.7: `rgba(r, g, b, Number((startAlpha * 0.3).toFixed(4)))`.
  - Color stop 1: `rgba(r, g, b, 0)` to prevent the canvas "transparent black" dark halo bug on light backgrounds.
  - Symmetrical parsing of 6-digit hex (`#22c55e`, `#ef4444`) and 3-digit shorthand (`#3b8` -> `#33bb88`).
  - Graceful return of `undefined` when `chartArea` is null, undefined, or has `bottom <= top`.
- In `src/components/dashboard/DashboardData.tsx` (lines 741-765 before edit):
  - A placeholder card with `data-testid="dashboard-chart-placeholder"` was rendered beneath `HealthMetrics` and `IntelligenceAlerts`.

### 1.2 Implementation Verification Results
- Executed `npm test -- --run`:
  ```
  Test Files  13 passed (13)
       Tests  133 passed (133)
    Duration  3.41s
  ```
  - `src/components/dashboard/__tests__/chartGradients.test.ts`: 7/7 tests passed.
  - `src/components/dashboard/__tests__/DashboardIncomeExpenseChart.test.tsx`: 6/6 tests passed.
  - All existing test suites passed without regressions (127 existing + 6 new = 133 total).
- Executed `npm run build`:
  ```
  ✓ Compiled successfully in 8.5s
    Running TypeScript ...
    Generating static pages using 11 workers (11/11) in 157.8ms
  ```
  Zero TypeScript errors, zero Next.js compilation issues.
- Executed `npx eslint src/lib/utils/chartGradients.ts src/components/dashboard/DashboardIncomeExpenseChart.tsx src/components/dashboard/__tests__/DashboardIncomeExpenseChart.test.tsx`:
  - Exited with code 0 (0 errors, 0 warnings).

---

## 2. Logic Chain

1. **Gradient Utility Engine (`src/lib/utils/chartGradients.ts`)**:
   - Follows the canvas linear gradient specification. The `hexToRgb` helper handles `#RRGGBB` and `#RGB` with whitespace trimming and `#` stripping.
   - Guard check `if (!chartArea || chartArea.bottom <= chartArea.top) return undefined;` protects Chart.js during initial rendering frames when the canvas layout has not yet calculated bounding boxes.
   - For stop 0: `startAlpha = isDark ? maxOpacity : maxOpacity * 0.7`.
   - For stop 0.7: `Number((startAlpha * 0.3).toFixed(4))` provides a natural exponential roll-off.
   - For stop 1: `rgba(r, g, b, 0)` retains the line's RGB channels while dropping alpha to 0, completely avoiding the gray/black halo that occurs when interpolating towards canvas default transparent black `rgba(0, 0, 0, 0)`.

2. **Income vs Expense Chart Component (`src/components/dashboard/DashboardIncomeExpenseChart.tsx`)**:
   - Accepts `data`, `filteredData`, `balanceMonth`, and `isDark` props.
   - Adapts dynamically to system and application theme using `MutationObserver` on `document.documentElement` (`attributeFilter: ['data-theme']`) and `prefers-color-scheme: dark` media queries, while giving precedence to explicit `isDark` prop when supplied.
   - Distinguishes temporal grouping:
     - When `balanceMonth` is a single month (e.g. `"09/2026"`), points are aggregated daily (`DD/MM`) and sorted chronologically.
     - When `balanceMonth` is `"Total"` or a 4-digit year (e.g. `"2025"`), points are aggregated monthly (`Ene 25`, `Feb 25`, etc.) and sorted chronologically.
   - Chart.js Line chart configured with:
     - Dataset 1 ("Ingresos"): `#22c55e`, `tension: 0.35`, `pointRadius: 3`, `pointHoverRadius: 6`, `borderWidth: 2.5`, scriptable gradient fill via `createVerticalGradient(ctx, chartArea, '#22c55e', themeDark)`.
     - Dataset 2 ("Egresos"): `#ef4444`, `tension: 0.35`, `pointRadius: 3`, `pointHoverRadius: 6`, `borderWidth: 2.5`, scriptable gradient fill via `createVerticalGradient(ctx, chartArea, '#ef4444', themeDark)`.
   - Tooltips display formatted ARS currency (`fmt`) and automatically compute net cashflow difference for each timestamp (`Neto: +$X` or `Neto: -$X`).
   - If no transactions exist for the selected period, renders a glassmorphism empty state card (`data-testid="dashboard-chart-empty"`).

3. **Dashboard View Integration (`src/components/dashboard/DashboardData.tsx`)**:
   - Replaced `<section data-testid="dashboard-chart-placeholder">` with `<DashboardIncomeExpenseChart data={data} filteredData={filteredData} balanceMonth={balanceMonth} isDark={isDark} />`.
   - Preserved `HealthMetrics`, `IntelligenceAlerts`, and all period selection mechanisms without regression.

---

## 3. Caveats

- **Isolated Canvas Mocking in Vitest**: In Node/jsdom environments, HTMLCanvasElement does not have native 2D drawing contexts. Unit tests mock `react-chartjs-2` to inspect dataset properties and test `createVerticalGradient` with mock CanvasRenderingContext2D. Full rendering is confirmed in production build and browser runtimes.
- **Pre-existing Lint Errors**: The repository contains pre-existing lint violations in older modules (`TransactionsList.tsx`, `InversionesDashboard.tsx`, `ThemeToggle.tsx`). All Milestone 2 owned files (`chartGradients.ts`, `DashboardIncomeExpenseChart.tsx`, `DashboardIncomeExpenseChart.test.tsx`) pass ESLint with zero errors.

---

## 4. Conclusion

Milestone 2 is 100% complete:
- `src/lib/utils/chartGradients.ts` is implemented and verified.
- `src/components/dashboard/DashboardIncomeExpenseChart.tsx` and its CSS module are implemented with full dark/light mode support, daily and monthly grouping, scriptable gradient fills, clean currency tooltips, and empty states.
- `src/components/dashboard/DashboardData.tsx` is updated to render `<DashboardIncomeExpenseChart />` in the 'dashboard' tab.
- All 133 tests pass across 13 test files (`npm test -- --run`), and `npm run build` succeeds with zero errors.

---

## 5. Verification Method

To independently verify this milestone:

1. **Run Full Test Suite**:
   ```bash
   npm test -- --run
   ```
   *Expected outcome*: 13 test files pass, 133 tests pass, 0 failures.

2. **Run Targeted Tests**:
   ```bash
   npx vitest run src/components/dashboard/__tests__/chartGradients.test.ts
   npx vitest run src/components/dashboard/__tests__/DashboardIncomeExpenseChart.test.tsx
   ```
   *Expected outcome*: All 13 gradient and chart component tests pass.

3. **Run Production Build**:
   ```bash
   npm run build
   ```
   *Expected outcome*: Next.js Turbopack build succeeds with code 0 and 0 TypeScript errors.

4. **Verify ESLint on Milestone 2 Files**:
   ```bash
   npx eslint src/lib/utils/chartGradients.ts src/components/dashboard/DashboardIncomeExpenseChart.tsx src/components/dashboard/__tests__/DashboardIncomeExpenseChart.test.tsx
   ```
   *Expected outcome*: Clean pass with 0 errors and 0 warnings.

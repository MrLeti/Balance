## 2026-09-04T21:55:00Z
You are Worker M2 (Implementation Track: Milestone 2).
Your working directory is: C:\Users\alexi\Proyectos\Balance\.agents\worker_m2

Scope of Milestone 2: Chart Gradient Engine & Dashboard View
Files owned exclusively:
- src/lib/utils/chartGradients.ts
- src/components/dashboard/DashboardIncomeExpenseChart.tsx
- src/components/dashboard/DashboardData.tsx (replacing placeholder in 'dashboard' tab)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Instructions:
1. Read the authoritative requirements and documentation at:
   - C:\Users\alexi\Proyectos\Balance\ORIGINAL_REQUEST.md
   - C:\Users\alexi\Proyectos\Balance\PROJECT.md
   - C:\Users\alexi\Proyectos\Balance\.agents\explorer_survey_2\handoff.md
   - C:\Users\alexi\Proyectos\Balance\TEST_READY.md
2. Create `src/lib/utils/chartGradients.ts`:
   - Export `createVerticalGradient(ctx: CanvasRenderingContext2D, chartArea: { top: number; bottom: number } | undefined, hexColor: string, isDark: boolean, maxOpacity?: number): CanvasGradient | undefined`.
   - Safe hex parser handling 6-char (`#22c55e`) and 3-char (`#3b8`).
   - Guard: return `undefined` if `!chartArea || chartArea.bottom <= chartArea.top`.
   - Start stop at 0: `rgba(r, g, b, topAlpha)` where topAlpha is scaled (higher in dark mode, e.g. 0.35; cleaner in light mode, e.g. 0.24).
   - Bottom stop at 1: `rgba(r, g, b, 0)` with matching RGB channels to avoid the transparent-black canvas halo bug.
   - Middle stop at 0.7: `rgba(r, g, b, topAlpha * 0.3)`.
3. Create `src/components/dashboard/DashboardIncomeExpenseChart.tsx`:
   - Renders total Ingresos and Egresos over time for the selected period (`balanceMonth`).
   - Temporal grouping: daily points for a specific month (e.g. "09/2026"), monthly points for "Total" or full year (e.g. "2025").
   - Chart.js Line chart with scriptable `backgroundColor` using `createVerticalGradient`.
   - Green line (`#22c55e`) for Ingresos, red line (`#ef4444`) for Egresos. Both lines have `tension: 0.35`, `pointRadius: 3`, `borderWidth: 2.5`.
   - Clean currency tooltips and legends.
   - Glassmorphism card container.
   - Graceful empty state when no transactions exist in the period.
4. Update `src/components/dashboard/DashboardData.tsx`:
   - Replace the placeholder card (`data-testid="dashboard-chart-placeholder"`) in the 'dashboard' tab with `<DashboardIncomeExpenseChart />`.
   - Preserve `HealthMetrics`, `IntelligenceAlerts`, and the period selector.
5. Verification:
   - Run `npm test -- --run` to verify all tests pass.
   - Run `npm run build` to verify production compilation with zero TypeScript errors.
6. Keep `C:\Users\alexi\Proyectos\Balance\.agents\worker_m2\progress.md` updated with your liveness timestamp.
7. Write your handoff report to `C:\Users\alexi\Proyectos\Balance\.agents\worker_m2\handoff.md`.
8. Send a message to parent upon completion.

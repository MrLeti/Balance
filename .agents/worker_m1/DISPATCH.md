## 2026-09-04T21:40:21Z

Scope of Milestone 1: Sub-Nav Navigation, Layout & Route Architecture
Files owned exclusively:
- src/components/dashboard/SubNavTabs.tsx
- src/components/dashboard/SubNavTabs.module.css
- src/components/dashboard/DashboardData.tsx (sub-nav integration & view partitioning skeleton)
- src/components/dashboard/TransactionFAB.module.css (mobile clearance)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Instructions:
1. Read the authoritative requirements at:
   - C:\Users\alexi\Proyectos\Balance\ORIGINAL_REQUEST.md
   - C:\Users\alexi\Proyectos\Balance\PROJECT.md
   - C:\Users\alexi\Proyectos\Balance\.agents\explorer_survey_1\handoff.md
2. Create `src/components/dashboard/SubNavTabs.tsx` and `src/components/dashboard/SubNavTabs.module.css`:
   - Glassmorphism segmented pill design using Vesta tokens (`var(--glass-bg)`, `var(--glass-border)`, `var(--glass-shadow)`, `var(--accent-color)`).
   - Three tabs: Dashboard, Análisis, Movimientos.
   - Accessible button elements with aria attributes, smooth hover and active state transitions.
3. Integrate `SubNavTabs` into `src/components/dashboard/DashboardData.tsx`:
   - Initialize `activeTab` to 'dashboard' by default, honoring URL param `?tab=dashboard|analisis|movimientos` if present.
   - Synchronize tab switches with URL search parameters using shallow `window.history.replaceState` and listen to `popstate` events.
   - Instantaneous view transitions (<16ms) without full page reload or re-fetching `/api/dashboard`.
   - Partition view rendering by active tab:
     * 'dashboard': HealthMetrics, IntelligenceAlerts, placeholder card for line chart (to be implemented in M2).
     * 'analisis': Desglose (donut), Balance General, Flujo de Dinero (Sankey), Evolución en el tiempo, Comparativa.
     * 'movimientos': TransactionsList (to be enhanced in M4).
4. Update `src/components/dashboard/TransactionFAB.module.css`:
   - On mobile (`@media (max-width: 768px)`), set `bottom: 76px` and `z-index: 1001` so it clears the 60px bottom navigation bar and remains fully accessible and reactive on all views.
5. Verification:
   - Run `npm test -- --run` to ensure all existing tests pass.
   - Run `npm run build` to verify zero TypeScript or Next.js build errors.
6. Keep `C:\Users\alexi\Proyectos\Balance\.agents\worker_m1\progress.md` updated with your liveness timestamp.
7. Write your handoff report to `C:\Users\alexi\Proyectos\Balance\.agents\worker_m1\handoff.md`.
8. Send a message to parent upon completion.

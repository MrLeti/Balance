# Vesta: Reglas y Directrices de Desarrollo del Proyecto

Este documento establece las directrices de arquitectura, diseño visual y experiencia de usuario que todo agente debe respetar al trabajar en este repositorio.

---

## 1. Sistema de Diseño Visual y Temas (Glassmorphism)

- **Variables CSS**: Utilizar siempre los tokens globales del proyecto:
  - Fondos y paneles: `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-shadow)`.
  - Tipografía: `var(--text-main)`, `var(--text-muted)`.
  - Estados y semántica: `var(--accent-color)`, `var(--success-color)`, `var(--danger-color)`.
- **Modo Claro / Modo Oscuro**:
  - Toda nueva interfaz debe soportar y verse nítida tanto en modo claro como oscuro (`[data-theme="dark"]` / `[data-theme="light"]`).
  - No usar colores hexadecimales oscuros o claros fijos para fondos de texto o contenedores.
  - Para bordes tenues, emplear `var(--glass-border)`.
- **Colores Oficiales de los 4 Tipos Globales de Movimiento**:
  - 🟢 **Ingresos**: `#22c55e` (Verde / `var(--success-color)`).
  - 🔴 **Egresos**: `#ef4444` (Rojo / `var(--danger-color)`).
  - 🔵 **Ahorro**: `#3b82f6` (Azul / metas y aportes).
  - 🟣 **Inversión**: `#8b5cf6` (Violeta / activos financieros).
  - *Regla de coherencia*: Todo gráfico (líneas, donut, Sankey), tarjeta de KPI (`HealthMetrics`), badge o indicador que represente estos tipos debe respetar estrictamente esta paleta. En Canvas 2D (Chart.js), emplear directamente estos códigos hexadecimales para permitir la correcta interpolación de degradados.

---

## 2. Arquitectura de Navegación del Dashboard Principal (`/`)

La vista principal de Balance se encuentra estructurada en tres sub-vistas fluidas:

1. **Dashboard** (Pestaña activa por defecto al iniciar sesión):
   - Muestra los KPIs consolidados (`HealthMetrics`).
   - Muestra alertas predictivas (`IntelligenceAlerts`).
   - Selector de período principal (`balanceMonth`).
   - Gráfico de Distribución (`DashboardIncomeExpenseChart`) que compara los 4 tipos globales (Ingresos, Egresos, Ahorro e Inversión) con degradado vertical hacia transparente.

2. **Análisis**:
   - Agrupa las 5 tarjetas de análisis profundo: Desglose (Donut), Balance General, Flujo de Dinero (Sankey), Evolución en el Tiempo y Comparativa Personalizada.
   - Posee su propio selector de período independiente (`analysisPeriod`) para permitir exploración temporal sin alterar los KPIs del Dashboard.
   - Gráficos de líneas con degradado hacia transparente suave.

3. **Movimientos**:
   - Historial completo desacoplado del filtro de mes para permitir búsquedas globales.
   - Filtros dedicados por 4 columnas:
     - **Fecha**: Presets rápidos ("Este mes", "Mes pasado", "Este año") con "Personalizado (Rango)..." ubicado inmediatamente debajo de "Este año" (antes de meses individuales), desplegando selectores de fecha nativos Desde/Hasta.
     - **Jerarquía en Cascada (Tipo ➔ Categoría ➔ Subcategoría)**: Las opciones hijas se acotan dinámicamente según la selección padre, reseteando selecciones huérfanas y empleando etiquetas limpias sin emojis decorativos (`📁`/`↳`).
   - Paginación inicial de 20 movimientos con botón toggle para ver todos o colapsar.
   - Buscador global con resaltado visual (`<mark>`) en coincidencias.
   - Edición in-situ inmediata: botones pill de **Guardar (✓)** y **Cancelar (✗)** activos mientras se escribe (sin requerir blur).

- **Sub-pestañas (`SubNavTabs.tsx`)**:
  - Conservan la transición instantánea sin recargar la página.
  - Sincronizan el estado de forma poco invasiva con la URL (`?tab=dashboard`, `?tab=analisis`, `?tab=movimientos`).
  - Implementan accesibilidad WAI-ARIA (`role="tablist"`, `role="tab"`, navegación por teclado).

---

## 3. Botón Flotante Global (`TransactionFAB`)

- El botón flotante para registrar nuevos movimientos debe permanecer montado en `src/app/layout.tsx` para estar disponible en todas las pantallas y pestañas.
- **Despeje en móvil**: En pantallas `<= 768px`, debe mantener una separación inferior mínima de `76px` (`bottom: 76px;`) para evitar colisiones con la barra de navegación inferior móvil (`60px`).
- **Reactividad**: Cualquier inserción, edición o borrado de transacciones debe disparar `window.dispatchEvent(new Event("transaction_added"))` para actualizar silenciosamente todas las vistas en segundo plano.

---

## 4. Gráficos de Líneas con Degradado (Chart.js)

- Al crear o editar gráficos de líneas en Chart.js, usar la utilidad `createVerticalGradient` de `@/lib/utils/chartGradients.ts`.
- Nunca utilizar el string literal `"transparent"` como color stop en Canvas 2D (genera un halo grisáceo al interpolar hacia `rgba(0,0,0,0)`). Usar siempre `rgba(r, g, b, 0)` con los mismos canales RGB del color de la línea.
- Validar siempre `chartArea && Number.isFinite(chartArea.top) && chartArea.bottom > chartArea.top` antes de llamar a `createLinearGradient`.
- Asegurarse de tener registrado el plugin `Filler` en Chart.js.

---

## 5. Verificación Obligatoria

Antes de dar por concluida cualquier modificación en componentes de datos o interfaz:
- Ejecutar la suite de pruebas: `npm test -- --run` (deben pasar el 100% de los tests).
- Comprobar la compilación de producción: `npm run build`.

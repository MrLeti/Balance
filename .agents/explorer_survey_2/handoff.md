# Reporte de Investigación: Arquitectura de Gráficos y Analíticas (Explorer 2)

## 1. Observation

### 1.1 Librería de Gráficos y Plugins Registrados
En `package.json` (líneas 17-18 y 24):
```json
"chart.js": "^4.5.1",
"chartjs-chart-sankey": "^0.14.0",
"react-chartjs-2": "^5.3.1",
```

En `src/components/dashboard/DashboardData.tsx` (líneas 5-17 y 28):
```typescript
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Filler
} from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler);
```
- Se observa que el plugin **`Filler`** de Chart.js ya está importado y registrado en `DashboardData.tsx`.
- En `src/components/dashboard/SankeyChart.tsx` (líneas 4-6 y 81):
```typescript
import { Chart as ChartJS, registerables } from 'chart.js';
import { SankeyController, Flow } from 'chartjs-chart-sankey';
import { Chart } from 'react-chartjs-2';

ChartJS.register(...registerables, SankeyController, Flow);
```
- Se observa que `SankeyChart` registra `registerables` completo junto con `SankeyController` y `Flow`.

### 1.2 Componentes Existentes de Analítica en el Dashboard
En `src/components/dashboard/DashboardData.tsx`:

1. **Desglose (Donut / Pie drill-down)** (Líneas 688-747):
   - Elemento: `<Pie data={pieData} options={{ ... cutout: '40%' }} />`.
   - Estado: `pieFilter` ("Egreso" | "Ingreso") y `selectedCategory` (`string | null`).
   - Drill-down: Implementado vía callback `onClick: (event, elements) => { ... }` que asigna `setSelectedCategory(pieData.labels[index])`. Botón `"🔙 Volver"` restablece a `null`.
   - Colores: Mapeados desde `dynamicColorMap` y fallback a paleta fija de 8 colores (líneas 404-406).

2. **Balance General** (Líneas 766-788):
   - Muestra resumen de Ingresos (`{fmt(ingresos)}`), Egresos (`-{fmt(egresos)}`) y Balance Neto (`{fmt(balance)}`).
   - Situado actualmente en columna lateral derecha inmediatamente debajo del selector de período auxiliar (líneas 752-763).

3. **Flujo de Dinero (Sankey)** (Líneas 791-796 y `SankeyChart.tsx`):
   - Renderiza `<SankeyChart data={filteredData} isDark={isDark} />`.
   - Construye dinámicamente nodos y flujos (Ingresos -> Categorías -> Cash Flow -> Categorías de Egreso / Ahorro / Inversiones / Sobrante / Déficit).
   - Incluye monkey-patch vertical en líneas 14-79 de `SankeyChart.tsx` para centrado dinámico de columnas.

4. **Evolución en el Tiempo** (Líneas 799-843):
   - Renderiza `<Line data={lineData} options={...} />`.
   - Estado: `lineFilter` con tres pestañas:
     * `"Comparativo"`: Ingresos (`#22c55e`) vs Egresos Totales (`#ef4444`). Líneas planas sin gradient fill ni `fill: true`.
     * `"Categorias"`: Una línea por cada categoría de egreso detectada con colores de `catColors` o `dynamicColorMap`. Líneas planas sin `fill`.
     * `"Balance"`: Balance Acumulado (`#3b82f6`) con `fill: true` plano usando `backgroundColor: 'rgba(59, 130, 246, 0.2)'`.

5. **Comparativa Personalizada** (Líneas 845-901):
   - Dos dropdowns agrupados por categoría/subcategoría (`compItem1` y `compItem2`).
   - Renderiza `<Line data={compLineData} options={...} />` comparando item A vs item B con colores sólidos sin degradado.

### 1.3 Selector de Período y Filtrado Actual
En `DashboardData.tsx`:
- Estado actual:
  ```typescript
  const [balanceMonth, setBalanceMonth] = useState<string>(() => {
      const now = new Date();
      return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  });
  ```
- Cálculo de períodos disponibles `availableMonths` (líneas 229-258): detecta todas las combinaciones `MM/YYYY` y años `YYYY` presentes en los datos.
- Filtrado `filteredData` (líneas 308-325):
  ```typescript
  const filteredData = useMemo(() => {
      if (balanceMonth === "Total") return data;
      return data.filter(row => {
          if (row.length < 6) return false;
          const dateStr = row[1];
          if (typeof dateStr === 'string') {
              const parts = dateStr.split("/");
              if (parts.length >= 3) {
                  if (balanceMonth.length === 4) {
                      return parts[2] === balanceMonth; // Filtro por Año entero
                  } else {
                      return `${parts[1]}/${parts[2]}` === balanceMonth; // Filtro estricto mes/año
                  }
              }
          }
          return false;
      });
  }, [data, balanceMonth]);
  ```
- Este selector aparece actualmente duplicado en la UI:
  1. En el encabezado de `HealthMetrics.tsx` (líneas 164-190).
  2. En la sección "Filtro de Período" encima de Balance General (líneas 752-763).
- Todas las analíticas del dashboard actual se computan en cascada a partir de este único `filteredData`.

### 1.4 Soporte de Temas (Claro / Oscuro)
En `src/app/globals.css` (líneas 3-103) y `ThemeToggle.tsx`:
- Tema claro: `:root` con tokens `--md-sys-color-*`, `--success-color: var(--md-sys-color-success) (#146c2e)`, `--danger-color: var(--md-sys-color-error) (#ba1a1a)`.
- Tema oscuro: `[data-theme="dark"]` o `@media (prefers-color-scheme: dark)` sin atributo `data-theme="light"`.
- En `DashboardData.tsx` (líneas 160-180):
  ```typescript
  const isDark = typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') === 'dark' || 
        (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
      : false;
  const chartTextColor = isDark ? '#e2e8f0' : '#475569';
  const chartGridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  ```
  Nota observada: Existe un aviso de ESLint en `DashboardData.tsx`: `'themeTrigger' is assigned a value but never used.` debido a que el estado se incrementa pero no se utiliza en el cuerpo del render.

---

## 2. Logic Chain

### 2.1 Implementación de Gradient Fills en Chart.js v4
1. **Mecanismo de Relleno en Chart.js**:
   - Chart.js cuenta con el plugin `Filler` (ya registrado en `DashboardData.tsx`).
   - Para que una línea tenga relleno hacia la base o el eje 0, el dataset requiere `fill: true` (o `'origin'`).
   - La propiedad `backgroundColor` de un dataset en Chart.js acepta un valor tipo **Scriptable Option**: una función callback `(context: ScriptableContext<'line'>) => CanvasGradient | string | undefined`.
2. **Creación del CanvasGradient**:
   - El objeto `context.chart` provee `ctx: CanvasRenderingContext2D` y `chartArea: ChartArea` (`{ top, bottom, left, right, width, height }`).
   - Durante la fase preliminar de cálculo de layout, `chartArea` puede ser `undefined`. Si `!chartArea || chartArea.bottom <= chartArea.top`, la función debe retornar `undefined` (o un color base sólido de respaldo) para evitar excepciones.
   - En la pasada de renderizado, `chartArea` está plenamente calculado:
     `const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);`
   - `chartArea.top` representa el valor máximo del eje Y (la cúspide del área de trazado).
   - `chartArea.bottom` representa la línea base cero (eje X).
3. **Paradas de Color (Color Stops) y Mitigación del Defecto de Canvas "Transparent Black"**:
   - En la especificación de Canvas 2D, la palabra clave `'transparent'` se evalúa como `rgba(0, 0, 0, 0)` (negro con opacidad 0). Al interpolar desde un color brillante (ej. verde `#22c55e`) hacia `'transparent'`, el navegador interpola tanto el canal alfa como los canales RGB hacia cero, generando un halo grisáceo/sucio en el degradado.
   - Para un degradado nítido y moderno estilo fintech:
     * Parada 0 (`offset: 0`): `rgba(R, G, B, startAlpha)` (ej. verde `rgba(34, 197, 94, 0.35)` o rojo `rgba(239, 68, 68, 0.35)`).
     * Parada 1 (`offset: 1`): `rgba(R, G, B, 0.0)` (los mismos canales RGB pero alfa 0).
     * Opcional: Parada intermedia (`offset: 0.6`): `rgba(R, G, B, startAlpha * 0.35)` para una curva de atenuación exponencial suave y elegante.
4. **Comportamiento en Responsive Resize y Cambio de Modo Claro/Oscuro**:
   - **Resize**: Al cambiar el ancho de pantalla o la orientación móvil, Chart.js reajusta el canvas (`responsive: true`) y re-ejecuta los callbacks scriptables de `backgroundColor` con el nuevo `chartArea`. El degradado se adapta instantáneamente a la nueva altura sin estirarse ni pixelarse.
   - **Tema (Dark/Light)**: Al conmutar `data-theme`, React re-renderiza el componente con el nuevo valor de `isDark`:
     * En modo oscuro: `startAlpha = 0.35` - `0.40` (destaca contra fondos oscuros `#0f1418`).
     * En modo claro: `startAlpha = 0.22` - `0.26` (sutil y limpio contra fondos claros `#fdfcff`).
     * Las líneas conservan colores vivos y nítidos (`#22c55e` para ingresos, `#ef4444` para egresos), con `borderWidth: 2.5`, `tension: 0.35` y puntos discretos (`pointRadius: 3`, `pointHoverRadius: 6`).

### 2.2 Nuevo Gráfico de Líneas para Dashboard (R2)
1. **Objetivo del Gráfico**:
   - Mostrar la evolución temporal comparativa de Ingresos vs. Egresos en el período seleccionado en la pestaña Dashboard.
2. **Estructura de Datos y Agrupación**:
   - Si `dashboardPeriod === "Total"` o tiene 4 dígitos (ej. `"2025"`):
     * Agrupación por mes (`MM/YYYY`).
     * Etiquetas eje X: Nombres de meses cronológicos (ej. `Ene 25`, `Feb 25`, etc.).
     * Valores: Suma mensual de Ingresos y suma mensual de Egresos.
   - Si `dashboardPeriod` es un mes específico (ej. `"09/2026"`):
     * Agrupación por día (`DD/MM/YYYY`).
     * Etiquetas eje X: Días con movimientos (ej. `04/09`, `12/09`, etc.).
     * Valores: Total de ingresos y egresos diarios.
3. **Datasets con Gradient Fill**:
   - **Dataset 1 (Ingresos)**:
     * Label: `"Ingresos"`
     * `borderColor`: `'#22c55e'`
     * `fill`: `true`
     * `backgroundColor`: Función generadora del degradado verde a transparente.
     * `tension`: `0.35`
   - **Dataset 2 (Egresos)**:
     * Label: `"Egresos"`
     * `borderColor`: `'#ef4444'`
     * `fill`: `true`
     * `backgroundColor`: Función generadora del degradado rojo a transparente.
     * `tension`: `0.35`
4. **Opciones y Experiencia de Usuario**:
   - Escalas con `beginAtZero: true`.
   - Tooltip formateado en pesos argentinos (`$ ...`) con indicación neta del punto.
   - Leyenda en posición `'bottom'` con tipografía y contraste coordinados con el tema.

### 2.3 Gráficos con Gradient Fill en la Pestaña Análisis (R3)
De acuerdo a R3, las gráficas de líneas de Análisis deben incorporar también degradado hacia transparente:
1. **Evolución en el Tiempo**:
   - Pestaña `"Comparativo G/I"`: Ingresos (`#22c55e`) y Egresos (`#ef4444`) con gradient fills idénticos al Dashboard.
   - Pestaña `"Egresos/Cat"`: Cada categoría trazada con su color asignado (`dynamicColorMap[cat]`) y un degradado suave (`startAlpha: 0.18`) hacia transparente.
   - Pestaña `"Acumulado"`: Balance Acumulado (`#3b82f6`) con degradado azul hacia transparente (`startAlpha: 0.35`).
2. **Comparativa Personalizada**:
   - Ítem A (color 1) e Ítem B (color 2) con degradado vertical hacia transparente respectivo.
3. **Desglose (Donut / Pie)**:
   - Se mantiene intacto con su funcionalidad de drill-down a subcategorías al hacer clic en un sector y botón de retorno.
4. **Flujo de Dinero (Sankey)**:
   - Se traslada íntegramente a Análisis preservando su lógica de centrado y asignación de flujos.
5. **Balance General**:
   - Se traslada a Análisis para resumir el total de Ingresos, Egresos y Balance Neto del período seleccionado en esta pestaña.

### 2.4 Mecánica del Selector de Período: Dashboard vs. Análisis
1. **Diferenciación de Requerimientos**:
   - R2 establece: Dashboard conserva los KPIs de `HealthMetrics`, alertas inteligentes y el selector de período, gobernando el nuevo gráfico de líneas.
   - R3 establece: Análisis incluye su propio selector de período para ajustar el análisis temporal de todas sus tarjetas.
   - R4 establece: La tabla de movimientos realiza búsquedas en TODO el historial (no limitado al período filtrado).
2. **Propuesta de Arquitectura de Estado**:
   - Mantener dos estados independientes de período:
     * `dashboardPeriod`: Por defecto el mes corriente (ej. `"09/2026"` o mes más reciente con datos). Afecta a `HealthMetrics`, `IntelligenceAlerts` y al nuevo gráfico de líneas del Dashboard.
     * `analysisPeriod`: Inicializado en el mismo mes o `"Total"`. Afecta a Desglose, Balance General, Sankey, Evolución en el Tiempo y Comparativa Personalizada.
   - Función pura de filtrado reutilizable:
     `filterDataByPeriod(allRows, periodStr)` que resuelve `"Total"`, `"YYYY"` y `"MM/YYYY"`.
   - Cálculo de métricas puro reutilizable:
     `computePeriodSummary(rows)` que computa balance, ingresos, egresos, etc.

---

## 3. Caveats

1. **Disponibilidad de Datos por Período**: Si un usuario selecciona un mes en el que no hubo movimientos de ingresos o egresos, el gráfico de líneas del Dashboard mostrará el mensaje accesible *"No hay movimientos registrados en este período"* o un trazado plano en cero. Se recomienda mostrar un empty-state elegante con diseño glassmorphism cuando no haya registros.
2. **Agrupación Temporal en Meses con Pocos Días**: En la vista de mes específico, actualmente el código agrupa por los días que tuvieron transacciones registradas. Trazar solo los días con datos es la estrategia actual de `DashboardData.tsx` y evita generar 30 puntos vacíos innecesarios.
3. **Transición entre Pestañas**: Al alternar entre sub-pestañas mediante CSS (o renderizado condicional), el canvas de Chart.js puede necesitar un ciclo de redibujado (`chart.resize()`). `react-chartjs-2` maneja el redibujado de manera automática al montar/desmontar o al cambiar la visibilidad de su contenedor.

---

## 4. Conclusion

1. **Viabilidad 100% Confirmada**: La infraestructura actual del proyecto con Chart.js `4.5.1` y `react-chartjs-2` `5.3.1` ya posee registrado el plugin `Filler` y soporta completamente Scriptable Options para gradientes en canvas.
2. **Módulo Helper de Gradientes**:
   Se recomienda crear un archivo utilitario (ej. `src/lib/utils/chartGradients.ts`) que exporte:
   ```typescript
   export function createChartGradient(
       ctx: CanvasRenderingContext2D,
       chartArea: { top: number; bottom: number },
       hexColor: string,
       isDark: boolean,
       maxOpacity = 0.35
   ): CanvasGradient | undefined {
       if (!chartArea || chartArea.bottom <= chartArea.top) return undefined;
       const [r, g, b] = hexToRgb(hexColor);
       const startAlpha = isDark ? maxOpacity : maxOpacity * 0.7;
       const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
       gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${startAlpha})`);
       gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${startAlpha * 0.3})`);
       gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
       return gradient;
   }
   ```
3. **Distribución Limpia de Componentes**:
   - **Pestaña Dashboard**:
     1. `HealthMetrics` (con selector de período en encabezado).
     2. `IntelligenceAlerts`.
     3. **Nuevo** `DashboardCashflowLineChart` (Ingresos vs Egresos a lo largo del tiempo con degradado hacia transparente).
   - **Pestaña Análisis**:
     1. Barra superior con selector de período de Análisis.
     2. Fila superior: `Desglose` (Donut con drilldown) + `Balance General`.
     3. `Flujo de Dinero` (SankeyChart).
     4. `Evolución en el Tiempo` (Comparativo G/I, Egresos/Cat, Acumulado con gradient fill).
     5. `Comparativa Personalizada` (Ítem A vs Ítem B con gradient fill).
   - **Pestaña Movimientos**:
     1. `TransactionsList` / `EditableTable` (Búsqueda global con highlight, filtros por columna, paginación 20 por defecto y edición in-situ estética).

---

## 5. Verification Method

### 5.1 Verificación Automatizada
1. **Ejecutar Suite de Pruebas**:
   ```powershell
   npm test -- --run
   ```
   *Criterio de éxito*: Los 5 archivos de prueba actuales deben ejecutarse y pasar con 60 tests exitosos sin regresiones.
2. **Verificación de Tipos TypeScript y Linting**:
   ```powershell
   npx tsc --noEmit
   npm run lint
   ```
   *Criterio de éxito*: Compilación sin errores tipográficos.

### 5.2 Inspección Visual y Funcional
1. **Pestaña Dashboard**:
   - Confirmar que al abrir `/` se carga por defecto la pestaña "Dashboard".
   - Confirmar que se visualizan los KPIs, las alertas inteligentes y el nuevo gráfico de Ingresos vs Egresos con curvas suaves.
   - Inspeccionar el degradado en modo oscuro (fondo transparente oscuro) y en modo claro (fondo claro): verificar que el verde se desvanece suavemente a transparente hacia el eje inferior sin bandas oscuras ni cortes bruscos.
   - Cambiar el selector de período y verificar que los puntos y curvas del gráfico se actualizan inmediatamente.
2. **Pestaña Análisis**:
   - Cambiar a la pestaña "Análisis" sin recargar la página.
   - Comprobar que Desglose, Balance General, Flujo de Dinero, Evolución y Comparativa están presentes.
   - Verificar que al cambiar de pestaña en "Evolución en el Tiempo" (Comparativo, Egresos/Cat, Acumulado), todas las líneas incorporan degradado hacia transparente.
   - Verificar que el selector de período de Análisis filtra únicamente las tarjetas de Análisis sin alterar la vista del Dashboard.
3. **Condiciones de Invalidación**:
   - Si `chartArea` no está definido y produce errores de consola tipo `TypeError: Cannot read properties of undefined (reading 'top')`, la protección condicional del callback de gradiente debe ajustarse.
   - Si el degradado muestra halos grises en modo claro, se debe verificar que la parada inferior use `rgba(r, g, b, 0)` con los mismos componentes RGB en vez de `'transparent'`.

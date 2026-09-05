# Original User Request

## 2026-09-04T21:33:26Z

Dividir el dashboard principal de Vesta en tres vistas interactivas (Dashboard, Análisis y Movimientos) mediante una barra de sub-pestañas superior con transición suave, rediseñar los gráficos de líneas (tanto en Dashboard como en Análisis) con gradientes modernos hacia transparente, dotar a la tabla de movimientos de filtros por columna, paginación por defecto de 20 registros, búsqueda global con resaltado en todo el historial y edición in-situ inmediata con botones de acción (Guardar / Cancelar) diseñados con una estética visual cuidada y moderna, adaptados para escritorio y móvil.

Working directory: c:\Users\alexi\Proyectos\Balance
Integrity mode: development

## Requirements

### R1. Navegación por Sub-pestañas (Dashboard, Análisis, Movimientos)
- Implementar un sistema de sub-navegación o pestañas superiores en la vista principal (`/`) con tres opciones: **Dashboard**, **Análisis** y **Movimientos**.
- El **Dashboard** debe ser la pestaña activa por defecto al ingresar a la aplicación.
- Debe mantener la reactividad del botón flotante de nuevo movimiento (`TransactionFAB`) en todas las vistas.
- Debe conservar y soportar perfectamente el modo claro y oscuro del sistema de diseño Vesta (tokens CSS y estilo glassmorphism).

### R2. Vista "Dashboard" con Gráfico de Líneas con Degradado
- Conservar los componentes actuales de KPIs (`HealthMetrics`: Balance, Ingresos, Egresos, Inversiones, Ahorros, Vesta Score) y alertas inteligentes (`IntelligenceAlerts`).
- Conservar el selector de período (mes/año o total).
- Añadir un gráfico de líneas que represente los Ingresos y Egresos totales a lo largo del tiempo correspondiente al período seleccionado.
- Aplicar un degradado suave (gradient fill de Chart.js) que se desvanezca verticalmente desde el color de cada línea hacia transparente por debajo de la misma (verde para ingresos, rojo para egresos), asegurando excelente contraste tanto en modo claro como oscuro.

### R3. Vista "Análisis" y Gráficos con Gradient Fill
- Trasladar las tarjetas existentes desde el dashboard actual:
  1. Desglose (Gráfico de torta / donut interactivo con drill-down a subcategorías).
  2. Balance General (Resumen de ingresos, egresos y balance neto).
  3. Flujo de Dinero (Gráfico Sankey interactivo).
  4. Evolución en el Tiempo (Gráfico de líneas con pestañas: Comparativo G/I, Egresos/Cat, Acumulado).
  5. Comparativa Personalizada (Selector ítem A vs ítem B).
- **Gradient Fill**: Aplicar también el relleno con degradado vertical hacia transparente a las gráficas de líneas de esta sección (Evolución en el Tiempo y Comparativa Personalizada) para mantener una coherencia visual moderna en toda la app.
- Incluir su propio selector de período para ajustar el análisis temporal.

### R4. Vista "Movimientos" con Búsqueda Global, Filtros y Edición Inmediata Estética
- Trasladar el Historial de Movimientos (`TransactionsList` / `EditableTable`) a la pestaña de Movimientos.
- **Filtros por Columna**: Añadir filtros directos o desplegables para las columnas: **Fecha**, **Tipo** (Ingreso/Egreso), **Categoría** y **Subcategoría**.
- **Paginación / Límite Inicial**: Mostrar por defecto los últimos 20 movimientos y ofrecer un botón o control claro para mostrar todos los movimientos.
- **Buscador Global**: Al ingresar texto en el buscador de la tabla, la búsqueda debe abarcar la totalidad de los movimientos históricos registrados (no limitarse a los 20 visibles ni únicamente al período filtrado).
- **Resaltado de Coincidencias (Highlighting)**: El texto coincidente dentro de las celdas de la tabla debe resaltarse visualmente (por ejemplo, con un `<mark>` o fondo distintivo armónico con el tema).
- **Edición In-situ Inmediata y Estética**:
  - Mientras el usuario edita o escribe en la celda/control, deben aparecer inmediatamente los botones de acción para **Guardar (✓)** y **Cancelar (✗)** (sin obligar a hacer clic afuera para confirmar).
  - Diseñar estos botones con **una estética visual muy cuidada, moderna y pulida**: botones tipo pill o badge con iconos nítidos, colores de acento sutiles (`var(--success-color)` y `var(--danger-color)`), sombras suaves, microinteracciones en hover/focus y tamaño táctil ergonómico para pantallas táctiles móviles.

## Acceptance Criteria

### Navegación y Vistas
- [ ] La aplicación abre por defecto en la pestaña "Dashboard".
- [ ] Las tres pestañas (Dashboard, Análisis, Movimientos) permiten alternar instantáneamente sin recargar la página completa.
- [ ] El botón flotante de nuevo movimiento (`TransactionFAB`) permanece visible y funcional en las tres pestañas.
- [ ] La interfaz responde adecuadamente al cambio entre tema claro y tema oscuro en todas las secciones.

### Dashboard & Gráficos
- [ ] La pestaña Dashboard muestra los KPIs de `HealthMetrics`, las alertas de `IntelligenceAlerts`, el selector de período y el gráfico de Ingresos vs Egresos con degradado inferior hacia transparente.
- [ ] El gráfico actualiza sus puntos y curvas según el período seleccionado.

### Análisis & Gráficos con Degradado
- [ ] Las tarjetas (Desglose, Balance General, Flujo Sankey, Evolución en el Tiempo, Comparativa) se visualizan en la pestaña Análisis.
- [ ] Los gráficos de líneas en Análisis (Evolución y Comparativa) incorporan gradient fill vertical hacia transparente con estética refinada.
- [ ] El selector de período en Análisis filtra correctamente los datos de todas las tarjetas de la sección.

### Movimientos y Tabla
- [ ] La tabla muestra inicialmente los últimos 20 movimientos y permite desplegar el listado completo mediante un botón.
- [ ] Existen controles de filtro independientes para Fecha, Tipo, Categoría y Subcategoría que filtran los registros en tiempo real.
- [ ] El campo de búsqueda busca en todo el historial disponible y resalta visualmente los fragmentos de texto que coinciden con el término buscado.
- [ ] Al editar una celda, los botones para guardar y cancelar aparecen directamente accesibles durante la edición con un diseño visual moderno y ergonómico para PC y móvil.
- [ ] Los tests existentes (`npm test -- --run`) y el build (`npm run build`) se ejecutan con éxito sin errores de TypeScript ni de compilación.
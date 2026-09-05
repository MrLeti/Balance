# Reporte de Investigación: Arquitectura de Tabla de Movimientos, Requerimientos R4 e Infraestructura de Pruebas

**Explorador**: Explorer 3 (Movements Table & Test Infra Explorer)  
**Fecha/Hora**: 2026-09-04T21:40:00Z  
**Directorio de trabajo**: `C:\Users\alexi\Proyectos\Balance\.agents\explorer_survey_3`  
**Directorio raíz del proyecto**: `C:\Users\alexi\Proyectos\Balance`  

---

## 1. Observaciones Directas (Observation)

### 1.1. Estado de Infraestructura de Pruebas y Build
Se ejecutaron en terminal los comandos oficiales del proyecto para verificar la salud inicial del repositorio:

- **Ejecución de Tests (`npm test -- --run`)**:
  - Comando: `npm test -- --run`
  - Código de salida: `0`
  - Duración: `807ms`
  - Resultado: `Test Files 5 passed (5)`, `Tests 60 passed (60)`
  - Archivos ejecutados y número de pruebas:
    - `src/lib/backup/format.test.ts` (3 tests)
    - `src/lib/utils/cuotas.test.ts` (15 tests)
    - `src/lib/utils/investments.test.ts` (18 tests)
    - `src/lib/utils/format.test.ts` (19 tests)
    - `src/lib/utils/savings.test.ts` (5 tests)
  - **Hallazgo clave**: Los 5 archivos de prueba actuales prueban exclusivamente funciones de utilidad puras en `src/lib/`. No existe actualmente **ningún test unitario ni de integración para componentes React** (cero tests para `EditableTable`, `TransactionsList`, `DashboardData`, etc.).

- **Ejecución de Compilación (`npm run build`)**:
  - Comando: `npm run build`
  - Código de salida: `0`
  - Entorno: Next.js 16.1.6 con Turbopack y TypeScript 5.
  - Resultado: `Compiled successfully in 9.0s`. Verificación de tipos TypeScript completada sin errores. Generación de páginas estáticas exitosa (11/11).
  - Aviso observado: `The "middleware" file convention is deprecated. Please use "proxy" instead.` (Aviso deprecado de Next.js, no bloqueante).

- **Configuración y Dependencias de Pruebas (`package.json` y `vitest.config.ts`)**:
  - `package.json` líneas 9-10:
    ```json
    "lint": "eslint",
    "test": "vitest"
    ```
  - `package.json` líneas 30-41 (devDependencies):
    - `@testing-library/react`: `^16.3.2`
    - `@testing-library/dom`: `^10.4.1`
    - `@vitejs/plugin-react`: `^5.1.4`
    - `jsdom`: `^28.1.0`
    - `vitest`: `^4.0.18`
    - `typescript`: `^5`
  - `vitest.config.ts` líneas 1-17:
    ```ts
    export default defineConfig({
        plugins: [react()],
        test: {
            environment: 'jsdom',
            globals: true,
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src')
            }
        }
    })
    ```
  - El entorno está 100% listo para renderizar y probar componentes React mediante Vitest + `@testing-library/react` con simulación DOM en jsdom.

---

### 1.2. Arquitectura de Transacciones y Flujo de Datos

#### A. Almacenamiento y Recuperación (APIs y Estado)
1. **Endpoint `GET /api/dashboard` (`src/app/api/dashboard/route.ts`)**:
   - Consulta Supabase tabla `transactions` con paginación en lotes de 1000 registros para sortear límites de fila.
   - Retorna un array de arrays (`rows: (string | number)[][]`):
     - `row[0]`: `id` (string UUID)
     - `row[1]`: `formattedDate` ("DD/MM/YYYY")
     - `row[2]`: `type` ("Ingreso", "Egreso", "Ahorro", "Inversión")
     - `row[3]`: `category` (string)
     - `row[4]`: `sub_category` (string)
     - `row[5]`: `amount` (número flotante)
     - `row[6]`: `comment` (string)
     - `row[7]`: `cuota_ref` (string UUID o vacío)
     - `row[8]`: `investment_ref` (string UUID o vacío)
2. **Mutaciones (`src/app/api/transactions/route.ts`)**:
   - `POST /api/transactions`: Inserta nuevos registros (utilizado por modales de carga).
   - `PATCH /api/transactions`: Recibe `{ id, field, value }`.
     - Allowlist estricta (`UPDATABLE_FIELDS` en líneas 7-9): `"date"`, `"type"`, `"category"`, `"sub_category"`, `"amount"`, `"comment"`.
     - Realiza conversiones seguras: fecha DD/MM/YYYY a ISO YYYY-MM-DD; importe a número redondeado mediante `roundMoney(parseSafeAmount(value))`.
   - `DELETE /api/transactions`: Recibe `{ id }`. Elimina el movimiento y ejecuta borrado en cascada en la tabla `instalments` si tiene `cuota_ref`.
3. **Mecanismo de Reactividad y Eventos**:
   - `window.addEventListener("transaction_added", handleReload)` en `DashboardData.tsx` (línea 187).
   - Tras mutaciones exitosas, los componentes disparan `window.dispatchEvent(new Event("transaction_added"))` para recargar datos en segundo plano mediante `fetchDataSilent()`.

---

### 1.3. Componentes de Tabla Existentes: `TransactionsList` y `EditableTable`

#### A. `TransactionsList.tsx` (`src/components/dashboard/TransactionsList.tsx`)
- **Propósito**: Componente contenedor que transforma los arrays de movimientos a objetos para `EditableTable`.
- **Props actuales** (líneas 6-15):
  ```ts
  interface TransactionsListProps {
      transactions: any[][];
      totalCount: number;
      searchTerm: string;
      setSearchTerm: (term: string) => void;
      txLimit: number;
      setTxLimit: (limit: number) => void;
      onDelete: (tx: any) => void;
      onEdit: (id: string, field: string, value: unknown) => Promise<void>;
  }
  ```
- **Columnas definidas** (`COLUMNS`, líneas 32-54):
  - `date`: tipo "date", editable.
  - `type`: tipo "select", editable, opciones: `["Ingreso", "Egreso"]`. *(Ojo: faltan Ahorro e Inversión)*.
  - `category`: tipo "text", editable.
  - `sub_category`: tipo "text", editable.
  - `amount`: tipo "number", editable, formateado con badge de color y símbolo `+` / `-`.
  - `comment`: tipo "text", editable.
- **Filtros actuales** (`FILTERS`, líneas 56-66):
  ```ts
  const FILTERS: FilterDef[] = [
      {
          key: "type",
          label: "Tipo",
          options: [
              { value: "", label: "Todos" },
              { value: "Ingreso", label: "✅ Ingresos" },
              { value: "Egreso",  label: "📉 Egresos" },
          ]
      }
  ];
  ```
  Actualmente **solo existe el filtro por Tipo**. No existen filtros para Fecha, Categoría ni Subcategoría.
- **Paginación actual** (líneas 96-100):
  ```tsx
  {totalCount > txLimit && (
      <button className={styles.loadMoreBtn} onClick={() => setTxLimit(totalCount)}>
          Ver Todos los Movimientos 👇
      </button>
  )}
  ```

#### B. `EditableTable.tsx` (`src/components/shared/EditableTable.tsx`)
- **Uso transversal**: Es un componente compartido utilizado en 3 secciones críticas de la aplicación:
  1. `TransactionsList.tsx` (`src/components/dashboard/TransactionsList.tsx:84`)
  2. `CuotasDashboard.tsx` (`src/components/cuotas/CuotasDashboard.tsx:593`)
  3. `InversionesDashboard.tsx` (`src/components/inversiones/InversionesDashboard.tsx:1214`)
- **Mecanismo de Edición Actual** (líneas 192-241, 289-351):
  - Al hacer clic en una celda editable, `startEditing()` activa `editingCell = { id, field }`.
  - Durante la edición (líneas 318-350), se renderiza **únicamente** el elemento `<input>` o `<select>`. **No hay ningún botón visible de acción durante la escritura**.
  - Al presionar Enter o al desenfocar el input (`onBlur`), se ejecuta `commitDraft()`.
  - `commitDraft()` no guarda inmediatamente: almacena un estado intermedio `pending = { id, field, oldValue, newValue }`.
  - Cuando `pending` está activo, aparece una burbuja flotante arriba de la celda (líneas 291-314):
    ```tsx
    <div className={styles.pendingBubble} onClick={(e) => e.stopPropagation()}>
        <span>¿Confirmar cambio?</span>
        <button className={styles.confirmBtn} onClick={handleConfirm}>✓ Sí</button>
        <button className={styles.rejectBtn} onClick={handleReject}>✗ No</button>
    </div>
    ```
  - Recién al hacer clic en "✓ Sí" se ejecuta `handleConfirm()`, el cual llama a `onEdit(id, field, newValue)`.
- **Búsqueda y Filtros Actuales en `EditableTable.tsx`** (líneas 107-165):
  - Aplica búsqueda insensible a mayúsculas sobre todos los valores de las filas recibidas:
    ```ts
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((v) => {
          if (v === null || v === undefined) return false;
          return String(v).toLowerCase().includes(q);
        })
      );
    }
    ```
  - Aplica filtros adicionales mediante coincidencia exacta estricta: `String(row[key] ?? '') === val`.
  - **No existe resaltado visual (`<mark>`)** de las coincidencias del texto en las celdas renderizadas (líneas 353-370).
- **Paginación interna en `EditableTable.tsx`** (líneas 167-173, 549-566):
  - Ya posee soporte opcional para `initialLimit` y botones de alternancia:
    - `"Cargar total (X en total) 👇"` (`setLimit(null)`)
    - `"Mostrar solo primeras X filas ☝️"` (`setLimit(initialLimit)`)

#### C. Integración en `DashboardData.tsx` (`src/components/dashboard/DashboardData.tsx`)
- En `DashboardData.tsx`:
  - Línea 63: `const [txLimit, setTxLimit] = useState(10);`
  - Líneas 308-325: `filteredData` filtra `data` obligatoriamente por el mes seleccionado (`balanceMonth`).
  - Líneas 552-565: `recentTx` se calcula sobre `filteredData` (restringido al mes actual) y recortado a `txLimit` (10 filas):
    ```ts
    const recentTx = useMemo(() => {
        let results = [...filteredData].reverse();
        ...
        return results.slice(0, txLimit);
    }, [filteredData, txLimit, searchTerm]);
    ```
  - Líneas 904-913: `TransactionsList` se ubica actualmente al final del dashboard y recibe únicamente `transactions={recentTx}` y `totalCount={filteredData.length}`.

---

## 2. Cadena Lógica (Logic Chain)

A partir de las observaciones directas, se deduce la siguiente cadena lógica de causas y consecuencias para la implementación de R4:

1. **Premisa sobre la Búsqueda Global (R4)**:
   - *Observación*: `DashboardData.tsx` pasa a `TransactionsList` la variable `recentTx`, la cual ya está filtrada por `balanceMonth` (ej. "09/2026") y recortada a 10 filas (Observación 1.3.C).
   - *Consecuencia*: Si el usuario escribe en el buscador de la tabla de movimientos, no puede encontrar transacciones de meses anteriores ni movimientos más allá de los primeros 10-20 mostrados.
   - *Deducción*: Para cumplir con el requerimiento R4 (*"la búsqueda debe abarcar la totalidad de los movimientos históricos registrados, no limitarse a los 20 visibles ni únicamente al período filtrado"*), la vista de "Movimientos" debe recibir el historial completo (`data`) o contar con un desacoplamiento entre el filtro del período del dashboard y el conjunto de datos de la tabla.

2. **Premisa sobre el Límite Inicial de 20 Registros (R4)**:
   - *Observación*: Actualmente `DashboardData` inicializa `txLimit` en 10 (línea 63). Paralelamente, `EditableTable` ya cuenta internamente con las propiedades `initialLimit` y `loadMoreLabel` (Observación 1.3.B), pero `TransactionsList` no las utiliza y renderiza un botón externo redundante (Observación 1.3.A).
   - *Deducción*: Se debe unificar la paginación configurando el límite por defecto en **20** registros y delegando el toggle al botón nativo de `EditableTable` ("Ver todos los movimientos (N en total)" / "Mostrar solo primeros 20"), garantizando que los datos pasados incluyan el historial completo.

3. **Premisa sobre el Resaltado de Texto (`<mark>`) (R4)**:
   - *Observación*: Las celdas en `EditableTable.tsx` (líneas 353-370) renderizan texto plano (`display`) o el resultado de `col.render` sin envolver los fragmentos coincidentes con `search` (Observación 1.3.B).
   - *Deducción*: Debe incorporarse un helper de renderizado que divida el texto de la celda según el término de búsqueda actual y envuelva cada coincidencia en un elemento `<mark className={styles.searchHighlight}>`. Se debe añadir soporte de estilos en `EditableTable.module.css` para que el `<mark>` mantenga legibilidad armónica tanto en modo claro como en modo oscuro.

4. **Premisa sobre los Filtros por Columna (Fecha, Tipo, Categoría, Subcategoría) (R4)**:
   - *Observación*: `TransactionsList.tsx` solo define un filtro para `Tipo` (Observación 1.3.A). Además, el filtrado de `EditableTable.tsx` utiliza coincidencia exacta `===` (Observación 1.3.B), lo cual imposibilita filtrar fechas tipo "DD/MM/YYYY" por mes "MM/YYYY" si se usara coincidencia exacta.
   - *Deducción*:
     - Se deben añadir a `TransactionsList` los 4 filtros exigidos:
       a) **Fecha**: Selector de mes/período o fecha específica generado a partir de las fechas existentes en el historial.
       b) **Tipo**: Opciones para "Todos", "Ingreso", "Egreso" (y opcionalmente "Ahorro", "Inversión").
       c) **Categoría**: Opciones dinámicas extraídas del conjunto de categorías registradas en los movimientos.
       d) **Subcategoría**: Opciones dinámicas extraídas de las subcategorías (idealmente condicionadas o agrupadas).
     - Se debe dotar a `EditableTable` (o al extractor de filtros) de capacidad para coincidencia flexible (por ejemplo `matchMode: 'contains'` o evaluación para fechas) para que filtrar por mes coincida con fechas del formato "DD/MM/YYYY".

5. **Premisa sobre la Edición In-situ Inmediata con Botones Guardar (✓) y Cancelar (✗) (R4)**:
   - *Observación*: El flujo actual de `EditableTable.tsx` requiere que el usuario termine de editar, haga clic afuera o presione Enter para ver una burbuja flotante secundaria de confirmación `¿Confirmar cambio? ✓ Sí / ✗ No` (Observación 1.3.B).
   - *Deducción*: El requerimiento R4 prohíbe explícitamente obligar al usuario a hacer clic afuera para confirmar y solicita botones accesibles *inmediatamente mientras se edita*:
     - Mientras `isEditing` esté activo, debe renderizarse un contenedor interactivo con el input/select y una barra de acciones adyacente con los botones tipo pill/badge: **Guardar (✓)** y **Cancelar (✗)**.
     - Para evitar que el evento `onBlur` del input cancele prematuramente la interacción antes de registrar el clic en los botones, los botones deben incluir `onMouseDown={(e) => e.preventDefault()}`.
     - Al hacer clic en Guardar (✓), se debe validar y llamar directamente a `onEdit()` sin pasar por la burbuja `pendingBubble`, proporcionando retroalimentación inmediata con el spinner existente (`savingSpinner`).
     - Al hacer clic en Cancelar (✗) o presionar Escape, se aborta la edición inmediatamente restaurando el valor previo.
     - La estética debe cumplir con los tokens de diseño de Vesta: pill badges con `var(--success-color)` y `var(--danger-color)`, sombras suaves (`0 2px 6px rgba(...)`), microinteracciones `hover`/`active`, y un tamaño táctil ergonómico (mínimo 36x36px) apto para dispositivos móviles.

6. **Premisa sobre Compatibilidad con Otros Módulos (`Cuotas` e `Inversiones`)**:
   - *Observación*: `CuotasDashboard` e `InversionesDashboard` utilizan `EditableTable` con la misma firma de `onEdit` (Observación 1.3.B).
   - *Deducción*: La actualización de `EditableTable` para soportar edición inmediata in-situ, resaltado de búsqueda y filtros avanzados debe realizarse de manera que mantenga 100% de retrocompatibilidad con las tablas de cuotas e inversiones.

7. **Premisa sobre la Cobertura de Pruebas**:
   - *Observación*: Hay 60 pruebas pasando pero 0 tests de componentes React (Observación 1.1).
   - *Deducción*: Dado que la infraestructura con Vitest, jsdom y `@testing-library/react` ya está configurada y operativa, se deben incorporar tests automatizados para validar los nuevos comportamientos de R4: filtrado, paginación, búsqueda con resaltado y edición in-situ inmediata.

---

## 3. Advertencias y Limitaciones (Caveats)

1. **Rango Temporal de Transacciones en Memoria**:
   - El endpoint `GET /api/dashboard` pagina y descarga todas las transacciones del usuario en memoria del cliente (con límite de lote de 1000 en Supabase). Para volúmenes domésticos típicos (centenares o pocos miles de registros), la búsqueda global en el cliente es instantánea y óptima. Si un usuario llegara a tener decenas de miles de registros en el futuro, se requeriría búsqueda del lado del servidor, pero para la arquitectura actual de Vesta, la búsqueda en cliente es la solución indicada y más ágil.
2. **Dependencias Cruzadas de Sub-pestañas (R1, R2, R3)**:
   - Este reporte se enfoca en R4 (Tabla de Movimientos e Infraestructura de Tests). La reubicación visual de `TransactionsList` a la pestaña "Movimientos" dependerá de la integración con el sistema de sub-pestañas de R1 y la redistribución de tarjetas de R2 y R3 realizada por los otros agentes exploradores/implementadores.
3. **Persistencia de Edición en Base de Datos**:
   - El backend en `PATCH /api/transactions` tiene una lista blanca (`UPDATABLE_FIELDS`) de campos editables: `date`, `type`, `category`, `sub_category`, `amount`, `comment`. Cualquier columna adicional que se pretendiera editar en el futuro requeriría actualizar dicha lista en el backend. Los 6 campos actuales de `TransactionsList` ya están 100% cubiertos por la lista blanca.

---

## 4. Conclusiones y Plan de Implementación Recomendado (Conclusion)

### 4.1. Resumen Diagnóstico
La arquitectura actual de la aplicación cuenta con una base sólida: build de Next.js limpio, TypeScript estricto sin errores, suite de Vitest funcional con jsdom listo para pruebas de componentes, y endpoints REST funcionales para CRUD de movimientos.

Sin embargo, para satisfacer los requerimientos de **R4**, se requiere intervenir dos componentes principales: `src/components/shared/EditableTable.tsx` y `src/components/dashboard/TransactionsList.tsx` (así como la forma en que `DashboardData.tsx` provee los datos a `TransactionsList`):

### 4.2. Especificación Técnica Detallada de Cambios Propuestos

#### 1. Modificaciones en `EditableTable.tsx` y `EditableTable.module.css`:
- **Edición In-situ Inmediata Estética (R4)**:
  - Reemplazar el flujo de confirmación retardada de dos pasos (`pendingBubble`) por una barra de acciones integrada y visible mientras se edita la celda.
  - Renderizar botones tipo pill con iconos nítidos `✓` (Guardar) y `✗` (Cancelar).
  - Prevenir desenfoque accidental con `onMouseDown={(e) => e.preventDefault()}`.
  - Guardar directamente al presionar Enter o hacer clic en `✓`.
  - Cancelar al presionar Escape o hacer clic en `✗`.
  - Estilos CSS: botones de 32-36px, `border-radius: 9999px`, fondos con translucidez de acento (`rgba(34, 197, 94, 0.15)` y `rgba(239, 68, 68, 0.15)`), bordes sutiles, microinteracciones de `scale(1.05)` en hover y sombras suaves. En pantallas estrechas / celdas angostas, posicionamiento ergonómico tipo dock para evitar deformar el campo de texto.
- **Búsqueda Global con Resaltado (`<mark>`)**:
  - Implementar función helper `highlightMatches(text: string, query: string): React.ReactNode` que detecte coincidencias insensibles a mayúsculas y aplique etiquetas `<mark className={styles.highlight}>`.
  - Definir clase `.highlight` en `EditableTable.module.css` con color ámbar translúcido compatible con glassmorphism claro y oscuro (`rgba(250, 204, 21, 0.35)`).
  - Aplicar resaltado a valores formateados de celdas estándar y proveer acceso al helper para celdas con renderer personalizado (como `amount`).
- **Paginación y Conteo**:
  - Utilizar el soporte de `initialLimit={20}` para mostrar inicialmente 20 registros.
  - El botón inferior alternará: `"Ver todos los movimientos (X en total) 👇"` y `"Mostrar solo primeros 20 movimientos ☝️"`.
  - Al escribir en el buscador, la búsqueda debe filtrar sobre la totalidad de los datos y recortar el despliegue al límite configurado solo si excede los 20 resultados.

#### 2. Modificaciones en `TransactionsList.tsx`:
- **Filtros por Columna**:
  - Configurar los 4 filtros requeridos:
    1. **Fecha**: Dropdown con opciones de meses detectados en el historial (o todas las fechas).
    2. **Tipo**: Dropdown con opciones "Todos", "Ingreso", "Egreso", "Ahorro", "Inversión".
    3. **Categoría**: Dropdown dinámico con todas las categorías únicas presentes en los datos.
    4. **Subcategoría**: Dropdown dinámico con las subcategorías (reactivo a la categoría seleccionada).
- **Alimentación de Datos Desacoplada del Período**:
  - En la pestaña "Movimientos", `TransactionsList` debe recibir la totalidad de los movimientos históricos registrados (`data`), sin recortar por `balanceMonth`.

#### 3. Infraestructura de Tests:
- Crear una suite de pruebas unitarias y de integración para `EditableTable` y `TransactionsList` (ej. `src/components/shared/EditableTable.test.tsx` y `src/components/dashboard/TransactionsList.test.tsx`) que compruebe:
  - Renderizado inicial con límite de 20 registros.
  - Expansión de la lista al pulsar "Ver todos".
  - Funcionamiento de la búsqueda global con generación de tags `<mark>`.
  - Funcionamiento de los 4 filtros por columna.
  - Edición in-situ: visualización inmediata de botones Guardar/Cancelar, guardado directo con Enter / clic en ✓, y cancelación con Escape / clic en ✗.

---

## 5. Método de Verificación Independiente (Verification Method)

Para verificar de forma autónoma y reproducible las afirmaciones y la salud del sistema:

1. **Ejecutar Suite de Pruebas**:
   ```bash
   npm test -- --run
   ```
   *Criterio de éxito*: Los 5 archivos de prueba actuales continúan pasando (60/60 tests). Tras implementar los nuevos tests de componentes, la suite debe reportar 100% de tests aprobados.

2. **Ejecutar Compilación de Producción**:
   ```bash
   npm run build
   ```
   *Criterio de éxito*: Salida exitosa (código 0) sin errores de sintaxis TypeScript, validación de tipos Next.js exitosa y bundles generados en `.next/`.

3. **Verificación Visual e Interactiva de R4 (una vez implementado)**:
   - Abrir la aplicación y navegar a la pestaña "Movimientos".
   - Constatar que inicialmente se observan hasta 20 movimientos y existe el botón para ver el total.
   - Probar los 4 filtros desplegables (Fecha, Tipo, Categoría, Subcategoría) y verificar que la tabla se actualiza en tiempo real.
   - Escribir una palabra clave en el buscador y verificar que busca en transacciones de cualquier fecha/mes y resalta el texto coincidente con fondo distintivo (`<mark>`).
   - Hacer clic en una celda de la tabla: comprobar que aparecen inmediatamente los botones tipo pill Guardar (✓) y Cancelar (✗) sin requerir clic afuera. Modificar el texto y presionar ✓ (o Enter) para guardar; verificar que se actualiza. Probar también la cancelación con ✗ (o Escape).

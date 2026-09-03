# 🧠 Guía Completa de Insights, Alertas y Salud Financiera

Bienvenido a la documentación oficial del **Motor de Inteligencia Financiera** de **Balance**. 

Este sistema analiza continuamente tus transacciones, compras en cuotas e historial para ofrecerte diagnósticos proactivos, alertas tempranas de desvío y herramientas para construir tu tranquilidad económica.

---

## 📑 Índice de Contenidos
1. [🛡️ Fondo de Emergencia](#1-️-fondo-de-emergencia)
2. [📈 Proyección de Gasto Elevada (Burn Rate)](#2--proyección-de-gasto-elevada-burn-rate)
3. [💳 Vencimiento de Tarjetas y Cuotas](#3--vencimiento-de-tarjetas-y-cuotas)
4. [⚠️ Detección de Picos Anómalos por Categoría](#4-️-detección-de-picos-anómalos-por-categoría)
5. [☕ Control de Gastos Hormiga](#5--control-de-gastos-hormiga)
6. [⚖️ Diagnóstico Presupuestario (Regla 50 / 30 / 20)](#6-️-diagnóstico-presupuestario-regla-50--30--20)
7. [🔄 Detección de Suscripciones y Recurrentes](#7--detección-de-suscripciones-y-recurrentes)
8. [🎉 Fin y Desahogo de Cuotas](#8--fin-y-desahogo-de-cuotas)
9. [🌟 Hitos y Récords de Ahorro](#9--hitos-y-récords-de-ahorro)
10. [🔮 Estructura Futura: Categoría "Ahorro"](#10--estructura-futura-categoría-ahorro)

---

## 1. 🛡️ Fondo de Emergencia

### ¿Qué es?
El **Fondo de Emergencia** (o *colchón de seguridad*) es el dinero reservado exclusivamente para hacer frente a imprevistos (urgencias médicas, reparaciones del hogar, pérdida temporal de ingresos). Se mide en **meses de costo de vida**.

### ¿Cómo se calcula?
1. **Gasto Mensual Promedio de Vida ($G_{prom}$):**
   Calcula la media de tus egresos mensuales en meses cerrados, **excluyendo** transferencias entre cuentas propias y aportes a ahorro/inversiones:
   $$\text{Gasto Promedio} = \frac{\text{Total de Egresos de Vida Históricos}}{\text{Cantidad de Meses Registrados}}$$

2. **Meta de Tranquilidad ($Meta_{FE}$):**
   Multiplica tu gasto mensual promedio por la cantidad de meses objetivo que hayas configurado en el selector (por defecto $6\text{ meses}$):
   $$\text{Meta} = \text{Gasto Promedio} \times \text{Meses Objetivo}$$

3. **Meses de Cobertura Actuales (*Runway*):**
   $$\text{Meses Cubiertos} = \frac{\text{Saldo del Fondo de Emergencia}}{\text{Gasto Promedio}}$$

4. **Porcentaje de Avance:**
   $$\% \text{ Progreso} = \min\left(100\%, \frac{\text{Saldo Actual}}{\text{Meta}} \times 100\right)$$

### Estados Semafóricos:
- 🟢 **Blindado ($\ge 100\%$ de la meta):** Tienes cubierta la totalidad de meses recomendados.
- 🟡 **En Camino ($50\% - 99\%$):** Cuentas con un colchón importante pero aún puedes fortalecerlo.
- 🔴 **En Construcción ($< 50\%$):** Es prioritario destinar parte del ahorro mensual a robustecer este fondo.

---

## 2. 📈 Proyección de Gasto Elevada (*Burn Rate*)

### ¿Qué significa?
Te advierte durante el mes en curso si tu ritmo diario de consumo te llevará a cerrar el mes con un sobregasto respecto a tu historial.

### ¿Cómo se calcula?
- **Disponibilidad:** Se activa a partir del **día 3** del mes real en curso.
- **Ritmo de Gasto Diario:**
  $$\text{Ritmo Diario} = \frac{\text{Egresos acumulados al día de hoy}}{\text{Días transcurridos en el mes}}$$
- **Proyección a Fin de Mes:**
  $$\text{Proyección} = \text{Ritmo Diario} \times \text{Días totales del mes}$$
- **Disparador de Alerta:** Si la proyección supera en más de un **$10\%$** tu promedio mensual histórico de egresos, la alerta se enciende indicando el monto proyectado y el porcentaje de desvío.

---

## 3. 💳 Vencimiento de Tarjetas y Cuotas

### ¿Qué significa?
Anticipa los pagos de cuotas exigibles para que puedas verificar que dispones de fondos líquidos suficientes antes de que venza el resumen de tarjeta.

### ¿Cómo se calcula?
- Analiza todos tus planes de cuotas activos cargados en la aplicación.
- **Ventana de 7 días:**
  - Si estás en los **últimos 7 días del mes:** Suma las cuotas del mes entrante (preparación de cierre de tarjeta).
  - Si estás en los **primeros 7 días del mes:** Suma las cuotas del mes actual (vencimiento inminente).
- **Disparador:** Si la suma es mayor a $\$0$, emite una alerta crítica con el importe exacto exigible.

---

## 4. ⚠️ Detección de Picos Anómalos por Categoría (*Spike Detection*)

### ¿Qué significa?
Detecta si en alguna categoría de gasto específica (ej. *Delivery*, *Supermercado*, *Salidas*) estás gastando sustancialmente más de lo habitual.

### ¿Cómo se calcula?
1. Suma el gasto de cada categoría en el mes seleccionado.
2. Calcula el promedio de gasto de esa **misma categoría** en los **3 meses inmediatamente anteriores**.
3. **Disparador:** Se activa cuando:
   $$\text{Gasto Actual} > 1.35 \times \text{Promedio Últimos 3 Meses} \quad \text{y} \quad (\text{Gasto Actual} - \text{Promedio}) > \$15.000$$
4. Te muestra el porcentaje de incremento ($+\%$) y la comparativa de montos para que puedas corregir a tiempo.

---

## 5. ☕ Control de Gastos Hormiga (*Micro-spending*)

### ¿Qué significa?
Identifica pequeños consumos diarios (cafeterías, kioscos, snacks, golosinas, taxis cortos) que individualmente parecen insignificantes, pero que acumulados erosionan una porción relevante de tus ingresos.

### ¿Cómo se calcula?
- **Filtro de Microcompra:** Transacciones de egreso individuales menores o iguales a **$\$8.000$**.
- **Disparador:** Se activa si en el mes se cumplen simultáneamente:
  1. Hay **$4$ o más** microcompras.
  2. La suma acumulada supera los **$\$20.000$**.
  3. Representan al menos el **$7\%$** de tus egresos totales del mes.
- Te muestra la cantidad de compras, el total acumulado y el porcentaje del presupuesto que absorbieron.

---

## 6. ⚖️ Diagnóstico Presupuestario (Regla 50 / 30 / 20)

### ¿Qué significa?
Es un marco financiero internacional de referencia para evaluar si tus ingresos están saludablemente distribuidos.

### Categorización Automática:
1. **🏠 Necesidades Básicas (Meta: hasta 50% del ingreso):**
   - Gastos esenciales e inflexibles para vivir: *Alquiler, Expensas, Impuestos, Electricidad, Gas, Internet, Supermercado/Mercadería, Farmacia, Salud, Educación, Transporte fijo*.
2. **🎉 Deseos y Ocio (Meta: hasta 30% del ingreso):**
   - Consumo discrecional y estilo de vida: *Salidas, Restaurantes, Bares, Delivery, Ropa/Indumentaria, Entretenimiento, Videojuegos, Libros, Suscripciones*.
3. **🌱 Ahorro e Inversión (Meta: al menos 20% del ingreso):**
   - Capital retenido para el futuro: *Aportes a Fondo de Emergencia, Jubilación, Inversiones o Balance neto positivo del mes*.

### Diagnósticos Emitidos:
- **Gastos Fijos Elevados:** Se dispara si las Necesidades superan el **$60\%$** del ingreso.
- **Alto Consumo en Ocio:** Se dispara si los Deseos superan el **$40\%$** del ingreso.

---

## 7. 🔄 Detección de Suscripciones y Recurrentes

### ¿Qué significa?
Detecta automáticamente gastos fijos periódicos (servicios de streaming, membresías de gimnasio, software, abonos) para prevenir el pago de servicios que ya no utilizas.

### ¿Cómo se calcula?
- Examina el historial de transacciones buscando cargos con notas/conceptos idénticos o subcategorías de *Suscripciones/Servicios*.
- Verifica que el gasto ocurra con frecuencia ($\ge 2\text{ veces}$) y que los montos sean estables (variación menor al $20\%$ entre el mínimo y máximo).
- Muestra la cantidad de servicios activos y destaca el de mayor importe mensual.

---

## 8. 🎉 Fin y Desahogo de Cuotas (*Debt Payoff Milestone*)

### ¿Qué significa?
Te avisa cuando estás pagando la **última cuota** de una compra financiada.

### ¿Cómo se calcula?
- Cruza la fecha actual con el plazo final de cada plan de cuotas registrado.
- **Disparador:** Si el mes actual coincide con la cuota $N$ de $N$ (`mes_actual === mes_fin`), emite un aviso celebrando la cancelación de la deuda e informando el monto mensual que quedará liberado en tu flujo de caja a partir del próximo mes.

---

## 9. 🌟 Hitos y Récords de Ahorro

### ¿Qué significa?
Refuerza los comportamientos financieros positivos y la constancia de ahorro.

### ¿Cómo se calcula?
- Calcula la **Tasa de Ahorro Neta (TAN)** del mes:
  $$\text{TAN} = \frac{\text{Ingresos} - \text{Egresos}}{\text{Ingresos}} \times 100$$
- **Disparador:** Si tus ingresos son positivos y lograste retener un **$\ge 25\%$** de tu dinero, emite un reconocimiento felicitándote por superar la meta recomendada del $20\%$.

---

## 10. 🔮 Estructura del Tipo "Inversión" y Dólar MEP

La aplicación cuenta con el tipo **`Inversión`** (color violeta `#8b5cf6`), estructurado con las siguientes categorías y subcategorías:

```
Tipo: Inversión (🟣 Violeta)
├── Categoría: Ahorro
│   ├── Subcategoría: Emergencia   (Alimenta el Fondo de Emergencia de 6 meses)
│   └── Subcategoría: Jubilación   (Ahorro/Inversión previsional a largo plazo)
└── Categoría: Activos Financieros
    ├── Subcategoría: Acciones
    ├── Subcategoría: Cedears
    ├── Subcategoría: Bonos
    ├── Subcategoría: ETFs
    ├── Subcategoría: Cripto
    └── Subcategoría: Otros activos
```

### ¿Cómo interactúa el sistema con esta categoría?
1. **Protección de Costos de Vida:** Los movimientos de `Inversión` no se computan como gastos de consumo corriente. No aumentarán artificialmente tu costo de vida mensual ni distorsionarán tus promedios de gasto.
2. **Conversión Automática al Dólar MEP:** Si registras una inversión en **USD**, el sistema consulta la cotización del **Dólar MEP** y la convierte automáticamente a pesos (**ARS**) en el Balance para mantener la coherencia monetaria del flujo de caja.
3. **Acción Compra vs Venta:** 
   - `🟢 Compra / Aporte`: Resta de tu dinero en cuenta y suma a tu patrimonio de activos.
   - `🔴 Venta / Rescate`: Reintegra el dinero a tu saldo disponible en caja.
4. **Alimentación del Fondo de Emergencia:** Al registrar un movimiento bajo `Categoría: Ahorro` y `Subcategoría: Emergencia`, el sistema suma automáticamente ese dinero al saldo del Fondo de Emergencia.

---

*Documento generado para el proyecto **Balance** · Versión 2.0.*

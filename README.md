# 🏛️ Vesta — Finanzas Personales con IA & Inversiones

**Vesta** es una plataforma web progresiva (PWA) de finanzas personales, inversiones y salud patrimonial impulsada por Inteligencia Artificial (**Gemini 2.5 Flash**), **Next.js** y **Google Sheets API** como base de datos de costo cero ($0).

Combina la facilidad de registrar gastos por foto, texto o voz con métricas financieras avanzadas (TWR, DTI, TAN, Vesta Score, proyección de cashflow y benchmark vs. S&P 500).

---

## ✨ Características Principales

* 🤖 **Carga Inteligente con Gemini AI:**
  * Subí la foto de un ticket, factura o PDF (con compresión automática en cliente).
  * O simplemente escribí/dictá en lenguaje natural: *"Pagué 45000 en el súper con 5000 de descuento y 12000 de nafta"*.
  * Gemini extrae, clasifica por categorías/subcategorías, detecta reintegros a tu favor y convierte automáticamente montos en USD a Dólar MEP del día.
* 📈 **Módulo de Inversiones de Grado Profesional:**
  * Precios en tiempo real de **BYMA (Acciones y CEDEARs)** y **Criptomonedas (CoinGecko)**.
  * **TWR (Time-Weighted Return):** Cálculo de retorno puro libre del sesgo de depósitos/retiros de capital.
  * **Diversificación Doble:** Gráficos interactivos de desglose por tipo de activo y por **moneda de exposición real (ARS vs. USD)**.
  * **Benchmark S&P 500:** Curva histórica superpuesta que simula qué hubiera pasado si invertías el mismo capital en el índice SPY.
* 💳 **Gestor de Cuotas y Tarjetas de Crédito:**
  * Registro de compras financiadas (3, 6, 12, 18+ cuotas) con proyección cronológica mes a mes.
  * Cierre de períodos y conciliación de pagos con protección contra errores de redondeo de coma flotante.
* 🧠 **Inteligencia Financiera & Alertas Proactivas:**
  * **Proyección de Fin de Mes:** Calcula tu ritmo de gasto diario (*burn rate*) y te avisa si proyectás superar tu promedio histórico.
  * **Radar de Suscripciones:** Algoritmo que detecta débitos automáticos y cargos recurrentes olvidados.
  * **Alerta de Vencimiento de Tarjetas:** Notificación visual cuando tenés cuotas por vencer en los próximos 7 días.
* 🎨 **Diseño Material Design 3 (Responsive PC & Mobile):**
  * **Dashboard Hero:** 4 KPIs clave en el primer scroll (*above the fold*) con selector de período integrado.
  * **Extended FAB:** Botón flotante moderno abajo a la derecha para registrar movimientos rápidamente desde cualquier dispositivo.
  * Soporte nativo para **Modo Oscuro / Claro** con tokens de diseño MD3 y estética *Glassmorphism*.

---

## 📊 Guía de KPIs: ¿Cómo interpretar tu Salud Financiera?

Vesta calcula automáticamente métricas financieras clave. A continuación se detalla qué significa cada indicador y cuáles son los rangos recomendados:

```
┌───────────────────────────┬───────────────────────────────────┬───────────────────────────┐
│     🟢 Rango Óptimo       │        🟡 Rango Moderado          │      🔴 Zona de Alerta    │
└───────────────────────────┴───────────────────────────────────┴───────────────────────────┘
```

### 1. 💰 Tasa de Ahorro Neta (TAN)
$$\text{TAN} = \left( \frac{\text{Ingresos} - \text{Egresos}}{\text{Ingresos}} \right) \times 100$$

* **¿Qué mide?** El porcentaje real de tus ingresos que lográs retener al final del mes para ahorro o inversión.
* **Semáforo:**
  * 🟢 **Excelente ($\ge 20\%$):** Gran capacidad de acumulación de riqueza y fondo de emergencia.
  * 🟡 **Moderado ($10\% - 19.9\%$):** Saludable, pero con margen para optimizar gastos hormiga.
  * 🔴 **Bajo ($< 10\%$ o negativo):** Alerta; estás viviendo al día o descapitalizándote para cubrir el mes.

---

### 2. 💳 Compromiso de Cuotas / Ratio Deuda-Ingreso (DTI)
$$\text{DTI} = \left( \frac{\text{Monto en Cuotas del Mes}}{\text{Ingresos del Período}} \right) \times 100$$

* **¿Qué mide?** Qué porción de tu sueldo mensual ya está "comprometida" por compras pasadas en tarjeta de crédito.
* **Semáforo:**
  * 🟢 **Saludable ($\le 30\%$):** Excelente nivel de liquidez; tus tarjetas no comprometen tu mes.
  * 🟡 **Precaución ($31\% - 45\%$):** Nivel medio; un imprevisto puede generarte tensión de caja.
  * 🔴 **Riesgo ($> 45\%$):** Sobreendeudamiento; se recomienda pausar compras financiadas hasta cancelar saldos.

---

### 3. 🌟 Vesta Score ($0 - 100$)
Índice integral ponderado que califica tu salud financiera global en un solo número:
* **Composición:** Tasa de Ahorro ($30\text{ pts}$) + Control de Deuda/DTI ($30\text{ pts}$) + Inversión activa ($20\text{ pts}$) + Control de suscripciones recurrentes ($20\text{ pts}$).
* **Interpretación:**
  * 🌟 **$80 - 100$ (Excelente):** Hábitos financieros sobresalientes; ahorrás, no te sobreendeudás e invertís tu capital.
  * ⚠️ **$50 - 79$ (Mejorable):** Balance positivo pero con áreas claras de mejora (reducir cuotas o aumentar ahorro).
  * 🚨 **$< 50$ (Riesgo):** Requiere atención urgente en la reducción de costos y saneamiento de pasivos.

---

### 4. 📈 Time-Weighted Return (TWR) en Inversiones
$$\text{TWR} = \prod_{i=1}^n (1 + r_i) - 1$$

* **¿Qué mide?** El rendimiento porcentual puro de tu portafolio, **aislando y neutralizando el impacto de los depósitos o retiros de dinero**.
* **¿Por qué importa?** Si tu portafolio subió porque depositaste dinero, el retorno tradicional miente. El TWR mide exclusivamente si tus activos están rindiendo bien.
* **Benchmark Overlay:** Si la línea de tu portafolio supera la curva punteada del **S&P 500**, significa que tu cartera le está ganando al mercado de referencia global.

---

## 🛠️ Tecnologías y Arquitectura

* **Frontend & Backend:** [Next.js 15](https://nextjs.org/) (App Router, React 19, Server Components & Route Handlers).
* **Database & Storage:** [Google Sheets API v4](https://developers.google.com/sheets/api) (con sanitización contra inyecciones de fórmulas y lectura optimizada de rango).
* **Inteligencia Artificial:** [@google/genai](https://ai.google.dev/) (Gemini 2.5 Flash).
* **Autenticación:** [NextAuth.js](https://next-auth.js.org/) con Google OAuth2 y lista blanca estricta (`ALLOWED_EMAILS`).
* **Visualización de Datos:** Chart.js, React-ChartJS-2 y Google Charts (Sankey Diagram).
* **Testing:** [Vitest](https://vitest.dev/) con suite completa de pruebas unitarias.

---

## ⚙️ Configuración y Ejecución Local

### 1. Variables de Entorno (`.env.local`)

Crea un archivo `.env.local` en la raíz del proyecto con la siguiente estructura:

```env
# URL de la aplicación
NEXTAUTH_URL=http://localhost:3000
# Clave aleatoria para cookies de sesión (generar con: openssl rand -base64 32)
NEXTAUTH_SECRET=tu_clave_secreta_super_segura

# Credenciales de Google Cloud Console (OAuth2 + Google Sheets API)
GOOGLE_CLIENT_ID=tu-cliente.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-secreto-de-google

# ID de la planilla de Google Sheets (desde la URL de la hoja)
GOOGLE_SHEET_ID=tu-id-de-google-sheets

# API Key de Google AI Studio (Gemini)
GEMINI_API_KEY=tu-clave-de-gemini

# Lista Blanca de correos autorizados (separados por coma)
ALLOWED_EMAILS="tu.correo@gmail.com,otroautorizado@gmail.com"
```

### 2. Estructura de la Hoja de Google Sheets

Asegúrate de que tu Google Sheet tenga las siguientes pestañas y columnas en la Fila 1:
* **Hoja 1 (Movimientos):** `ID` | `Fecha` | `Tipo` | `Categoría` | `Subcategoría` | `Monto` | `Comentario` | `CuotaRef`
* **Hoja `Cuotas` (opcional):** `ID` | `Fecha` | `Concepto` | `MontoTotal` | `CantidadCuotas` | `MesInicio` | `Tarjeta`
* **Hoja `Inversiones` (opcional):** `ID` | `Fecha` | `Operación` | `Activo` | `TipoActivo` | `Cantidad` | `PrecioUnitario` | `Cartera`

---

### 3. Instalación y Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Correr suite de tests
npm test

# 3. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🧪 Pruebas Unitarias

El proyecto incluye tests automáticos que garantizan la integridad financiera de los cálculos:

```bash
npm test
```

* Valida la lógica de cuotas y fechas argentinas (`DD/MM/YYYY`).
* Valida el cálculo matemático de **TWR** y la agregación de rendimientos del portafolio.
* Valida el parseo seguro de números con formato de miles y decimales locales (`$1.234.567,89`).

---

## 🚀 Despliegue en Producción (Vercel)

1. Conecta tu repositorio de GitHub a tu cuenta de **Vercel**.
2. Agrega todas las variables de entorno de tu `.env.local` en la sección **Settings ➔ Environment Variables** de Vercel.
3. Actualiza `NEXTAUTH_URL` con tu dominio oficial de producción (ej. `https://vesta.tu-dominio.com`).
4. En **Google Cloud Console ➔ Credenciales OAuth**, agrega el dominio de producción en los *Orígenes de JavaScript autorizados* y añade `https://vesta.tu-dominio.com/api/auth/callback/google` en las *URIs de redireccionamiento autorizadas*.
5. ¡Listo! Puedes instalar Vesta como **PWA** directamente desde el navegador de tu teléfono móvil.

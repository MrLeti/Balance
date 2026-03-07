# 📊 Balance - Finanzas Personales con IA

**Balance** es una Aplicación Web Progresiva (PWA) de gestión de finanzas personales diseñada para ser sencilla, potente y gratuita. Utiliza de forma ingeniosa herramientas modernas para conseguir una plataforma 100% libre de costos de servidor y base de datos.

Impulsada por **Next.js**, **Google Sheets** (como base de datos) y **Google Gemini 2.5** (Inteligencia Artificial para reconocimiento de comprobantes), permite registrar ingresos, egresos y procesar facturas subiendo fotos o escribiendo de manera natural.

---

## ✨ Características Principales

*   **🎙️🖼️ Carga Inteligente (IA):** Arrojá una foto de tu ticket de supermercado, o escribile a la IA "Gasté $5000 en el súper y $2000 en nafta". **Gemini** se encarga de extraer, categorizar matemáticamente y listar los ítems automáticamente.
*   **🧠 Descuentos y Dólar MEP:** Detecta inteligentemente cuando una compra incluye descuentos/reintegros y los asienta a tu favor (en azul). Identifica si subiste una carga en dólares y la convierte automáticamente usando la API de Dólar MEP del día.
*   **📊 Dashboards Avanzados (Glassmorphism):**
    *   **Drill-down Pie Chart:** Desglose interactivo por Categorías y Subcategorías (Ej: Clic en *Egresos Habitacionales* filtra y muestra la composición de *Suscripciones, Luz, Internet, etc*).
    *   **Balance Histórico:** Comparativas entre ingresos/egresos mensuales y acumulados en el tiempo.
    *   **Historial Semántico:** Listado visual rápido con logotipos (emojis) auto-asignados por categoría y colores de impacto. Funcionalidad sencilla de **borrado web** que sincroniza instantáneamente con Sheets.
*   **🔒 Login Seguro Restringido:** Usa OAuth2 de Google. Nadie puede ver tu balance a menos que su correo electrónico esté dentro de una lista blanca (Whitelist) pre-aprobada por vos.
*   **📱 Mobile First (PWA):** Instálala en tu iPhone o Android. Reacciona a Modo Oscuro / Light y colapsa perfectamente a una sola vista sin necesidad de zoom. Base de datos descentralizada.

---

## 🛠️ Tecnologías

*   **Framwork:** Next.js (App Router) y React.
*   **Baas / DB:** Google Sheets API (Costo $0).
*   **Autenticación:** NextAuth.js (Google Provider).
*   **IA:** `@google/generative-ai` (Gemini 2.5 Flash).
*   **Gráficos:** `chart.js` & `react-chartjs-2`.
*   **Estilos:** CSS Vanilla (Modules + Global Variables) con estética *Glassmorphism*.

---

## ⚙️ Configuración para Ejecución Local

Para correr este proyecto en tu computadora o desplegarlo, necesitas configurar el archivo de variables de entorno `.env.local` en la raíz del proyecto.

### Template de `.env.local`

Deberás tener definidas las siguientes variables:

```env
# URL de la app (uso local o dominio oficial en Vercel)
NEXTAUTH_URL=http://localhost:3000
# Una clave al azar y secreta para encriptar las cookies de sesión (crearla con: openssl rand -base64 32)
NEXTAUTH_SECRET=tu_clave_secreta_super_larga

# IDs de Google Cloud Console (APIs de Sheets y OAuth Google)
GOOGLE_CLIENT_ID=codigo-cliente.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-secreto-de-google

# ID de la hoja de Google Sheets (Extraído de la URL de tu planilla)
GOOGLE_SHEET_ID=tu-id-alfanumerico-de-sheets

# API Key de AI Studio (Google Gemini)
GEMINI_API_KEY=tu-clave-secreta-de-api-gemini

# Lista Blanca de Seguridad (Separar correos permitidos para el login por comas)
ALLOWED_EMAILS="tu.correo@gmail.com,otroautorizado@gmail.com"
```

### Instrucciones de Instalación

1. Clona el repositorio e ingresa a la carpeta:
    \`\`\`bash
    git clone https://github.com/tu-usuario/Balance.git
    cd Balance
    \`\`\`
2. Instala las dependencias:
    \`\`\`bash
    npm install
    \`\`\`
3. Prepara tu Google Sheet: Crea una nueva Planilla de cálculo de Google. Asegúrate de tener las siguientes columnas en la Fila 1 (A-G): \`ID\`, \`Fecha\`, \`Tipo\`, \`Categoría\`, \`Subcategoría\`, \`Monto\`, \`Comentario\`.
4. Ejecuta el servidor de desarrollo:
    \`\`\`bash
    npm run dev
    \`\`\`
5. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🚀 Despliegue en Producción (Vercel)

1. Enlaza tu repositorio de GitHub a tu cuenta de Vercel.
2. Agrega TODAS las variables detalladas arriba en la pestaña **Environment Variables** de la configuración del proyecto en Vercel.
3. Asegúrate de configurar la variable \`NEXTAUTH_URL\` a tu dominio principal oficial \`https://balance-app-xyz.vercel.app\`.
4. Ve a *Google Cloud Console > Credenciales*. En tu ID de cliente OAuth autorizado agrega tu nuevo dominio oficial de Vercel a los "Orígenes de JavaScript autorizados" y a las "URI de redireccionamento autorizados" añadiendo siempre al final de este último la ruta de tu callback: \`/api/auth/callback/google\`.
5. Ejecuta un nuevo Deploy. ¡Instálala como PWA desde tu teléfono abriendo ese dominio!

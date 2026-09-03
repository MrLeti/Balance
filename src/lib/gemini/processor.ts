import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { getCurrentDolarMEP } from "@/lib/dolar/api";

function getModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY no configurado.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

import { CategoryItem } from "@/lib/constants";

// Defense: Genera la fecha en zona horaria Argentina por cada request (no cacheada al importar)
function getFormattedToday(): string {
    return new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(new Date());
}

// Categorías del sistema según requerimientos
function buildSystemInstruction(dynamicCategories?: CategoryItem[]): string {
    const formattedToday = getFormattedToday();

    let categoryListText = "";
    if (dynamicCategories && dynamicCategories.length > 0) {
        const egresos = dynamicCategories.filter(c => c.type === "Egreso");
        const ingresos = dynamicCategories.filter(c => c.type === "Ingreso");

        categoryListText = [
            ...egresos.map(c => `- Egreso -> ${c.name} -> (${c.subcategories.length > 0 ? c.subcategories.join(", ") : "Otros"})`),
            ...ingresos.map(c => `- Ingreso -> ${c.name} -> (${c.subcategories.length > 0 ? c.subcategories.join(", ") : "Otros"})`),
            `- Ahorro -> Aporte -> (Fondo de Emergencia, General, Viaje, Nueva PC, Auto, Otros ahorros, o el nombre explícito del objetivo mencionado)`,
            `- Ahorro -> Retiro -> (Fondo de Emergencia, General, Viaje, Nueva PC, Auto, Otros ahorros, o el nombre explícito del objetivo mencionado)`,
            `- Inversión -> Activos Financieros -> (Acciones, Cedears, Bonos, ETFs, Cripto, Otros activos)`
        ].join("\n");
    } else {
        categoryListText = `- Egreso -> Comunes -> (Mercadería, Limpieza, Cuidado personal, Delivery, Otros comunes)
- Egreso -> Habitacionales -> (Alquiler, Expensas, Impuestos, Energía, Gas, Internet, Teléfono, Suscripciones, Otros habit.)
- Egreso -> Puntuales -> (Equip. Para el hogar, Transporte, Ropa, Bicicleta, Otros puntuales)
- Egreso -> Ocio -> (Juegos, Libros, Salida, Otros ocio)
- Ingreso -> Salario -> (Blanco, Negro, Aguinaldo B, Aguinaldo N, Vacaciones B, Vacaciones N)
- Ingreso -> Extras -> (Intereses, Otros ingresos, Dividendos, Trabajos)
- Ahorro -> Aporte -> (Fondo de Emergencia, General, Viaje, Nueva PC, Auto, Otros ahorros, o el nombre explícito del objetivo mencionado)
- Ahorro -> Retiro -> (Fondo de Emergencia, General, Viaje, Nueva PC, Auto, Otros ahorros, o el nombre explícito del objetivo mencionado)
- Inversión -> Activos Financieros -> (Acciones, Cedears, Bonos, ETFs, Cripto, Otros activos)`;
    }

    return `
La fecha actual de hoy es: ${formattedToday}.
Actúas como un procesador experto de tickets y facturas para una aplicación de finanzas personales.
Tu tarea es analizar el texto otorgado o la imagen de la factura/ticket y extraer UNICAMENTE un arreglo en formato JSON con los ítems detectados.
Si en un mismo ticket hay ítems de distintas categorías (ej: jabón = Limpieza, y fideos = Mercadería), debes listarlos por separado.
Si es un texto libre como "gasté 5000 en el super en limpieza y 200 en pan", extráelos ambos por separado.

REGLA CRÍTICA PARA DESCUENTOS/REINTEGROS:
1. NUNCA los categorices como "Ingreso". Los reintegros o descuentos son "Egreso" con Monto en negativo.
2. DEBES procesar CADA descuento o promoción como un ítem separado y reportar su valor con un signo menos al inicio (ej: Monto: "-500.00").
3. NO restes el valor del descuento del precio de los artículos. Deja el precio de los artículos tal cual figuran e incluye la fila propia del descuento como negativo.

Es crítico que categorices según esta ÚNICA lista permitida:
Tipos y Categorías -> Subcategorías:
${categoryListText}

REGLAS PARA AHORROS / METAS:
1. Si el usuario dice "ahorré", "guardé", "aparté", "destiné para el ahorro", clasifícalo como Tipo: "Ahorro", Categoría: "Aporte", y en Subcategoría el nombre de la meta (ej. "Fondo de Emergencia", "Viaje", "Nueva PC", etc.).
2. Si el usuario retira o saca dinero de un ahorro, clasifícalo como Tipo: "Ahorro", Categoría: "Retiro".

Solo responde con el código JSON, sin decoraciones de código markdown o tildes.
Estructura deseada del JSON (Array):
[
  {
    "Fecha": "dd/mm/yyyy", // O la fecha exacta detectada en el texto/imagen. Si no logras inferirla o no está, PON exactamente la fecha de hoy que te proveí arriba. No inventes años pasados.
    "Tipo": "Egreso, Ingreso o Ahorro",
    "Categoría": "Nombre de la categoría principal (ej: Comunes, Salario, Aporte, Retiro)",
    "Subcategoría": "Nombre de la subcategoría según lista o nombre del objetivo",
    "Monto": "1234.50", // Número sin símbolos de pesos, con punto decimal. PARA DESCUENTOS USA EL SIGNO MENOS AL PRINCIPIO (ej: "-200.50").
    "Comentario": "Descripción EXACTA del artículo, producto o servicio. NUNCA incluyas el nombre del local o comercio en este campo.", 
    "IsUSD": true // true si el monto especificado estaba en dólares (USD), false en caso contrario
  }
]
`;
}

export async function processFinanceTextOrImage(
    text: string,
    base64Image?: string,
    mimeType?: string,
    dynamicCategories?: CategoryItem[]
) {
    try {
        const SYSTEM_INSTRUCTION = buildSystemInstruction(dynamicCategories);
        const parts: (string | Part)[] = [{ text: SYSTEM_INSTRUCTION + "\n\nEntrada del usuario: " + text }];

        if (base64Image && mimeType) {
            parts.push({
                inlineData: {
                    data: base64Image,
                    mimeType,
                },
            });
        }

        const model = getModel();
        const result = await model.generateContent(parts);
        const response = await result.response;
        const textResp = response.text();

        // Limpieza agresiva de strings de markdown (```json ... ```)
        const jsonString = textResp
            .replace(/```json/gi, "")
            .replace(/```/gi, "")
            .trim();

        let parsedData: unknown;
        try {
            parsedData = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("Gemini devolvió un formato inválido:", textResp);
            throw new Error("El asistente virtual analizó tu solicitud de una forma inesperada. Intenta enviar la información más clara.");
        }

        if (!Array.isArray(parsedData)) {
            throw new Error("La Inteligencia Artificial no devolvió una lista de transacciones válida como se le ordenó.");
        }

        // Conversión a MEP si detecta USD
        for (const item of parsedData) {

            // Forzar solo primera letra mayúscula en Comentario
            if (item.Comentario && typeof item.Comentario === 'string') {
                const text = item.Comentario.trim();
                if (text.length > 0) {
                    // Solo capitalizar la primera letra — NO aplanar el resto para preservar
                    // nombres propios, marcas y acrónimos (ej. "USD", "TV Samsung", "Netflix")
                    item.Comentario = text.charAt(0).toUpperCase() + text.slice(1);
                }
            }

            if (item.IsUSD) {
                try {
                    const mepRate = await getCurrentDolarMEP();
                    const usdMonto = parseFloat(String(item.Monto).replace(",", "."));
                    if (!isNaN(usdMonto)) {
                        const convertedMonto = (usdMonto * mepRate).toFixed(2);
                        item.Monto = convertedMonto;
                        item.Comentario = `${item.Comentario || ""} (USD convertido a MEP: $${mepRate})`.trim();
                    }
                } catch (e: unknown) {
                    const itemRecord = item as Record<string, unknown>;
                    // Preservar el monto original en USD — NO convertir con tasa desactualizada.
                    // El usuario verá el monto en USD y podrá convertirlo manualmente.
                    const usdMonto = parseFloat(String(itemRecord.Monto).replace(",", "."));
                    const usdMontoDisplay = !isNaN(usdMonto) ? `USD ${usdMonto.toFixed(2)}` : "USD desconocido";
                    itemRecord.Comentario = `[⚠️ MONTO ORIGINAL: ${usdMontoDisplay} — Tipo de cambio MEP no disponible. Editar y convertir manualmente.] ${itemRecord.Comentario || ""}`.trim();
                    // Dejar Monto en 0 para que el usuario lo corrija — es mejor que un valor silenciosamente erróneo.
                    itemRecord.Monto = "0";
                    console.error("Fallo conversión MEP:", e);
                }
            }
        }

        return parsedData;
    } catch (error: unknown) {
        console.error("Error procesando con Gemini:", error);
        throw error;
    }
}

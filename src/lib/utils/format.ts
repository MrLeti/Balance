// ─────────────────────────────────────────────────────────
// Formateo de números y monedas — utilidades compartidas
// ─────────────────────────────────────────────────────────
// Instanciar Intl.NumberFormat UNA SOLA VEZ a nivel de módulo
// es significativamente más eficiente que crearlo en cada render.

/** Formateador de pesos argentinos: .234.567,89 */
const arsFormatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** Formateador de número simple con 2 decimales: 1.234.567,89 */
const numFormatter = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Formatea un número como pesos argentinos.
 * @example fmt(1234567.89) → "$ 1.234.567,89"
 */
export function fmt(n: number): string {
    return arsFormatter.format(n);
}

/**
 * Formatea un número con 2 decimales sin símbolo de moneda.
 * @example fmtNum(1234567.89) → "1.234.567,89"
 */
export function fmtNum(n: number): string {
    return numFormatter.format(n);
}

/**
 * Formatea un número con sufijo compacto (K, M) para labels de gráficos.
 * @example fmtCompact(1500000) → "$1.5M"
 * @example fmtCompact(3500)    → "$3.5K"
 */
export function fmtCompact(n: number): string {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return fmt(n);
}

/**
 * Formatea un porcentaje con signo y 2 decimales.
 * @example fmtPct(23.07)  → "+23.07%"
 * @example fmtPct(-20.13) → "-20.13%"
 */
export function fmtPct(n: number): string {
    const sign = n >= 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
}

/**
 * Redondea un importe a exactamente 2 decimales para dinero fiat (ARS / USD).
 * Utiliza Number.EPSILON para evitar errores clásicos de precisión de punto flotante IEEE-754 (ej. 1.005 o 0.1 + 0.2).
 */
export function roundMoney(n: number): number {
    if (typeof n !== "number" || isNaN(n) || !isFinite(n)) return 0;
    return Math.round((n + (n >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100;
}

/**
 * Valida si un valor es un importe numérico válido y operable.
 * Por defecto rechaza 0, NaN, infinitos y valores negativos.
 * Si allowNegative es true, permite valores negativos (ej. descuentos en Egresos o retiros en Ahorros).
 */
export function isValidAmount(value: unknown, allowNegative = false): boolean {
    if (value === null || value === undefined || value === "") return false;
    const num = typeof value === "number" ? value : parseSafeAmount(value);
    if (isNaN(num) || !isFinite(num) || num === 0) return false;
    if (!allowNegative && num < 0) return false;
    return true;
}

/**
 * Convierte de forma segura cualquier entrada numérica a un float real de JavaScript.
 * Maneja números nativos, notación argentina ("1.234,56" o "1234,56") y notación estándar ("1234.56").
 */
export function parseSafeAmount(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;

    let s = String(value).trim().replace(/[^\d.,-]/g, "");
    if (!s) return 0;

    const isNegative = s.startsWith("-");
    if (isNegative) s = s.substring(1);

    const hasComma = s.includes(",");
    const hasDot = s.includes(".");

    let result = 0;

    if (hasComma && hasDot) {
        // "1.234,56" vs "1,234.56"
        const lastComma = s.lastIndexOf(",");
        const lastDot = s.lastIndexOf(".");
        if (lastComma > lastDot) {
            s = s.replace(/\./g, "").replace(",", ".");
        } else {
            s = s.replace(/,/g, "");
        }
        result = parseFloat(s) || 0;
    } else if (hasComma && !hasDot) {
        // "1234,56" o "1,234,567"
        if ((s.match(/,/g) || []).length > 1) {
            s = s.replace(/,/g, "");
        } else {
            s = s.replace(",", ".");
        }
        result = parseFloat(s) || 0;
        const dotCount = (s.match(/\./g) || []).length;
        if (dotCount > 1) {
            s = s.replace(/\./g, "");
        }
        result = parseFloat(s) || 0;

    } else {
        result = parseFloat(s) || 0;
    }

    return isNegative ? -result : result;
}

/**
 * Evalúa expresiones aritméticas de sumas y restas (ej. "123.5+156.25" o "200-50+12.5").
 * Permite tanto comas como puntos decimales y es completamente seguro contra inyecciones de código.
 */
export function parseArithmeticExpression(value: unknown): number {

    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;

    let s = String(value).trim();
    if (!s) return 0;

    // Si no contiene operadores aritméticos, usar parseSafeAmount directo
    if (!/[+\-*/]/.test(s)) {
        return parseSafeAmount(s);
    }

    // Normalizar comas decimales a puntos
    s = s.replace(/,/g, ".");

    // Validar whitelist estricta: solo dígitos, operadores (+, -, *, /), paréntesis, puntos y espacios
    if (!/^[0-9+\-*/().\s]+$/.test(s)) {
        return parseSafeAmount(s);
    }

    try {
        // Función segura con modo estricto
        const evaluator = new Function(`"use strict"; return (${s});`);
        const result = evaluator();
        if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
            // Limpiar errores de coma flotante en JS (ej. 0.1 + 0.2 = 0.30000000000000004)
            return Math.round(result * 1000000) / 1000000;
        }
    } catch {
        // Fallback en caso de sintaxis incompleta (ej. mientras el usuario aún tipea "100+")
        return parseSafeAmount(s);
    }

    return parseSafeAmount(s);
}

/**
 * Auto-formats date input as DD/MM/YYYY while typing or editing.
 * Automatically appends '/' after 2 digits (day) and 2 digits (month) to jump to next segment.
 * Properly distinguishes single-character backspace from replacing/editing fields that already have dates.
 */
export function formatAutoDateInput(value: string, prevValue: string = ""): string {
    if (!value) return "";

    // Check if this was a genuine single-character backspace (shorter by 1 and prefix match)
    const isSingleCharBackspace =
        prevValue.length > 0 &&
        prevValue.length - value.length === 1 &&
        prevValue.startsWith(value);

    if (isSingleCharBackspace) {
        if (value.endsWith("/")) {
            return value.slice(0, -1);
        }
        return value;
    }

    // Strip non-digits and limit to 8 numbers (DDMMYYYY)
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length === 0) return "";

    if (digits.length < 2) {
        return digits;
    } else if (digits.length === 2) {
        return `${digits}/`;
    } else if (digits.length < 4) {
        return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else if (digits.length === 4) {
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/`;
    } else {
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }
}



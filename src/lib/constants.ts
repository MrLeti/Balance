export const CATEGORIES = {
    Egreso: {
        Comunes: ["Mercadería", "Limpieza", "Cuidado personal", "Delivery", "Otros comunes"],
        Habitacionales: ["Alquiler", "Expensas", "Impuestos", "Energía", "Gas", "Internet", "Teléfono", "Suscripciones", "Otros habit."],
        Puntuales: ["Equip. Para el hogar", "Transporte", "Ropa", "Bicicleta", "Otros puntuales"],
        Ocio: ["Juegos", "Libros", "Salida", "Otros ocio"],
    },
    Ingreso: {
        Salario: ["Blanco", "Negro", "Aguinaldo B", "Aguinaldo N", "Vacaciones B", "Vacaciones N"],
        Extras: ["Intereses", "Otros ingresos", "Dividendos", "Trabajos"],
    },
};

export const CATEGORY_COLORS: Record<string, string> = {
    // Egresos
    "Comunes": "#f59e0b", // Naranja/Ambar
    "Habitacionales": "#8b5cf6", // Violeta
    "Puntuales": "#ec4899", // Rosa
    "Ocio": "#0ea5e9", // Celeste

    // Ingresos
    "Salario": "#22c55e", // Verde
    "Extras": "#14b8a6", // Turquesa
};

export type TrxType = "Egreso" | "Ingreso";
export type TrxCategory = string;
export type TrxSubCategory = string;

export interface ExtractedItem {
    Fecha: string;
    Tipo: string;
    Categoría: string;
    Subcategoría: string;
    Monto: string | number;
    Comentario: string;
}

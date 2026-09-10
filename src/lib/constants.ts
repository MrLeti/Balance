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
    Ahorro: {
        Aporte: ["Fondo de Emergencia", "General", "Viaje", "Nueva PC", "Auto", "Otros ahorros"],
        Retiro: ["Fondo de Emergencia", "General", "Viaje", "Nueva PC", "Auto", "Otros ahorros"],
    },
    Inversión: {
        "Activos Financieros": ["Acciones", "Cedears", "Bonos", "ETFs", "Cripto", "Otros activos"],
    },
};

export const CATEGORY_COLORS: Record<string, string> = {
    // Egresos
    "Comunes": "#f59e0b", // Naranja/Ambar
    "Habitacionales": "#e0726b", // Terracota cálido / Coral suave (suave y distinto de Inversiones)
    "Puntuales": "#ec4899", // Rosa
    "Ocio": "#0ea5e9", // Celeste

    // Ingresos
    "Salario": "#22c55e", // Verde
    "Extras": "#14b8a6", // Turquesa

    // Ahorro
    "Aporte": "#3b82f6", // Azul
    "Retiro": "#6366f1", // Indigo
    "Ahorro": "#3b82f6",

    // Inversiones
    "Activos Financieros": "#7c3aed", // Violeta intenso / Indigo
    "Inversión": "#7c3aed",
};

export type TrxType = "Egreso" | "Ingreso" | "Inversión" | "Ahorro";
export type TrxCategory = string;
export type TrxSubCategory = string;

export interface CategoryItem {
    id: string;
    type: "Ingreso" | "Egreso";
    name: string;
    subcategories: string[];
    /** Subcategorías marcadas como gastos fijos mensuales (suscripciones) */
    subscriptionSubcategories?: string[];
    color: string;
    createdAt?: string;
}

export const DEFAULT_INITIAL_CATEGORIES: Omit<CategoryItem, "id">[] = [
    // 2 de Ingreso
    {
        type: "Ingreso",
        name: "Salario",
        subcategories: ["Sueldo", "Aguinaldo", "Vacaciones"],
        color: "#22c55e",
    },
    {
        type: "Ingreso",
        name: "Extras",
        subcategories: ["Intereses", "Otros ingresos", "Dividendos", "Trabajos"],
        color: "#14b8a6",
    },
    // 4 de Egreso (Gastos)
    {
        type: "Egreso",
        name: "Comunes",
        subcategories: ["Mercadería", "Limpieza", "Cuidado personal", "Delivery", "Otros comunes"],
        color: "#f59e0b",
    },
    {
        type: "Egreso",
        name: "Habitacionales",
        subcategories: ["Alquiler", "Expensas", "Impuestos", "Servicios"],
        color: "#e0726b",
    },
    {
        type: "Egreso",
        name: "Puntuales",
        subcategories: ["Hogar", "Transporte", "Ropa", "Otros puntuales"],
        color: "#ec4899",
    },
    {
        type: "Egreso",
        name: "Ocio",
        subcategories: ["Salidas", "Juegos", "Libros", "Otros ocio"],
        color: "#0ea5e9",
    },
];

export interface ExtractedItem {
    Fecha: string;
    Tipo: string;
    Categoría: string;
    Subcategoría: string;
    Monto: string | number;
    Comentario: string;
}



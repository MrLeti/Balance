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

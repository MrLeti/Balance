export async function getCurrentDolarMEP() {
    try {
        const res = await fetch("https://dolarapi.com/v1/dolares/bolsa");
        if (!res.ok) throw new Error("Fallo al obtener MEP (Bolsa)");
        const data = await res.json();

        if (!data.venta) {
            throw new Error("No se encontró precio de venta en la DolarAPI.");
        }

        // Devolvemos el valor de venta
        return data.venta as number;
    } catch (error) {
        console.error("Error consultando DolarAPI:", error);
        // Fallo RUIDOSO (Fail-Safe): Rechazamos el silenciamiento corrupto
        throw new Error("El servicio de tipo de cambio falló. No se puede convertir con seguridad la moneda.");
    }
}

const historicalCache = new Map<string, number>();

export async function getCurrentDolarMEP(): Promise<number> {
    try {
        const res = await fetch("https://dolarapi.com/v1/dolares/bolsa", {
            next: { revalidate: 300 },
        });
        if (!res.ok) throw new Error("Fallo al obtener MEP (Bolsa)");
        const data = await res.json();

        if (!data.venta) {
            throw new Error("No se encontró precio de venta en la DolarAPI.");
        }

        return data.venta as number;
    } catch (error) {
        console.error("Error consultando DolarAPI MEP:", error);
        throw new Error("El servicio de tipo de cambio MEP falló.");
    }
}

export async function getCurrentDolarCCL(): Promise<number> {
    try {
        const res = await fetch("https://dolarapi.com/v1/dolares/contadoconliqui", {
            next: { revalidate: 300 },
        });
        if (!res.ok) throw new Error("Fallo al obtener CCL");
        const data = await res.json();

        if (!data.venta) {
            throw new Error("No se encontró precio de venta CCL en la DolarAPI.");
        }

        return data.venta as number;
    } catch (error) {
        console.error("Error consultando DolarAPI CCL:", error);
        throw new Error("El servicio de tipo de cambio CCL falló.");
    }
}

/**
 * Fetches historical dollar quote for a specific date (DD/MM/YYYY or YYYY-MM-DD)
 * using ArgentinaDatos API. Caches results in memory to avoid duplicate requests.
 */
export async function getHistoricalDolar(
    dateStr: string,
    type: "ccl" | "bolsa" = "ccl"
): Promise<number | null> {
    if (!dateStr) return null;

    // Normalise date to YYYY/MM/DD
    let yyyy = "";
    let mm = "";
    let dd = "";

    if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts.length === 3) {
            dd = parts[0].padStart(2, "0");
            mm = parts[1].padStart(2, "0");
            yyyy = parts[2];
        }
    } else if (dateStr.includes("-")) {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            yyyy = parts[0];
            mm = parts[1].padStart(2, "0");
            dd = parts[2].padStart(2, "0");
        }
    }

    if (!yyyy || !mm || !dd) return null;

    const cacheKey = `${type}_${yyyy}_${mm}_${dd}`;
    if (historicalCache.has(cacheKey)) {
        return historicalCache.get(cacheKey)!;
    }

    const casa = type === "ccl" ? "contadoconliqui" : "bolsa";
    const url = `https://api.argentinadatos.com/v1/cotizaciones/dolares/${casa}/${yyyy}/${mm}/${dd}`;

    try {
        const res = await fetch(url, {
            next: { revalidate: 86400 }, // Cache 24h
        });

        if (res.ok) {
            const data = await res.json();
            const rate = Number(data.venta || data.compra);
            if (rate > 0) {
                historicalCache.set(cacheKey, rate);
                return rate;
            }
        }
    } catch (err) {
        console.warn(`Could not fetch historical ${casa} for ${yyyy}/${mm}/${dd}:`, err);
    }

    return null;
}


/**
 * Obtiene la cotización del dólar MEP para una fecha dada.
 * Si la fecha cae en fin de semana o feriado, retrocede automáticamente hasta 5 días hábiles.
 */
export async function getHistoricalDolarMEPWithFallback(dateStr: string): Promise<number | null> {
    if (!dateStr) return null;

    let day = 0;
    let month = 0;
    let year = 0;

    if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts.length === 3) {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
        }
    } else if (dateStr.includes("-")) {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
        }
    }

    if (!year || isNaN(month) || !day) return null;

    const baseDate = new Date(year, month, day);
    if (isNaN(baseDate.getTime())) return null;

    // Probar fecha dada y hasta 5 días anteriores
    for (let offset = 0; offset <= 5; offset++) {
        const target = new Date(baseDate);
        target.setDate(target.getDate() - offset);

        const dd = String(target.getDate()).padStart(2, "0");
        const mm = String(target.getMonth() + 1).padStart(2, "0");
        const yyyy = String(target.getFullYear());
        const formatted = `${dd}/${mm}/${yyyy}`;

        const rate = await getHistoricalDolar(formatted, "bolsa");
        if (rate && rate > 0) {
            return rate;
        }
    }

    return null;
}


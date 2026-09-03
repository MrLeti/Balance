/**
 * Utilidad para respuestas de error seguras y claras en API routes.
 *
 * Detecta errores de red o caídas de base de datos para devolver mensajes
 * comprensibles para el usuario, sin filtrar nombres de tablas, credenciales
 * ni esquemas internos en producción.
 */
export function safeErrorResponse(
    error: unknown,
    fallback = "Error interno del servidor."
): { error: string } {
    const rawMsg = error instanceof Error ? error.message : String(error || "");

    // Detección de fallas de conexión / red / Supabase
    const isNetworkOrDbDown =
        /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network|timeout|Failed to fetch|PGRST301|PGRST000/i.test(rawMsg);

    if (isNetworkOrDbDown) {
        return {
            error: "No se pudo conectar con la base de datos. Por favor verificá tu conexión a internet o intentá nuevamente en unos momentos."
        };
    }

    if (process.env.NODE_ENV === "development" && error instanceof Error) {
        return { error: error.message };
    }

    return { error: fallback };
}


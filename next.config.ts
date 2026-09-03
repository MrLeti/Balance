import type { NextConfig } from "next";

// VULN-09: Security headers HTTP
const securityHeaders = [
    // Previene que la app sea embebida en iframes de otros dominios (clickjacking)
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    // Previene MIME-type sniffing
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Controla la información que se envía en el Referer header
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Fuerza HTTPS por 2 años (activar solo en producción con dominio propio)
    {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
    },
    // Limita acceso a hardware sensible
    {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
    },
    // Content Security Policy
    {
        key: "Content-Security-Policy",
        value: [
            "default-src 'self'",
            // Next.js requiere unsafe-inline para estilos y unsafe-eval en dev
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            // Permite imágenes de Google (fotos de perfil OAuth)
            "img-src 'self' data: blob: https://lh3.googleusercontent.com",
            // Conexiones permitidas: propio origen, Supabase y Gemini API
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.argentinadatos.com https://query1.finance.yahoo.com",
            "font-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join("; "),
    },
];

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
                port: "",
                pathname: "/**",
            },
        ],
    },
    async headers() {
        return [
            {
                // Aplica a todas las rutas
                source: "/(.*)",
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;

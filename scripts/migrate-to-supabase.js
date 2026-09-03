// ─────────────────────────────────────────────────────────
// Script de Migración de Google Sheets ➔ Supabase (CLI)
// ─────────────────────────────────────────────────────────
// Uso: node scripts/migrate-to-supabase.js

const fs = require('fs');
const path = require('path');

// Cargar variables de .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const val = match[2].trim().replace(/^["']|["']$/g, '');
            process.env[key] = val;
        }
    });
}

console.log("====================================================");
console.log("🚀 VESTA — Migración de Google Sheets a Supabase");
console.log("====================================================");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
    console.log("👉 Tip: Agrega tus credenciales de Supabase en .env.local antes de correr este script.");
    process.exit(1);
}

console.log("📡 Conexión a Supabase configurada.");
console.log("💡 Para ejecutar la migración con tu sesión activa de Google, simplemente inicia la app (npm run dev)");
console.log("   e ingresa a: http://localhost:3000/api/admin/migrate-from-sheets con método POST, o");
console.log("   visita la página de configuración / migración.");
console.log("====================================================");

// ═══════════════════════════════════════════════════════════════
// SISDEL Cloud Connection (Supabase) for Reuniones Module
// ═══════════════════════════════════════════════════════════════

// Misma llave as the one in SISDEL WorkCenter (Public Supabase instance of Sisdel)
const SUPABASE_URL = 'https://rxrodfskmvldozpznyrp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cm9kZnNrbXZsZG96cHpueXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODY4MTQsImV4cCI6MjA4NzQ2MjgxNH0.A9GVR_rOnoH2pjz0ByZEMvtWfGe7FOI9C6j1_D-fTos';

// Inicializar cliente global
if (typeof window !== 'undefined' && typeof window.supabase !== 'undefined') {
    window.supabaseDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase Client Initialized");
} else {
    console.error("❌ Error: Supabase CDN not loaded. Please include the script tag in HTML.");
}

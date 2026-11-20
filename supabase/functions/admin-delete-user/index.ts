import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import { canDeleteUser } from "../_shared/delete-user-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Método no permitido" });
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply(401, { error: "Debes iniciar sesión" });
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply(500, { error: "Servicio no disponible" });
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user: actor }, error: authError } = await admin.auth.getUser(token);
    if (authError || !actor) return reply(401, { error: "Tu sesión expiró. Inicia sesión nuevamente." });
    const body = await req.json().catch(() => null);
    const userId = body?.userId;
    if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return reply(400, { error: "Usuario no válido" });
    }
    const [profile, roles] = await Promise.all([
      admin.from("profiles").select("role").eq("id", actor.id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", actor.id),
    ]);
    if (profile.error || roles.error || !canDeleteUser(profile.data?.role, roles.data?.map(row => row.role) ?? [], actor.id, userId)) {
      return reply(403, { error: actor.id === userId ? "No puedes eliminar tu propia cuenta" : "Solo los administradores pueden eliminar usuarios" });
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Account deletion failed", error.code);
      return reply(409, { error: "No se pudo eliminar la cuenta; sus datos se conservaron. Puede tener archivos asociados que requieren revisión." });
    }
    return reply(200, { success: true });
  } catch {
    return reply(500, { error: "No se pudo eliminar el usuario. Intenta nuevamente." });
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentNumber } = await req.json();

    if (!documentNumber || typeof documentNumber !== "string") {
      return new Response(JSON.stringify({ authorized: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("authorized_employees")
      .select("full_name")
      .eq("document_number", documentNumber.trim())
      .maybeSingle();

    if (error) throw error;

    // Only return whether the document is authorized (no PII listing)
    return new Response(
      JSON.stringify({ authorized: !!data, full_name: data?.full_name ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (_e) {
    return new Response(JSON.stringify({ authorized: false, error: "verification_failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
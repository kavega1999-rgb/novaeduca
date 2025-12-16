import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  training_id: string;
  reminder_type: "new_training" | "deadline_approaching";
}

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Capacitaciones <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the user is authenticated and has admin/leader role
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin or leader
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "leader"])
      .single();

    if (!userRole) {
      throw new Error("Insufficient permissions");
    }

    const { training_id, reminder_type }: ReminderRequest = await req.json();

    if (!training_id || !reminder_type) {
      throw new Error("Missing required fields: training_id and reminder_type");
    }

    // Use service role client for data access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get training details
    const { data: training, error: trainingError } = await supabaseAdmin
      .from("trainings")
      .select(`
        id,
        title,
        description,
        active_from,
        active_until,
        visible_to_all,
        area_id,
        areas (name)
      `)
      .eq("id", training_id)
      .single();

    if (trainingError || !training) {
      console.error("Training fetch error:", trainingError);
      throw new Error("Training not found");
    }

    // Get target areas for this training
    const { data: targetAreas } = await supabaseAdmin
      .from("training_target_areas")
      .select("target_area")
      .eq("training_id", training_id);

    // Get users who should receive the reminder
    let usersQuery = supabaseAdmin
      .from("profiles")
      .select(`
        id,
        full_name,
        area
      `)
      .eq("status", "active");

    // Filter by target areas if training is not visible to all
    if (!training.visible_to_all && targetAreas && targetAreas.length > 0) {
      const areas = targetAreas.map(ta => ta.target_area);
      usersQuery = usersQuery.in("area", areas);
    }

    const { data: allUsers, error: usersError } = await usersQuery;

    if (usersError) {
      console.error("Users fetch error:", usersError);
      throw new Error("Failed to fetch users");
    }

    // Get users who have already completed the training
    const { data: completedProgress } = await supabaseAdmin
      .from("user_progress")
      .select("user_id")
      .eq("training_id", training_id)
      .eq("status", "completed");

    const completedUserIds = new Set(completedProgress?.map(p => p.user_id) || []);

    // Filter out users who have completed the training
    const pendingUsers = allUsers?.filter(u => !completedUserIds.has(u.id)) || [];

    if (pendingUsers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No hay usuarios pendientes para esta capacitación",
          sent_count: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get emails for pending users
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authUsersError) {
      console.error("Auth users fetch error:", authUsersError);
      throw new Error("Failed to fetch user emails");
    }

    const userEmailMap = new Map(
      authUsers.users.map(u => [u.id, u.email])
    );

    // Prepare email content based on reminder type
    const deadlineDate = training.active_until 
      ? new Date(training.active_until).toLocaleDateString('es-CO', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : null;

    const subject = reminder_type === "new_training"
      ? `Nueva capacitación disponible: ${training.title}`
      : `Recordatorio: La capacitación "${training.title}" está por vencer`;

    const emailResults = [];
    let successCount = 0;
    let errorCount = 0;

    for (const pendingUser of pendingUsers) {
      const email = userEmailMap.get(pendingUser.id);
      if (!email) continue;

      const htmlContent = reminder_type === "new_training"
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1e3a5f;">Nueva Capacitación Disponible</h1>
            <p>Hola ${pendingUser.full_name},</p>
            <p>Te informamos que hay una nueva capacitación disponible para ti:</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #1e3a5f; margin-top: 0;">${training.title}</h2>
              ${training.description ? `<p style="color: #666;">${training.description}</p>` : ''}
              ${deadlineDate ? `<p style="color: #e65100;"><strong>Fecha límite:</strong> ${deadlineDate}</p>` : ''}
            </div>
            <p>Por favor ingresa a la plataforma para completar esta capacitación.</p>
            <p>Saludos,<br>Equipo de Capacitación</p>
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #e65100;">⚠️ Recordatorio Importante</h1>
            <p>Hola ${pendingUser.full_name},</p>
            <p>Te recordamos que la siguiente capacitación está próxima a vencer y aún no la has completado:</p>
            <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e65100;">
              <h2 style="color: #1e3a5f; margin-top: 0;">${training.title}</h2>
              ${training.description ? `<p style="color: #666;">${training.description}</p>` : ''}
              ${deadlineDate ? `<p style="color: #e65100;"><strong>Fecha límite:</strong> ${deadlineDate}</p>` : ''}
            </div>
            <p style="color: #e65100;"><strong>Por favor completa esta capacitación antes de la fecha límite.</strong></p>
            <p>Saludos,<br>Equipo de Capacitación</p>
          </div>
        `;

      try {
        const emailResponse = await sendEmail(email, subject, htmlContent);
        console.log(`Email sent to ${email}:`, emailResponse);
        emailResults.push({ email, status: "sent", response: emailResponse });
        successCount++;
      } catch (emailError: any) {
        console.error(`Failed to send email to ${email}:`, emailError);
        emailResults.push({ email, status: "error", error: emailError.message });
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recordatorios enviados: ${successCount} exitosos, ${errorCount} fallidos`,
        sent_count: successCount,
        error_count: errorCount,
        details: emailResults,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-training-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" || error.message === "Insufficient permissions" ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getScoreCategory = (score: number): string => {
  if (score >= 90) return 'Excelente';
  if (score >= 80) return 'Bueno';
  if (score >= 70) return 'Aceptable';
  return 'Inaceptable';
};

const generateConclusion = (
  pretestScore: number,
  postestScore: number,
  trainingTitle: string
): string => {
  const improvement = postestScore - pretestScore;
  const pretestCategory = getScoreCategory(pretestScore);
  const postestCategory = getScoreCategory(postestScore);

  if (improvement > 20) {
    return `El participante demostró una mejora sobresaliente de ${improvement.toFixed(1)} puntos porcentuales en la capacitación "${trainingTitle}". Pasó de un nivel ${pretestCategory} (${pretestScore.toFixed(1)}%) a ${postestCategory} (${postestScore.toFixed(1)}%), evidenciando una excelente asimilación del contenido y compromiso con el aprendizaje.`;
  } else if (improvement > 10) {
    return `El participante mostró una mejora significativa de ${improvement.toFixed(1)} puntos porcentuales. El nivel inicial ${pretestCategory} (${pretestScore.toFixed(1)}%) evolucionó a ${postestCategory} (${postestScore.toFixed(1)}%) tras la capacitación "${trainingTitle}", lo que indica una buena comprensión del material.`;
  } else if (improvement > 0) {
    return `Se observa una mejora moderada de ${improvement.toFixed(1)} puntos porcentuales en la capacitación "${trainingTitle}". El participante pasó de ${pretestScore.toFixed(1)}% (${pretestCategory}) a ${postestScore.toFixed(1)}% (${postestCategory}). Se recomienda reforzar algunos conceptos.`;
  } else if (improvement === 0) {
    return `El participante mantuvo el mismo nivel de conocimiento antes y después de la capacitación "${trainingTitle}" (${postestScore.toFixed(1)}% - ${postestCategory}). Se sugiere revisar la metodología de enseñanza o realizar un seguimiento personalizado.`;
  } else {
    return `Se detectó una disminución de ${Math.abs(improvement).toFixed(1)} puntos porcentuales entre el pretest (${pretestScore.toFixed(1)}%) y el postest (${postestScore.toFixed(1)}%) en "${trainingTitle}". Esto puede indicar fatiga, falta de concentración o necesidad de refuerzo en los conceptos clave.`;
  }
};

const generateStrategies = (
  pretestScore: number,
  postestScore: number,
  postestCategory: string
): string => {
  const improvement = postestScore - pretestScore;
  const strategies: string[] = [];

  if (postestCategory === 'Excelente') {
    strategies.push("• Mantener el excelente nivel alcanzado mediante capacitaciones de actualización periódicas.");
    strategies.push("• Considerar al participante como mentor para apoyar a compañeros con dificultades.");
    strategies.push("• Proporcionar material avanzado para continuar su desarrollo profesional.");
  } else if (postestCategory === 'Bueno') {
    strategies.push("• Reforzar los temas donde se presentaron errores mediante ejercicios prácticos.");
    strategies.push("• Programar una sesión de repaso corta en las próximas 2 semanas.");
    strategies.push("• Proporcionar material complementario de lectura.");
  } else if (postestCategory === 'Aceptable') {
    strategies.push("• Realizar una tutoría personalizada enfocada en los conceptos principales.");
    strategies.push("• Implementar evaluaciones de seguimiento semanales.");
    strategies.push("• Considerar métodos de aprendizaje alternativos (videos, talleres prácticos).");
    strategies.push("• Verificar comprensión mediante casos prácticos y simulaciones.");
  } else {
    strategies.push("• Programar una recapacitación completa con metodología diferente.");
    strategies.push("• Asignar un tutor o compañero de apoyo para acompañamiento.");
    strategies.push("• Identificar posibles barreras de aprendizaje (tiempo, recursos, motivación).");
    strategies.push("• Dividir el contenido en módulos más pequeños y manejables.");
    strategies.push("• Realizar seguimiento semanal del progreso.");
  }

  if (improvement < 0) {
    strategies.push("• Investigar factores externos que pudieron afectar el desempeño (estrés, carga laboral).");
    strategies.push("• Revisar si el formato de la evaluación es adecuado para el participante.");
  }

  return strategies.join("\n");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error("Invalid token or user not found:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = user.id;
    console.log("Authenticated user:", authenticatedUserId);

    const { postestAttemptId, trainingId } = await req.json();
    
    console.log("Generating adherence report for:", { postestAttemptId, trainingId });

    if (!postestAttemptId || !trainingId) {
      return new Response(
        JSON.stringify({ error: "postestAttemptId and trainingId are required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get postest attempt
    const { data: postestAttempt, error: postestError } = await supabase
      .from('evaluation_attempts')
      .select('*, evaluations(training_id)')
      .eq('id', postestAttemptId)
      .single();

    if (postestError || !postestAttempt) {
      console.error("Error fetching postest:", postestError);
      return new Response(
        JSON.stringify({ error: "Postest attempt not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the authenticated user owns this attempt
    if (postestAttempt.user_id !== authenticatedUserId) {
      console.error("User does not own this attempt:", { attemptUserId: postestAttempt.user_id, authenticatedUserId });
      return new Response(
        JSON.stringify({ error: "You can only generate reports for your own attempts" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = postestAttempt.user_id;
    const evaluationId = postestAttempt.evaluation_id;

    // Get pretest attempt for same user and training
    const { data: pretestAttempt } = await supabase
      .from('pretest_attempts')
      .select('*')
      .eq('training_id', trainingId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get training info
    const { data: training } = await supabase
      .from('trainings')
      .select('title')
      .eq('id', trainingId)
      .single();

    const trainingTitle = training?.title || 'Capacitación';
    const pretestScore = pretestAttempt?.score || 0;
    const postestScore = postestAttempt.score || 0;
    const pretestCategory = getScoreCategory(pretestScore);
    const postestCategory = getScoreCategory(postestScore);
    const improvementPercentage = postestScore - pretestScore;
    const conclusion = generateConclusion(pretestScore, postestScore, trainingTitle);
    const strategies = generateStrategies(pretestScore, postestScore, postestCategory);

    // Check if report already exists
    const { data: existingReport } = await supabase
      .from('adherence_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('training_id', trainingId)
      .eq('postest_attempt_id', postestAttemptId)
      .maybeSingle();

    let report;
    if (existingReport) {
      // Update existing report
      const { data, error } = await supabase
        .from('adherence_reports')
        .update({
          pretest_attempt_id: pretestAttempt?.id || null,
          pretest_score: pretestScore,
          postest_score: postestScore,
          pretest_category: pretestCategory,
          postest_category: postestCategory,
          improvement_percentage: improvementPercentage,
          conclusion,
          strategies,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingReport.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating report:", error);
        throw error;
      }
      report = data;
    } else {
      // Create new report
      const { data, error } = await supabase
        .from('adherence_reports')
        .insert({
          user_id: userId,
          training_id: trainingId,
          pretest_attempt_id: pretestAttempt?.id || null,
          postest_attempt_id: postestAttemptId,
          pretest_score: pretestScore,
          postest_score: postestScore,
          pretest_category: pretestCategory,
          postest_category: postestCategory,
          improvement_percentage: improvementPercentage,
          conclusion,
          strategies,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating report:", error);
        throw error;
      }
      report = data;
    }

    console.log("Adherence report generated successfully:", report.id);

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating adherence report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

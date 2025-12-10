import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attemptId, questionId, textResponse, trainingId } = await req.json();

    if (!attemptId || !questionId || !textResponse || !trainingId) {
      return new Response(JSON.stringify({ error: "Faltan parámetros requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the training content URL
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("content_url, title")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training?.content_url) {
      console.error("Training not found:", trainingError);
      return new Response(JSON.stringify({ error: "No se encontró el material de capacitación" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the question details
    const { data: question, error: questionError } = await supabase
      .from("evaluation_questions")
      .select("question_text, points")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      console.error("Question not found:", questionError);
      return new Response(JSON.stringify({ error: "No se encontró la pregunta" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Evaluating open response for question: ${question.question_text.substring(0, 50)}...`);

    // Prepare the prompt for AI evaluation
    const systemPrompt = `Eres un evaluador FLEXIBLE y COMPRENSIVO de capacitaciones. Tu tarea es evaluar si la respuesta de un usuario demuestra comprensión del tema, NO si es una copia exacta del material.

FILOSOFÍA DE EVALUACIÓN:
- El objetivo es verificar que el usuario ENTENDIÓ el concepto, no que lo memorizó palabra por palabra
- Acepta sinónimos, parafraseo y explicaciones con palabras propias
- Valora el esfuerzo y la intención de la respuesta
- Sé GENEROSO en la puntuación si el usuario demuestra comprensión general

CRITERIOS DE PUNTUACIÓN (SÉ FLEXIBLE):
- 90-100%: La respuesta muestra clara comprensión del tema, aunque use palabras diferentes
- 70-89%: La respuesta captura la idea principal, puede faltar algún detalle menor
- 50-69%: La respuesta tiene la idea correcta pero le falta desarrollo o tiene imprecisiones menores
- 30-49%: La respuesta toca el tema pero es muy superficial o tiene errores conceptuales
- 0-29%: La respuesta es completamente incorrecta o no tiene relación con el tema

IMPORTANTE:
- NO penalices por redacción diferente, ortografía menor o estilo de escritura
- Si el usuario menciona los conceptos clave con sus propias palabras, es CORRECTO
- Responde ÚNICAMENTE con un JSON válido sin bloques de código markdown
- El campo "score_percentage" debe ser un número entre 0 y 100
- El campo "feedback" debe ser breve y constructivo en español (máximo 80 palabras)

Formato de respuesta (JSON puro, sin \`\`\`):
{
  "score_percentage": 85,
  "is_correct": true,
  "feedback": "Buena respuesta. Demostraste comprensión del concepto principal."
}`;

    const userPrompt = `MATERIAL DE CAPACITACIÓN: "${training.title}"
(El contenido del material está disponible en: ${training.content_url})

PREGUNTA: ${question.question_text}

RESPUESTA DEL USUARIO: ${textResponse}

PUNTOS POSIBLES: ${question.points}

Evalúa si la respuesta del usuario es correcta basándote en el contexto de la capacitación "${training.title}". Considera que el usuario ha estudiado el material y debe demostrar comprensión del tema.`;

    console.log('Calling AI gateway to evaluate response...');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Por favor intenta más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Se requiere agregar créditos al workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse AI response
    let evaluation;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      evaluation = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI evaluation:", content);
      // Default to partial credit if parsing fails
      evaluation = {
        score_percentage: 50,
        is_correct: false,
        feedback: "No se pudo evaluar automáticamente. Un instructor revisará tu respuesta."
      };
    }

    // Calculate points earned (must be integer for database)
    const scorePercentage = Math.max(0, Math.min(100, evaluation.score_percentage || 0));
    const pointsEarned = Math.round((scorePercentage / 100) * question.points);
    const isCorrect = scorePercentage >= 60; // Consider 60% or above as "correct"

    console.log(`Evaluation result: ${scorePercentage}% - ${pointsEarned} points earned (of ${question.points})`);

    // Save the answer with evaluation
    const { error: answerError } = await supabase
      .from("evaluation_answers")
      .insert({
        attempt_id: attemptId,
        question_id: questionId,
        text_response: textResponse,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        ai_feedback: evaluation.feedback,
      });

    if (answerError) {
      console.error("Error saving answer:", answerError);
      throw new Error("Error al guardar la respuesta");
    }

    return new Response(JSON.stringify({
      success: true,
      score_percentage: scorePercentage,
      points_earned: pointsEarned,
      is_correct: isCorrect,
      feedback: evaluation.feedback,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in evaluate-open-response:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error al evaluar la respuesta" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

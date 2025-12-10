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
    const systemPrompt = `Eres un evaluador experto de capacitaciones. Tu tarea es evaluar si la respuesta de un usuario a una pregunta abierta es correcta basándote en el material de capacitación proporcionado.

INSTRUCCIONES DE EVALUACIÓN:
1. Compara la respuesta del usuario con el contenido del material de capacitación
2. Evalúa si la respuesta demuestra comprensión del tema
3. Sé flexible con la redacción - lo importante es que el concepto esté correcto
4. Considera respuestas parcialmente correctas

CRITERIOS DE PUNTUACIÓN:
- Si la respuesta es completamente correcta y completa: 100% de los puntos
- Si la respuesta es correcta pero incompleta: 70-90% de los puntos
- Si la respuesta es parcialmente correcta: 40-60% de los puntos
- Si la respuesta es incorrecta o irrelevante: 0-30% de los puntos

IMPORTANTE:
- Responde ÚNICAMENTE con un JSON válido
- El campo "score_percentage" debe ser un número entre 0 y 100
- El campo "feedback" debe ser una breve explicación en español (máximo 100 palabras)

Formato de respuesta:
{
  "score_percentage": 85,
  "is_correct": true,
  "feedback": "La respuesta demuestra una buena comprensión del concepto. Se mencionaron los puntos clave correctamente."
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

    // Calculate points earned
    const scorePercentage = Math.max(0, Math.min(100, evaluation.score_percentage || 0));
    const pointsEarned = Math.round((scorePercentage / 100) * question.points * 100) / 100;
    const isCorrect = scorePercentage >= 60; // Consider 60% or above as "correct"

    console.log(`Evaluation result: ${scorePercentage}% - ${pointsEarned} points earned`);

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

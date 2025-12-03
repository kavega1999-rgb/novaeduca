import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl, trainingTitle } = await req.json();
    
    console.log('Generating evaluation questions for:', trainingTitle);
    console.log('PDF URL:', pdfUrl);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch the PDF content
    let pdfText = "";
    try {
      const pdfResponse = await fetch(pdfUrl);
      if (pdfResponse.ok) {
        // For PDFs, we'll send the URL to the AI model which can process it
        pdfText = `PDF available at: ${pdfUrl}`;
      }
    } catch (e) {
      console.log("Could not fetch PDF directly, using URL reference");
      pdfText = `PDF available at: ${pdfUrl}`;
    }

    const systemPrompt = `Eres un experto en capacitaciones corporativas del sector salud. Tu tarea es generar preguntas de evaluación basadas en el contenido de capacitaciones.

Genera exactamente 5 preguntas de selección múltiple (una sola respuesta correcta) sobre el tema de la capacitación.

IMPORTANTE:
- Cada pregunta debe tener exactamente 4 opciones de respuesta
- Solo una opción debe ser correcta
- Las preguntas deben evaluar comprensión del tema, no solo memorización
- Las opciones incorrectas deben ser plausibles pero claramente incorrectas
- Usa lenguaje claro y profesional en español

Responde ÚNICAMENTE con un JSON válido con la siguiente estructura (sin markdown, sin explicaciones):
{
  "questions": [
    {
      "question_text": "¿Texto de la pregunta?",
      "options": [
        { "option_text": "Opción A", "is_correct": false },
        { "option_text": "Opción B", "is_correct": true },
        { "option_text": "Opción C", "is_correct": false },
        { "option_text": "Opción D", "is_correct": false }
      ]
    }
  ]
}`;

    const userPrompt = `Genera 5 preguntas de evaluación para la siguiente capacitación:

Título: ${trainingTitle}
Contenido: ${pdfText}

Genera preguntas relevantes sobre el tema "${trainingTitle}" que evalúen el conocimiento práctico y teórico del personal de salud.`;

    console.log('Calling AI gateway...');

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
    console.log('AI response received');
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response from AI
    let questions;
    try {
      // Remove markdown code blocks if present
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
      
      questions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response as JSON");
    }

    console.log('Questions generated successfully:', questions.questions?.length);

    return new Response(JSON.stringify(questions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-evaluation-questions:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error generando preguntas" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
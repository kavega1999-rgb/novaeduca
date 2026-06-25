import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question_text, correct_answer, training_title } = await req.json();

    if (!question_text || !correct_answer) {
      return new Response(JSON.stringify({ error: "Faltan datos: pregunta y respuesta correcta son requeridas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no está configurada");
    }

    const systemPrompt = `Eres un experto en diseño de evaluaciones para capacitaciones corporativas del sector salud.
Tu tarea es generar exactamente 3 distractores (respuestas incorrectas) plausibles pero claramente erróneas para una pregunta de selección múltiple, dada la pregunta y su respuesta correcta.

Reglas:
- Genera exactamente 3 opciones incorrectas.
- Deben ser plausibles, en el mismo dominio temático y con longitud y estilo similares a la respuesta correcta.
- NO deben ser equivalentes, sinónimas ni parafraseos de la respuesta correcta.
- NO incluyas la respuesta correcta entre los distractores.
- Usa español claro y profesional.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones) con esta estructura:
{
  "distractors": ["opción incorrecta 1", "opción incorrecta 2", "opción incorrecta 3"]
}`;

    const userPrompt = `Capacitación: ${training_title || "(sin título)"}
Pregunta: ${question_text}
Respuesta correcta: ${correct_answer}

Genera 3 distractores incorrectos.`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Se requiere agregar créditos al workspace de Lovable AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `Error de IA: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Respuesta vacía de la IA");

    let parsed;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error("No se pudo parsear la respuesta IA:", content);
      throw new Error("Respuesta de IA no es JSON válido");
    }

    const distractors = Array.isArray(parsed.distractors) ? parsed.distractors.slice(0, 3) : [];
    if (distractors.length < 3) {
      throw new Error("La IA no devolvió 3 distractores");
    }

    return new Response(JSON.stringify({ distractors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error en generate-distractors:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Error generando distractores",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
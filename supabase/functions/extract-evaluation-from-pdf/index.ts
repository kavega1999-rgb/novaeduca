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
    const formData = await req.formData();
    const pdfFile = formData.get('file') as File;
    
    if (!pdfFile) {
      return new Response(JSON.stringify({ error: "No se proporcionó archivo PDF" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('Extracting evaluation from PDF:', pdfFile.name, 'Size:', pdfFile.size);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Convert PDF to base64 for the AI model - using chunked approach to avoid stack overflow
    const arrayBuffer = await pdfFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Process in chunks to avoid stack overflow with large files
    const chunkSize = 32768; // 32KB chunks
    let base64 = '';
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      base64 += String.fromCharCode(...chunk);
    }
    base64 = btoa(base64);
    const dataUrl = `data:application/pdf;base64,${base64}`;

    const systemPrompt = `Eres un experto en extraer información de documentos de evaluación/exámenes. Tu tarea es analizar un PDF que contiene un examen o formulario de evaluación y extraer todas las preguntas con sus opciones de respuesta.

INSTRUCCIONES:
1. Identifica todas las preguntas del documento
2. Para cada pregunta, identifica todas las opciones de respuesta disponibles
3. Si el documento indica cuál es la respuesta correcta (puede estar marcada, resaltada, o indicada de alguna forma), marca esa opción como correcta
4. Si NO hay indicación de la respuesta correcta, marca la primera opción como correcta por defecto (el usuario podrá editarla después)
5. Mantén el texto exacto de las preguntas y opciones como aparecen en el documento

IMPORTANTE:
- Extrae TODAS las preguntas del documento, no importa cuántas sean
- Cada pregunta debe tener al menos 2 opciones de respuesta
- Solo UNA opción por pregunta puede ser marcada como correcta
- Usa el texto exacto del documento, no modifiques el contenido

Responde ÚNICAMENTE con un JSON válido con la siguiente estructura (sin markdown, sin explicaciones):
{
  "questions": [
    {
      "question_text": "¿Texto de la pregunta exacto del documento?",
      "options": [
        { "option_text": "Opción A del documento", "is_correct": false },
        { "option_text": "Opción B del documento", "is_correct": true },
        { "option_text": "Opción C del documento", "is_correct": false },
        { "option_text": "Opción D del documento", "is_correct": false }
      ]
    }
  ],
  "metadata": {
    "total_questions": 5,
    "title": "Título del examen si está disponible"
  }
}`;

    const userPrompt = `Analiza el siguiente documento PDF que contiene un examen o formulario de evaluación. Extrae todas las preguntas con sus opciones de respuesta exactamente como aparecen en el documento.`;

    console.log('Calling AI gateway to extract questions from PDF...');

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
          { 
            role: "user", 
            content: [
              { type: "text", text: userPrompt },
              { 
                type: "image_url", 
                image_url: { url: dataUrl }
              }
            ]
          }
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
    let result;
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
      
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("No se pudo interpretar el contenido del PDF. Asegúrate de que sea un examen válido.");
    }

    if (!result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
      throw new Error("No se encontraron preguntas en el documento");
    }

    console.log('Questions extracted successfully:', result.questions.length);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-evaluation-from-pdf:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error extrayendo preguntas del PDF" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

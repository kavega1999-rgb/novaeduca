import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Verify JWT and check role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has admin or leader role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "leader"]);

    if (roleError || !roleData || roleData.length === 0) {
      console.log("User does not have admin/leader role:", user.id);
      return new Response(JSON.stringify({ error: "Acceso denegado. Se requiere rol de administrador o líder." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const pdfFile = formData.get('file') as File;
    
    if (!pdfFile) {
      return new Response(JSON.stringify({ error: "No se proporcionó archivo PDF" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('Extracting evaluation from PDF:', pdfFile.name, 'Size:', pdfFile.size);
    console.log('Requested by user:', user.id, 'with role:', roleData[0].role);

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
2. Clasifica cada pregunta según su tipo:
   - "multiple_choice": Preguntas de selección múltiple con varias opciones donde solo una es correcta
   - "true_false": Preguntas de verdadero/falso o sí/no (solo dos opciones posibles)
   - "open_ended": Preguntas abiertas que requieren respuesta escrita (sin opciones predefinidas)
3. Para preguntas de selección múltiple y verdadero/falso:
   - Identifica todas las opciones de respuesta disponibles
   - Si el documento indica cuál es la respuesta correcta (puede estar marcada, resaltada, o indicada de alguna forma), marca esa opción como correcta
   - Si NO hay indicación de la respuesta correcta, marca la primera opción como correcta por defecto
4. Para preguntas abiertas:
   - NO generes opciones, deja el array de opciones vacío
   - Indica que el tipo es "open_ended"
5. Mantén el texto exacto de las preguntas y opciones como aparecen en el documento

IMPORTANTE:
- Extrae TODAS las preguntas del documento, no importa cuántas sean
- Para preguntas de selección múltiple: debe tener al menos 2 opciones
- Para preguntas verdadero/falso: exactamente 2 opciones (Verdadero/Falso, Sí/No, Correcto/Incorrecto)
- Para preguntas abiertas: el array de opciones debe estar vacío
- Solo UNA opción por pregunta puede ser marcada como correcta (excepto en preguntas abiertas)
- Usa el texto exacto del documento, no modifiques el contenido

Responde ÚNICAMENTE con un JSON válido con la siguiente estructura (sin markdown, sin explicaciones):
{
  "questions": [
    {
      "question_text": "¿Texto de la pregunta de selección múltiple?",
      "question_type": "multiple_choice",
      "options": [
        { "option_text": "Opción A del documento", "is_correct": false },
        { "option_text": "Opción B del documento", "is_correct": true },
        { "option_text": "Opción C del documento", "is_correct": false },
        { "option_text": "Opción D del documento", "is_correct": false }
      ]
    },
    {
      "question_text": "¿Esta afirmación es correcta?",
      "question_type": "true_false",
      "options": [
        { "option_text": "Verdadero", "is_correct": true },
        { "option_text": "Falso", "is_correct": false }
      ]
    },
    {
      "question_text": "Explique con sus propias palabras el concepto de...",
      "question_type": "open_ended",
      "options": []
    }
  ],
  "metadata": {
    "total_questions": 10,
    "title": "Título del examen si está disponible",
    "question_types_count": {
      "multiple_choice": 5,
      "true_false": 3,
      "open_ended": 2
    }
  }
}`;

    const userPrompt = `Analiza el siguiente documento PDF que contiene un examen o formulario de evaluación. Extrae todas las preguntas clasificándolas correctamente como selección múltiple, verdadero/falso o preguntas abiertas, exactamente como aparecen en el documento.`;

    console.log('Calling AI gateway to extract questions from PDF...');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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
        max_tokens: 8192,
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

    // Validate and normalize question types
    result.questions = result.questions.map((q: any) => {
      // Normalize question type
      let questionType = q.question_type || 'multiple_choice';
      if (!['multiple_choice', 'true_false', 'open_ended'].includes(questionType)) {
        questionType = 'multiple_choice';
      }

      // For open_ended questions, ensure options is empty array
      if (questionType === 'open_ended') {
        return {
          ...q,
          question_type: questionType,
          options: []
        };
      }

      // For true_false, ensure exactly 2 options
      if (questionType === 'true_false' && (!q.options || q.options.length !== 2)) {
        return {
          ...q,
          question_type: questionType,
          options: [
            { option_text: "Verdadero", is_correct: true },
            { option_text: "Falso", is_correct: false }
          ]
        };
      }

      return {
        ...q,
        question_type: questionType
      };
    });

    console.log('Questions extracted successfully:', result.questions.length);
    console.log('Question types:', result.metadata?.question_types_count || 'not specified');

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

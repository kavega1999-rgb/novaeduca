import { supabase } from "@/integrations/supabase/client";

type QType =
  | "short_text" | "long_text" | "number" | "date" | "email" | "phone"
  | "dropdown" | "single_choice" | "multi_choice" | "boolean";

interface QDef {
  title: string;
  type: QType;
  required?: boolean;
  options?: string[];
}

interface SecDef {
  title: string;
  description?: string;
  questions: QDef[];
}

const SECTIONS: SecDef[] = [
  {
    title: "1. Datos personales",
    questions: [
      { title: "Nombres y apellidos completos", type: "short_text", required: true },
      { title: "Tipo de documento", type: "single_choice", required: true, options: ["CC", "CE", "TI", "PA", "Otro"] },
      { title: "Número de documento", type: "short_text", required: true },
      { title: "Fecha de nacimiento", type: "date", required: true },
      { title: "Género", type: "single_choice", required: true, options: ["Masculino", "Femenino", "Otro", "Prefiero no responder"] },
      { title: "Estado civil", type: "single_choice", required: true, options: ["Soltero(a)", "Casado(a)", "Unión libre", "Separado(a)", "Divorciado(a)", "Viudo(a)"] },
      { title: "Nivel educativo", type: "single_choice", required: true, options: ["Primaria", "Bachillerato", "Técnico", "Tecnólogo", "Profesional", "Especialización", "Maestría", "Doctorado"] },
      { title: "Correo personal", type: "email" },
      { title: "Teléfono de contacto", type: "phone", required: true },
    ],
  },
  {
    title: "2. Información laboral",
    questions: [
      { title: "Cargo actual", type: "short_text", required: true },
      { title: "Área o proceso", type: "short_text", required: true },
      { title: "Fecha de ingreso", type: "date", required: true },
      { title: "Tipo de contrato", type: "single_choice", required: true, options: ["Término indefinido", "Término fijo", "Prestación de servicios", "Obra o labor", "Aprendizaje"] },
      { title: "Jornada laboral", type: "single_choice", required: true, options: ["Diurna", "Nocturna", "Mixta", "Turnos rotativos"] },
      { title: "Antigüedad en la empresa (años)", type: "number" },
    ],
  },
  {
    title: "3. Información familiar",
    questions: [
      { title: "Número de personas a cargo", type: "number", required: true },
      { title: "¿Tiene hijos?", type: "boolean", required: true },
      { title: "Número de hijos", type: "number" },
      { title: "Personas con quienes convive", type: "multi_choice", options: ["Cónyuge/Pareja", "Hijos", "Padres", "Hermanos", "Otros familiares", "Vive solo(a)"] },
    ],
  },
  {
    title: "4. Vivienda",
    questions: [
      { title: "Tipo de vivienda", type: "single_choice", required: true, options: ["Propia", "Arrendada", "Familiar", "Otra"] },
      { title: "Estrato socioeconómico", type: "single_choice", required: true, options: ["1", "2", "3", "4", "5", "6"] },
      { title: "Ciudad/Municipio de residencia", type: "short_text", required: true },
      { title: "Barrio", type: "short_text" },
      { title: "Servicios públicos con los que cuenta", type: "multi_choice", options: ["Agua", "Energía", "Gas", "Internet", "Alcantarillado", "Recolección de basuras"] },
    ],
  },
  {
    title: "5. Transporte",
    questions: [
      { title: "Medio de transporte principal al trabajo", type: "single_choice", required: true, options: ["A pie", "Bicicleta", "Motocicleta", "Vehículo particular", "Transporte público", "Transporte de la empresa"] },
      { title: "Tiempo de desplazamiento al trabajo (minutos)", type: "number" },
    ],
  },
  {
    title: "6. Salud",
    questions: [
      { title: "EPS a la que está afiliado(a)", type: "short_text", required: true },
      { title: "ARL", type: "short_text" },
      { title: "Fondo de pensiones", type: "short_text" },
      { title: "¿Padece alguna enfermedad crónica?", type: "boolean" },
      { title: "Indique cuál(es)", type: "long_text" },
      { title: "¿Toma medicamentos de forma permanente?", type: "boolean" },
      { title: "¿Ha tenido accidentes de trabajo?", type: "boolean" },
    ],
  },
  {
    title: "7. Hábitos y estilo de vida",
    questions: [
      { title: "¿Realiza actividad física regularmente?", type: "boolean" },
      { title: "Frecuencia semanal de actividad física", type: "single_choice", options: ["Ninguna", "1-2 veces", "3-4 veces", "5 o más veces"] },
      { title: "¿Fuma?", type: "boolean" },
      { title: "¿Consume bebidas alcohólicas?", type: "single_choice", options: ["Nunca", "Ocasionalmente", "Frecuentemente"] },
      { title: "Horas promedio de sueño diarias", type: "number" },
    ],
  },
  {
    title: "8. Observaciones",
    questions: [
      { title: "Comentarios u observaciones adicionales", type: "long_text" },
    ],
  },
];

export async function seedSstSociodemografico(userId: string): Promise<string> {
  const { data: survey, error: sErr } = await supabase.from("surveys").insert({
    title: "Perfil Sociodemográfico SST",
    description: "Encuesta de caracterización sociodemográfica del personal — SG-SST Novasalud Caribe IPS.",
    status: "draft",
    created_by: userId,
    autosave_enabled: true,
  }).select().single();
  if (sErr) throw sErr;

  for (let i = 0; i < SECTIONS.length; i++) {
    const sec = SECTIONS[i];
    const { data: section, error: secErr } = await supabase.from("survey_sections").insert({
      survey_id: survey.id,
      title: sec.title,
      description: sec.description ?? null,
      order_index: i,
    }).select().single();
    if (secErr) throw secErr;

    for (let j = 0; j < sec.questions.length; j++) {
      const q = sec.questions[j];
      const { data: question, error: qErr } = await supabase.from("survey_questions").insert({
        survey_id: survey.id,
        section_id: section.id,
        title: q.title,
        type: q.type,
        is_required: q.required ?? false,
        order_index: j,
      }).select().single();
      if (qErr) throw qErr;

      if (q.options && q.options.length) {
        const optsPayload = q.options.map((label, k) => ({
          question_id: question.id,
          label,
          value: label,
          order_index: k,
        }));
        const { error: oErr } = await supabase.from("survey_question_options").insert(optsPayload);
        if (oErr) throw oErr;
      }
    }
  }

  return survey.id;
}
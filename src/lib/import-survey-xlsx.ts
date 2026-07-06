import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export type ImportQType =
  | "short_text" | "long_text" | "number" | "date" | "time" | "email" | "phone"
  | "dropdown" | "single_choice" | "multi_choice" | "boolean" | "rating" | "scale";

export interface ImportQuestion {
  id: string;
  question_text: string;
  question_type: ImportQType;
  is_required: boolean;
  options: string[];
  help_text?: string;
}

export interface ImportSection {
  id: string;
  title: string;
  description?: string;
  questions: ImportQuestion[];
}

const rid = () => Math.random().toString(36).slice(2, 10);

const TYPE_ALIASES: Record<string, ImportQType> = {
  "texto": "short_text", "texto corto": "short_text", "short_text": "short_text",
  "texto largo": "long_text", "parrafo": "long_text", "long_text": "long_text",
  "numero": "number", "número": "number", "number": "number",
  "fecha": "date", "date": "date",
  "hora": "time", "time": "time",
  "correo": "email", "email": "email",
  "telefono": "phone", "teléfono": "phone", "phone": "phone",
  "lista": "dropdown", "dropdown": "dropdown", "desplegable": "dropdown",
  "unica": "single_choice", "única": "single_choice", "single": "single_choice",
  "opcion multiple": "single_choice", "opción múltiple": "single_choice", "single_choice": "single_choice",
  "multiple": "multi_choice", "multi": "multi_choice", "multi_choice": "multi_choice",
  "casillas": "multi_choice",
  "si/no": "boolean", "sí/no": "boolean", "boolean": "boolean", "booleano": "boolean",
  "rating": "rating", "estrellas": "rating",
  "escala": "scale", "scale": "scale",
};

const norm = (s: any) => String(s ?? "").trim().toLowerCase();

function detectType(text: string, options: string[]): ImportQType {
  const t = norm(text);
  if (options.length >= 2) {
    const optNorm = options.map(norm);
    const isYesNo = options.length === 2 && optNorm.every((o) => ["si", "sí", "no"].includes(o));
    if (isYesNo) return "boolean";
    return options.length > 6 ? "dropdown" : "single_choice";
  }
  if (/(correo|email|e-mail)/.test(t)) return "email";
  if (/(tel[eé]fono|celular|whatsapp|contacto)/.test(t)) return "phone";
  if (/(fecha|nacimiento|ingreso)/.test(t)) return "date";
  if (/(edad|a[ñn]os|cantidad|n[uú]mero de|horas|minutos|estrato)/.test(t)) return "number";
  if (/(observaci|comentari|describa|explique|detalle|por qu[eé])/.test(t)) return "long_text";
  return "short_text";
}

function splitOptions(cell: any): string[] {
  if (cell == null) return [];
  const s = String(cell).trim();
  if (!s) return [];
  return s.split(/[|,;\/\n]+/).map((x) => x.trim()).filter(Boolean);
}

/**
 * Parses an Excel file. Two supported layouts:
 * A) Structured: columns [Sección, Pregunta, Tipo, Obligatoria, Opciones]
 * B) Free: each sheet = a section, column A = questions, columns B..N = options
 */
export async function parseSurveyXlsx(file: File): Promise<{ title: string; sections: ImportSection[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const title = file.name.replace(/\.(xlsx|xls|csv)$/i, "");

  // Try structured layout on first sheet
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
  const header = (rows[0] || []).map((h) => norm(h));
  const isStructured =
    header.some((h) => /secci/.test(h)) &&
    header.some((h) => /pregunta/.test(h));

  if (isStructured) {
    const idx = {
      section: header.findIndex((h) => /secci/.test(h)),
      question: header.findIndex((h) => /pregunta/.test(h)),
      type: header.findIndex((h) => /tipo/.test(h)),
      required: header.findIndex((h) => /oblig|requerid/.test(h)),
      options: header.findIndex((h) => /opci/.test(h)),
      help: header.findIndex((h) => /ayuda|help/.test(h)),
    };
    const map = new Map<string, ImportSection>();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const secTitle = String(r[idx.section] ?? "").trim() || "General";
      const qText = String(r[idx.question] ?? "").trim();
      if (!qText) continue;
      const opts = idx.options >= 0 ? splitOptions(r[idx.options]) : [];
      const typeRaw = idx.type >= 0 ? norm(r[idx.type]) : "";
      const type: ImportQType = TYPE_ALIASES[typeRaw] || detectType(qText, opts);
      const req = idx.required >= 0 ? /^(1|si|sí|true|x|obligat)/.test(norm(r[idx.required])) : false;
      if (!map.has(secTitle)) {
        map.set(secTitle, { id: rid(), title: secTitle, questions: [] });
      }
      map.get(secTitle)!.questions.push({
        id: rid(),
        question_text: qText,
        question_type: type,
        is_required: req,
        options: opts,
        help_text: idx.help >= 0 ? String(r[idx.help] ?? "").trim() : "",
      });
    }
    return { title, sections: Array.from(map.values()) };
  }

  // Free layout: each sheet = section
  const sections: ImportSection[] = [];
  for (const name of wb.SheetNames) {
    const sh = wb.Sheets[name];
    const data: any[][] = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
    const questions: ImportQuestion[] = [];
    for (const r of data) {
      const qText = String(r[0] ?? "").trim();
      if (!qText) continue;
      if (/^secci[oó]n$|^pregunta$/i.test(qText)) continue;
      const opts = r.slice(1).map((c: any) => String(c ?? "").trim()).filter(Boolean);
      const flatOpts = opts.length === 1 ? splitOptions(opts[0]) : opts;
      questions.push({
        id: rid(),
        question_text: qText,
        question_type: detectType(qText, flatOpts),
        is_required: false,
        options: flatOpts,
      });
    }
    if (questions.length) sections.push({ id: rid(), title: name, questions });
  }
  return { title, sections };
}

export async function createSurveyFromImport(
  userId: string,
  title: string,
  description: string,
  sections: ImportSection[]
): Promise<string> {
  const { data: survey, error: sErr } = await supabase
    .from("surveys")
    .insert({
      title: title || "Encuesta importada",
      description: description || null,
      status: "draft",
      created_by: userId,
      autosave_enabled: true,
    })
    .select()
    .single();
  if (sErr) throw sErr;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const { data: section, error: secErr } = await supabase
      .from("survey_sections")
      .insert({
        survey_id: survey.id,
        title: sec.title || `Sección ${i + 1}`,
        description: sec.description ?? null,
        order_index: i,
      })
      .select()
      .single();
    if (secErr) throw secErr;

    for (let j = 0; j < sec.questions.length; j++) {
      const q = sec.questions[j];
      const { data: question, error: qErr } = await supabase
        .from("survey_questions")
        .insert({
          survey_id: survey.id,
          section_id: section.id,
          question_text: q.question_text,
          question_type: q.question_type,
          is_required: q.is_required,
          help_text: q.help_text || null,
          order_index: j,
        })
        .select()
        .single();
      if (qErr) throw qErr;

      if (q.options.length && ["dropdown", "single_choice", "multi_choice"].includes(q.question_type)) {
        const payload = q.options.map((label, k) => ({
          question_id: question.id,
          label,
          value: label,
          order_index: k,
        }));
        const { error: oErr } = await supabase.from("survey_question_options").insert(payload);
        if (oErr) throw oErr;
      }
    }
  }

  return survey.id;
}

export function downloadImportTemplate() {
  const rows = [
    ["Sección", "Pregunta", "Tipo", "Obligatoria", "Opciones", "Ayuda"],
    ["Datos personales", "Nombres y apellidos", "texto", "Si", "", ""],
    ["Datos personales", "Género", "opción múltiple", "Si", "Masculino|Femenino|Otro", ""],
    ["Datos personales", "Fecha de nacimiento", "fecha", "Si", "", ""],
    ["Salud", "¿Padece enfermedad crónica?", "si/no", "No", "", ""],
    ["Salud", "Indique cuál(es)", "texto largo", "No", "", "Solo si respondió Sí"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Encuesta");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-encuesta.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
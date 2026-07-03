import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Send, Save, Layers } from "lucide-react";

type QType =
  | "short_text" | "long_text" | "number" | "date" | "time" | "email" | "phone"
  | "dropdown" | "single_choice" | "multi_choice" | "boolean" | "rating" | "scale" | "file" | "signature";

interface Section { id: string; title: string; description: string | null; order_index: number; }
interface Option { id: string; label: string; value: string; order_index: number; }
interface Question {
  id: string; section_id: string | null; question_text: string; question_type: QType;
  is_required: boolean; help_text: string | null; order_index: number; options: Option[];
}

const TYPES: { v: QType; l: string }[] = [
  { v: "short_text", l: "Texto corto" },
  { v: "long_text", l: "Texto largo" },
  { v: "number", l: "Número" },
  { v: "date", l: "Fecha" },
  { v: "time", l: "Hora" },
  { v: "email", l: "Email" },
  { v: "phone", l: "Teléfono" },
  { v: "dropdown", l: "Lista desplegable" },
  { v: "single_choice", l: "Selección única" },
  { v: "multi_choice", l: "Selección múltiple" },
  { v: "boolean", l: "Sí / No" },
  { v: "rating", l: "Calificación" },
  { v: "scale", l: "Escala" },
  { v: "file", l: "Archivo" },
  { v: "signature", l: "Firma" },
];
const withOptions: QType[] = ["dropdown", "single_choice", "multi_choice"];

export default function SurveyEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [survey, setSurvey] = useState<any>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: s } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle();
    const { data: secs } = await supabase.from("survey_sections").select("*").eq("survey_id", id).order("order_index");
    const { data: qs } = await supabase.from("survey_questions").select("*").eq("survey_id", id).order("order_index");
    const { data: opts } = await supabase.from("survey_question_options").select("*").in("question_id", (qs ?? []).map((q: any) => q.id).length ? (qs ?? []).map((q: any) => q.id) : ["00000000-0000-0000-0000-000000000000"]).order("order_index");
    setSurvey(s);
    setSections((secs ?? []) as Section[]);
    setQuestions(((qs ?? []) as any[]).map((q) => ({
      ...q,
      options: (opts ?? []).filter((o: any) => o.question_id === q.id) as Option[],
    })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const saveMeta = async () => {
    setSaving(true);
    const { error } = await supabase.from("surveys").update({
      title: survey.title, description: survey.description,
      opens_at: survey.opens_at, closes_at: survey.closes_at,
      autosave_enabled: survey.autosave_enabled, allow_multiple_responses: survey.allow_multiple_responses,
    }).eq("id", id);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Guardado" });
  };

  const publish = async () => {
    if (!questions.length) { toast({ title: "Agrega preguntas antes de publicar", variant: "destructive" }); return; }
    const { error } = await supabase.from("surveys").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Encuesta publicada" }); load(); }
  };

  const close = async () => {
    const { error } = await supabase.from("surveys").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Encuesta cerrada" }); load(); }
  };

  const addSection = async () => {
    const { data, error } = await supabase.from("survey_sections").insert({
      survey_id: id, title: `Sección ${sections.length + 1}`, order_index: sections.length,
    }).select().single();
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setSections([...sections, data as Section]);
  };
  const updateSection = async (sid: string, patch: Partial<Section>) => {
    setSections((prev) => prev.map((s) => (s.id === sid ? { ...s, ...patch } : s)));
    await supabase.from("survey_sections").update(patch).eq("id", sid);
  };
  const deleteSection = async (sid: string) => {
    if (!confirm("¿Eliminar sección y sus preguntas?")) return;
    await supabase.from("survey_sections").delete().eq("id", sid);
    setSections((prev) => prev.filter((s) => s.id !== sid));
    setQuestions((prev) => prev.filter((q) => q.section_id !== sid));
  };

  const addQuestion = async (sectionId: string | null) => {
    const idx = questions.filter((q) => q.section_id === sectionId).length;
    const { data, error } = await supabase.from("survey_questions").insert({
      survey_id: id, section_id: sectionId, question_text: "Nueva pregunta",
      question_type: "short_text", order_index: idx, is_required: false,
    }).select().single();
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setQuestions([...questions, { ...(data as any), options: [] }]);
  };

  const updateQuestion = async (qid: string, patch: Partial<Question>) => {
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
    const { options, ...rest } = patch as any;
    if (Object.keys(rest).length) await supabase.from("survey_questions").update(rest).eq("id", qid);
  };

  const deleteQuestion = async (qid: string) => {
    if (!confirm("¿Eliminar pregunta?")) return;
    await supabase.from("survey_questions").delete().eq("id", qid);
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
  };

  const moveQuestion = async (qid: string, dir: -1 | 1) => {
    const q = questions.find((x) => x.id === qid); if (!q) return;
    const siblings = questions.filter((x) => x.section_id === q.section_id).sort((a, b) => a.order_index - b.order_index);
    const i = siblings.findIndex((x) => x.id === qid);
    const j = i + dir; if (j < 0 || j >= siblings.length) return;
    const other = siblings[j];
    await Promise.all([
      supabase.from("survey_questions").update({ order_index: other.order_index }).eq("id", q.id),
      supabase.from("survey_questions").update({ order_index: q.order_index }).eq("id", other.id),
    ]);
    load();
  };

  const addOption = async (qid: string) => {
    const q = questions.find((x) => x.id === qid); if (!q) return;
    const idx = q.options.length;
    const { data, error } = await supabase.from("survey_question_options").insert({
      question_id: qid, label: `Opción ${idx + 1}`, value: `opt_${idx + 1}`, order_index: idx,
    }).select().single();
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setQuestions((prev) => prev.map((x) => x.id === qid ? { ...x, options: [...x.options, data as Option] } : x));
  };
  const updateOption = async (qid: string, oid: string, patch: Partial<Option>) => {
    setQuestions((prev) => prev.map((x) => x.id !== qid ? x : {
      ...x, options: x.options.map((o) => o.id === oid ? { ...o, ...patch } : o),
    }));
    await supabase.from("survey_question_options").update(patch).eq("id", oid);
  };
  const deleteOption = async (qid: string, oid: string) => {
    await supabase.from("survey_question_options").delete().eq("id", oid);
    setQuestions((prev) => prev.map((x) => x.id !== qid ? x : { ...x, options: x.options.filter((o) => o.id !== oid) }));
  };

  if (loading || !survey) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/surveys")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <Badge variant={survey.status === "published" ? "default" : survey.status === "closed" ? "outline" : "secondary"}>
            {survey.status === "published" ? "Publicada" : survey.status === "closed" ? "Cerrada" : "Borrador"}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={saveMeta} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> Guardar
          </Button>
          {survey.status === "draft" && (
            <Button size="sm" onClick={publish}>
              <Send className="w-4 h-4 mr-1" /> Publicar
            </Button>
          )}
          {survey.status === "published" && (
            <Button size="sm" variant="destructive" onClick={close}>Cerrar</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Información general</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={survey.title ?? ""} onChange={(e) => setSurvey({ ...survey, title: e.target.value })} />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={survey.description ?? ""} onChange={(e) => setSurvey({ ...survey, description: e.target.value })} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Apertura</Label>
              <Input type="datetime-local" value={survey.opens_at ? survey.opens_at.slice(0, 16) : ""}
                onChange={(e) => setSurvey({ ...survey, opens_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div>
              <Label>Cierre</Label>
              <Input type="datetime-local" value={survey.closes_at ? survey.closes_at.slice(0, 16) : ""}
                onChange={(e) => setSurvey({ ...survey, closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!survey.autosave_enabled} onCheckedChange={(v) => setSurvey({ ...survey, autosave_enabled: v })} />
              Auto-guardado
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!survey.allow_multiple_responses} onCheckedChange={(v) => setSurvey({ ...survey, allow_multiple_responses: v })} />
              Permitir múltiples respuestas
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-primary" /> Secciones y preguntas</h2>
        <Button size="sm" variant="outline" onClick={addSection}><Plus className="w-4 h-4 mr-1" /> Sección</Button>
      </div>

      {sections.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Crea una sección para empezar a agregar preguntas.
        </CardContent></Card>
      )}

      {sections.map((sec) => (
        <Card key={sec.id}>
          <CardHeader>
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input value={sec.title} onChange={(e) => updateSection(sec.id, { title: e.target.value })} className="font-semibold" />
                <Textarea placeholder="Descripción (opcional)" value={sec.description ?? ""} onChange={(e) => updateSection(sec.id, { description: e.target.value })} />
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteSection(sec.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.filter((q) => q.section_id === sec.id).sort((a, b) => a.order_index - b.order_index).map((q) => (
              <div key={q.id} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="flex items-start gap-2">
                  <div className="flex-1 grid md:grid-cols-[1fr,200px] gap-2">
                    <Input value={q.question_text} onChange={(e) => updateQuestion(q.id, { question_text: e.target.value })} />
                    <Select value={q.question_type} onValueChange={(v) => updateQuestion(q.id, { question_type: v as QType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => moveQuestion(q.id, -1)}><ArrowUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => moveQuestion(q.id, 1)}><ArrowDown className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteQuestion(q.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <Textarea placeholder="Texto de ayuda (opcional)" value={q.help_text ?? ""} onChange={(e) => updateQuestion(q.id, { help_text: e.target.value })} />
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={q.is_required} onCheckedChange={(v) => updateQuestion(q.id, { is_required: v })} />
                  Obligatoria
                </label>
                {withOptions.includes(q.question_type) && (
                  <div className="space-y-2">
                    <Separator />
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Opciones</p>
                      <Button size="sm" variant="outline" onClick={() => addOption(q.id)}><Plus className="w-3 h-3 mr-1" /> Opción</Button>
                    </div>
                    {q.options.sort((a, b) => a.order_index - b.order_index).map((o) => (
                      <div key={o.id} className="flex gap-2 items-center">
                        <Input value={o.label} onChange={(e) => updateOption(q.id, o.id, { label: e.target.value, value: e.target.value })} />
                        <Button size="icon" variant="ghost" onClick={() => deleteOption(q.id, o.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => addQuestion(sec.id)}><Plus className="w-4 h-4 mr-1" /> Pregunta</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
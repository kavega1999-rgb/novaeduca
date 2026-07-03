import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from "lucide-react";

export default function SurveyRespond() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userRole, setUserRole] = useState("");
  const [survey, setSurvey] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [options, setOptions] = useState<any[]>([]);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (prof) setUserRole(prof.role as string);

      const { data: s } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle();
      if (!s) { toast({ title: "Encuesta no encontrada", variant: "destructive" }); navigate("/surveys"); return; }
      const { data: secs } = await supabase.from("survey_sections").select("*").eq("survey_id", id).order("order_index");
      const { data: qs } = await supabase.from("survey_questions").select("*").eq("survey_id", id).order("order_index");
      const qIds = (qs ?? []).map((q: any) => q.id);
      const { data: opts } = qIds.length
        ? await supabase.from("survey_question_options").select("*").in("question_id", qIds).order("order_index")
        : { data: [] as any[] };

      let { data: resp } = await supabase.from("survey_responses").select("*").eq("survey_id", id).eq("user_id", user.id).maybeSingle();
      if (!resp) {
        const { data: created, error } = await supabase.from("survey_responses").insert({
          survey_id: id!, user_id: user.id, status: "in_progress", started_at: new Date().toISOString(),
        }).select().single();
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
        resp = created;
      } else if (resp.status === "submitted") {
        setDone(true);
      }

      const { data: ans } = await supabase.from("survey_answers").select("*").eq("response_id", resp!.id);
      const map: Record<string, any> = {};
      (ans ?? []).forEach((a: any) => {
        const q = (qs ?? []).find((x: any) => x.id === a.question_id);
        if (!q) return;
        if (["multi_choice"].includes(q.question_type)) map[a.question_id] = a.value_json ?? [];
        else if (["number", "rating", "scale"].includes(q.question_type)) map[a.question_id] = a.value_number;
        else if (q.question_type === "boolean") map[a.question_id] = a.value_boolean;
        else if (["date", "time"].includes(q.question_type)) map[a.question_id] = a.value_date ?? a.value_text;
        else map[a.question_id] = a.value_text;
      });

      setSurvey(s); setSections(secs ?? []); setQuestions(qs ?? []); setOptions(opts ?? []);
      setResponseId(resp!.id); setAnswers(map); setLoading(false);
    })();
    // eslint-disable-next-line
  }, [id]);

  const currentSection = sections[step];
  const sectionQuestions = useMemo(
    () => currentSection ? questions.filter((q) => q.section_id === currentSection.id) : [],
    [questions, currentSection]
  );

  const totalAnswered = Object.values(answers).filter((v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)).length;
  const progress = questions.length ? Math.round((totalAnswered / questions.length) * 100) : 0;

  const setAnswer = (qid: string, v: any) => setAnswers((prev) => ({ ...prev, [qid]: v }));

  const persistAnswer = async (q: any, v: any) => {
    if (!responseId) return;
    const row: any = { response_id: responseId, question_id: q.id };
    if (["multi_choice"].includes(q.question_type)) row.value_json = v ?? [];
    else if (["number", "rating", "scale"].includes(q.question_type)) row.value_number = v === "" || v === null ? null : Number(v);
    else if (q.question_type === "boolean") row.value_boolean = v;
    else if (["date"].includes(q.question_type)) row.value_date = v || null;
    else row.value_text = v ?? null;
    await supabase.from("survey_answers").upsert(row, { onConflict: "response_id,question_id" as any });
    await supabase.from("survey_responses").update({ last_saved_at: new Date().toISOString() }).eq("id", responseId);
  };

  const saveSection = async () => {
    for (const q of sectionQuestions) await persistAnswer(q, answers[q.id]);
  };

  const next = async () => { await saveSection(); setStep((s) => Math.min(sections.length - 1, s + 1)); window.scrollTo({ top: 0 }); };
  const prev = () => { setStep((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0 }); };

  const submit = async () => {
    const missing = questions.filter((q) => q.is_required && (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === "" || (Array.isArray(answers[q.id]) && answers[q.id].length === 0)));
    if (missing.length) { toast({ title: "Faltan respuestas obligatorias", description: `${missing.length} pregunta(s)`, variant: "destructive" }); return; }
    if (!confirm("¿Enviar respuestas? No podrás modificarlas después.")) return;
    setSubmitting(true);
    await saveSection();
    const { error } = await supabase.from("survey_responses").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", responseId!);
    setSubmitting(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setDone(true); toast({ title: "Respuestas enviadas" }); }
  };

  if (loading) return <div className="min-h-screen bg-background"><Navigation userRole={userRole} /><div className="p-6 text-sm text-muted-foreground">Cargando…</div></div>;

  if (done) return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 mx-auto text-primary" />
            <h2 className="text-xl font-semibold">Encuesta enviada</h2>
            <p className="text-sm text-muted-foreground">Gracias por diligenciar la encuesta.</p>
            <Button onClick={() => navigate("/surveys")}>Volver a mis encuestas</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderQuestion = (q: any) => {
    const v = answers[q.id];
    const opts = options.filter((o) => o.question_id === q.id).sort((a, b) => a.order_index - b.order_index);
    switch (q.question_type) {
      case "long_text":
        return <Textarea value={v ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />;
      case "number": case "rating": case "scale":
        return <Input type="number" value={v ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />;
      case "date":
        return <Input type="date" value={v ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />;
      case "time":
        return <Input type="time" value={v ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />;
      case "email":
        return <Input type="email" value={v ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />;
      case "phone":
        return <Input type="tel" value={v ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />;
      case "boolean":
        return (
          <RadioGroup value={v === true ? "true" : v === false ? "false" : ""} onValueChange={(val) => setAnswer(q.id, val === "true")}>
            <label className="flex items-center gap-2"><RadioGroupItem value="true" /> Sí</label>
            <label className="flex items-center gap-2"><RadioGroupItem value="false" /> No</label>
          </RadioGroup>
        );
      case "dropdown":
        return (
          <Select value={v ?? ""} onValueChange={(val) => setAnswer(q.id, val)}>
            <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
            <SelectContent>
              {opts.map((o) => <SelectItem key={o.id} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case "single_choice":
        return (
          <RadioGroup value={v ?? ""} onValueChange={(val) => setAnswer(q.id, val)}>
            {opts.map((o) => (
              <label key={o.id} className="flex items-center gap-2"><RadioGroupItem value={o.value} /> {o.label}</label>
            ))}
          </RadioGroup>
        );
      case "multi_choice":
        return (
          <div className="space-y-2">
            {opts.map((o) => {
              const arr: string[] = Array.isArray(v) ? v : [];
              const checked = arr.includes(o.value);
              return (
                <label key={o.id} className="flex items-center gap-2">
                  <Checkbox checked={checked} onCheckedChange={(c) => {
                    const next = c ? [...arr, o.value] : arr.filter((x) => x !== o.value);
                    setAnswer(q.id, next);
                  }} />
                  {o.label}
                </label>
              );
            })}
          </div>
        );
      case "file": case "signature":
        return <p className="text-xs text-muted-foreground">Tipo disponible próximamente.</p>;
      default:
        return <Input value={v ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/surveys")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>

        <div>
          <h1 className="text-2xl font-bold">{survey.title}</h1>
          {survey.description && <p className="text-muted-foreground text-sm">{survey.description}</p>}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progreso</span><span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        </div>

        {currentSection ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{currentSection.title}</CardTitle>
              {currentSection.description && <CardDescription>{currentSection.description}</CardDescription>}
              <p className="text-xs text-muted-foreground">Sección {step + 1} de {sections.length}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {sectionQuestions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <Label>
                    {q.question_text}{q.is_required && <span className="text-destructive"> *</span>}
                  </Label>
                  {q.help_text && <p className="text-xs text-muted-foreground">{q.help_text}</p>}
                  {renderQuestion(q)}
                </div>
              ))}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={prev} disabled={step === 0}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                {step < sections.length - 1 ? (
                  <Button onClick={next}>Siguiente <ArrowRight className="w-4 h-4 ml-1" /></Button>
                ) : (
                  <Button onClick={submit} disabled={submitting}>
                    <Send className="w-4 h-4 mr-1" /> Enviar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Esta encuesta aún no tiene contenido.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
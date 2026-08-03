import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Download, Users, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { downloadXlsx } from "@/lib/xlsx-utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#1e3a8a", "#f59e0b", "#0ea5e9", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

const PAGE = 1000;

// Trae TODOS los registros paginando (PostgREST limita a 1000 por defecto)
async function fetchAllAnswers(responseIds: string[]) {
  const all: any[] = [];
  for (let i = 0; i < responseIds.length; i += 100) {
    const chunk = responseIds.slice(i, i + 100);
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("survey_answers")
        .select("*")
        .in("response_id", chunk)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      all.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
  }
  return all;
}

async function fetchAllOptions() {
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("survey_question_options")
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export default function SurveyDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [survey, setSurvey] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [options, setOptions] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: s }, { data: secs }, { data: qs }, opts, { data: resps }] = await Promise.all([
        supabase.from("surveys").select("*").eq("id", id).single(),
        supabase.from("survey_sections").select("*").eq("survey_id", id).order("order_index"),
        supabase.from("survey_questions").select("*").eq("survey_id", id).order("order_index"),
        fetchAllOptions(),
        supabase.from("survey_responses").select("*").eq("survey_id", id).range(0, 9999),
      ]);
      setSurvey(s);
      setSections(secs ?? []);
      setQuestions(qs ?? []);
      setOptions(opts ?? []);
      setResponses(resps ?? []);

      const respIds = (resps ?? []).map((r: any) => r.id);
      if (respIds.length) {
        const ans = await fetchAllAnswers(respIds);
        setAnswers(ans);
        const userIds = Array.from(new Set((resps ?? []).map((r: any) => r.user_id).filter(Boolean)));
        if (userIds.length) {
          const map: Record<string, any> = {};
          for (let i = 0; i < userIds.length; i += 200) {
            const { data: profs } = await supabase
              .from("profiles")
              .select("id,full_name,id_number,position,leader_area_id")
              .in("id", userIds.slice(i, i + 200) as string[]);
            (profs ?? []).forEach((p: any) => { map[p.id] = p; });
          }
          setProfiles(map);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const submitted = responses.filter(r => r.status === "submitted");
  const inProgress = responses.filter(r => r.status === "in_progress");

  const answersByQuestion = useMemo(() => {
    const map: Record<string, any[]> = {};
    answers.forEach(a => { (map[a.question_id] ||= []).push(a); });
    return map;
  }, [answers]);

  const optionsByQuestion = useMemo(() => {
    const map: Record<string, any[]> = {};
    options.forEach(o => { (map[o.question_id] ||= []).push(o); });
    return map;
  }, [options]);

  const chartData = (qId: string, type: string) => {
    const qAnswers = answersByQuestion[qId] ?? [];
    const counts: Record<string, number> = {};
    qAnswers.forEach(a => {
      let vals: string[] = [];
      if (type === "multi_choice" && Array.isArray(a.value_json)) vals = a.value_json as string[];
      else if (a.value_text) vals = [a.value_text];
      else if (a.value_number !== null && a.value_number !== undefined) vals = [String(a.value_number)];
      else if (a.value_boolean !== null && a.value_boolean !== undefined) vals = [a.value_boolean ? "Sí" : "No"];
      vals.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const exportXlsx = () => {
    const answeredIds = new Set(answers.map(a => a.response_id));
    const exportable = responses.filter(r => r.status === "submitted" || answeredIds.has(r.id));
    if (!exportable.length) {
      toast({ title: "Sin respuestas", description: "No hay respuestas enviadas para exportar." });
      return;
    }
    const labelFor = (qId: string, value: string) => {
      const opt = (optionsByQuestion[qId] ?? []).find((o: any) => o.value === value);
      return opt?.label ?? value;
    };
    const answersByResponse: Record<string, any[]> = {};
    answers.forEach(a => { (answersByResponse[a.response_id] ||= []).push(a); });
    const headers = ["Cédula", "Nombre", "Cargo", "Estado", "Fecha envío", ...questions.map(q => q.question_text)];
    const rows = exportable.map(r => {
      const p = profiles[r.user_id] ?? {};
      const rAns = answersByResponse[r.id] ?? [];
      const row: any[] = [
        p.id_number ?? "",
        p.full_name ?? "",
        p.position ?? "",
        r.status === "submitted" ? "Enviada" : r.status === "in_progress" ? "En Proceso" : r.status,
        r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "",
      ];
      questions.forEach(q => {
        const a = rAns.find(x => x.question_id === q.id);
        if (!a) { row.push(""); return; }
        const hasOptions = (optionsByQuestion[q.id] ?? []).length > 0;
        if (Array.isArray(a.value_json)) {
          row.push((a.value_json as any[]).map(v => hasOptions ? labelFor(q.id, v) : v).join(", "));
        } else if (a.value_text !== null && a.value_text !== undefined && a.value_text !== "") {
          row.push(hasOptions ? labelFor(q.id, a.value_text) : a.value_text);
        } else if (a.value_number !== null && a.value_number !== undefined) {
          row.push(a.value_number);
        } else if (a.value_boolean !== null && a.value_boolean !== undefined) {
          row.push(a.value_boolean ? "Sí" : "No");
        } else if (a.value_date) {
          row.push(a.value_date);
        } else {
          row.push("");
        }
      });
      return row;
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Respuestas");
    downloadXlsx(wb, `${(survey?.title ?? "encuesta").replace(/\s+/g, "_")}_respuestas.xlsx`);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
  if (!survey) return <div className="p-6">Encuesta no encontrada.</div>;

  const chartableTypes = ["single_choice", "multi_choice", "dropdown", "boolean", "rating", "scale"];
  const chartableQuestions = questions.filter(q => chartableTypes.includes(q.question_type));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/surveys")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> {survey.title}
            </h1>
            <p className="text-sm text-muted-foreground">Dashboard de resultados en tiempo real</p>
          </div>
        </div>
        <Button onClick={exportXlsx}>
          <Download className="w-4 h-4 mr-2" /> Exportar XLSX
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Total respuestas" value={responses.length} />
        <Kpi icon={CheckCircle2} label="Enviadas" value={submitted.length} />
        <Kpi icon={Clock} label="En Proceso" value={inProgress.length} />
        <Kpi icon={BarChart3} label="Preguntas" value={questions.length} />
      </div>

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
          <TabsTrigger value="table">Tabla consolidada</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
        </TabsList>
        <TabsContent value="charts" className="space-y-4">
          {chartableQuestions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No hay preguntas graficables.</CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {chartableQuestions.map(q => {
                const data = chartData(q.id, q.question_type);
                return (
                  <Card key={q.id}>
                    <CardHeader><CardTitle className="text-base">{q.question_text}</CardTitle></CardHeader>
                    <CardContent style={{ height: 260 }}>
                      {data.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin respuestas aún.</p>
                      ) : q.question_type === "boolean" ? (
                        <ResponsiveContainer><PieChart>
                          <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
                            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie><Legend /><Tooltip />
                        </PieChart></ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer><BarChart data={data}>
                          <XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} /><Tooltip />
                          <Bar dataKey="value" fill="#1e3a8a" />
                        </BarChart></ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Respuestas enviadas</CardTitle>
              <CardDescription>Vista consolidada. Usa "Exportar XLSX" para el detalle completo.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Cédula</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Cargo</th>
                    <th className="py-2 pr-3">Fecha envío</th>
                    <th className="py-2 pr-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {submitted.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Aún no hay respuestas enviadas.</td></tr>
                  )}
                  {submitted.map(r => {
                    const p = profiles[r.user_id] ?? {};
                    return (
                      <tr key={r.id} className="border-b">
                        <td className="py-2 pr-3">{p.id_number ?? "—"}</td>
                        <td className="py-2 pr-3">{p.full_name ?? "—"}</td>
                        <td className="py-2 pr-3">{p.position ?? "—"}</td>
                        <td className="py-2 pr-3">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</td>
                        <td className="py-2 pr-3"><Badge>Enviada</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usuarios que han respondido</CardTitle>
              <CardDescription>Incluye quienes ya enviaron y quienes están en proceso.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Cédula</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Cargo</th>
                    <th className="py-2 pr-3">Inicio</th>
                    <th className="py-2 pr-3">Última actualización</th>
                    <th className="py-2 pr-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Aún no hay usuarios respondiendo.</td></tr>
                  )}
                  {[...responses]
                    .sort((a, b) => new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime())
                    .map(r => {
                      const p = profiles[r.user_id] ?? {};
                      return (
                        <tr key={r.id} className="border-b">
                          <td className="py-2 pr-3">{p.id_number ?? "—"}</td>
                          <td className="py-2 pr-3">{p.full_name ?? "—"}</td>
                          <td className="py-2 pr-3">{p.position ?? "—"}</td>
                          <td className="py-2 pr-3">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                          <td className="py-2 pr-3">{r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}</td>
                          <td className="py-2 pr-3">
                            {r.status === "submitted"
                              ? <Badge>Enviada</Badge>
                              : r.status === "in_progress"
                                ? <Badge variant="secondary">En Proceso</Badge>
                                : <Badge variant="outline">{r.status}</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="w-5 h-5" /></div>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Smile, TrendingUp, MessageSquare, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

interface Row {
  id: string;
  user_id: string;
  score: number;
  comment: string | null;
  context: string;
  context_label: string | null;
  created_at: string;
  full_name?: string;
}

const FACES: Record<number, string> = { 1: "😞", 2: "🙁", 3: "😐", 4: "🙂", 5: "😄" };

export default function SatisfactionDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("satisfaction_feedback")
        .select("*")
        .order("created_at", { ascending: false });
      const ids = Array.from(new Set((data || []).map(r => r.user_id)));
      let namesMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        namesMap = Object.fromEntries((profs || []).map(p => [p.id, p.full_name]));
      }
      setRows((data || []).map(r => ({ ...r, full_name: namesMap[r.user_id] || "—" })));
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const total = rows.length;
    if (!total) return { total: 0, avg: 0, csat: 0, promoters: 0, detractors: 0 };
    const sum = rows.reduce((a, r) => a + r.score, 0);
    const avg = sum / total;
    const promoters = rows.filter(r => r.score >= 4).length;
    const detractors = rows.filter(r => r.score <= 2).length;
    return {
      total,
      avg: Math.round(avg * 10) / 10,
      csat: Math.round((promoters / total) * 100),
      promoters,
      detractors,
    };
  }, [rows]);

  const distribution = useMemo(() => {
    const dist = [1, 2, 3, 4, 5].map(s => ({
      score: `${FACES[s]} ${s}`,
      count: rows.filter(r => r.score === s).length,
    }));
    return dist;
  }, [rows]);

  const trend = useMemo(() => {
    const byDay: Record<string, { total: number; sum: number }> = {};
    rows.forEach(r => {
      const day = r.created_at.slice(0, 10);
      byDay[day] = byDay[day] || { total: 0, sum: 0 };
      byDay[day].total += 1;
      byDay[day].sum += r.score;
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([day, v]) => ({ day: day.slice(5), avg: Math.round((v.sum / v.total) * 10) / 10 }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r =>
      !q ||
      (r.full_name || "").toLowerCase().includes(q) ||
      (r.comment || "").toLowerCase().includes(q) ||
      r.context.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Smile className="h-6 w-6 text-primary" /> Satisfacción de usuarios</h1>
        <p className="text-sm text-muted-foreground">Retroalimentación recolectada mediante el widget flotante "¿Cómo vamos?"</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Respuestas totales</CardDescription><CardTitle className="text-3xl">{kpis.total}</CardTitle></CardHeader>
          <CardContent><Users className="h-4 w-4 text-muted-foreground" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Puntaje promedio</CardDescription><CardTitle className="text-3xl">{kpis.avg} <span className="text-base text-muted-foreground">/ 5</span></CardTitle></CardHeader>
          <CardContent><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>CSAT (satisfechos)</CardDescription><CardTitle className="text-3xl text-emerald-600">{kpis.csat}%</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{kpis.promoters} usuarios calificaron 🙂 o 😄</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Detractores</CardDescription><CardTitle className="text-3xl text-red-600">{kpis.detractors}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">Calificaciones 😞 o 🙁</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribución por puntaje</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="score" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Tendencia (últimos 30 días con datos)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis domain={[1, 5]} />
                <Tooltip />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comentarios y respuestas</CardTitle>
              <CardDescription>Detalle individual de la retroalimentación</CardDescription>
            </div>
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aún no hay respuestas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Puntaje</TableHead>
                  <TableHead>Contexto</TableHead>
                  <TableHead>Comentario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>{r.full_name}</TableCell>
                    <TableCell><span className="text-xl mr-1">{FACES[r.score]}</span><Badge variant="outline">{r.score}/5</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{r.context_label || r.context}</Badge></TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{r.comment || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, FileSpreadsheet, Users, Activity, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SurveyRow {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "closed";
  is_template: boolean;
  opens_at: string | null;
  closes_at: string | null;
  category_id: string | null;
  created_at: string;
}

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  published: "Publicada",
  closed: "Cerrada",
};
const statusVariant: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  published: "default",
  closed: "outline",
};

export default function SurveysAdmin() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ total: 0, published: 0, draft: 0, responses: 0 });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("surveys")
      .select("id,title,description,status,is_template,opens_at,closes_at,category_id,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error al cargar encuestas", description: error.message, variant: "destructive" });
    } else {
      const rows = (data ?? []) as SurveyRow[];
      setSurveys(rows);
      setKpis({
        total: rows.length,
        published: rows.filter((r) => r.status === "published").length,
        draft: rows.filter((r) => r.status === "draft").length,
        responses: 0,
      });

      const { count } = await supabase
        .from("survey_responses")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted");
      setKpis((k) => ({ ...k, responses: count ?? 0 }));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createSurvey = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("surveys").insert({
      title: "Nueva encuesta",
      status: "draft",
      created_by: user.id,
      autosave_enabled: true,
    }).select().single();
    if (error) {
      toast({ title: "Error al crear encuesta", description: error.message, variant: "destructive" });
      return;
    }
    navigate(`/dashboard/surveys/${data.id}/edit`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            Encuestas Institucionales
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestión centralizada de encuestas para todas las áreas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled title="Disponible en Fase 3">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Importar desde Excel
          </Button>
          <Button onClick={createSurvey}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva encuesta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardList} label="Total encuestas" value={kpis.total} />
        <KpiCard icon={Activity} label="Publicadas" value={kpis.published} />
        <KpiCard icon={Clock} label="Borradores" value={kpis.draft} />
        <KpiCard icon={CheckCircle2} label="Respuestas enviadas" value={kpis.responses} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Listado de encuestas</CardTitle>
          <CardDescription>Todas las encuestas visibles según tus permisos.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : surveys.length === 0 ? (
            <div className="text-center py-10">
              <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Aún no hay encuestas creadas. Haz clic en "Nueva encuesta" para crear la primera.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {surveys.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{s.title}</p>
                      <Badge variant={statusVariant[s.status]}>{statusLabel[s.status]}</Badge>
                      {s.is_template && <Badge variant="outline">Plantilla</Badge>}
                    </div>
                    {s.description && (
                      <p className="text-sm text-muted-foreground truncate">{s.description}</p>
                    )}
                  </div>
                  <Link to={`/dashboard/surveys/${s.id}/edit`}>
                    <Button size="sm" variant="outline">Abrir</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
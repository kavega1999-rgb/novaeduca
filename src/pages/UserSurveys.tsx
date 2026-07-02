import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Clock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SurveyItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  opens_at: string | null;
  closes_at: string | null;
}

export default function UserSurveys() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile) setUserRole(profile.role as string);

      const { data: sData } = await supabase
        .from("surveys")
        .select("id,title,description,status,opens_at,closes_at")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      const { data: rData } = await supabase
        .from("survey_responses")
        .select("survey_id,status")
        .eq("user_id", user.id);

      const map: Record<string, string> = {};
      (rData ?? []).forEach((r: any) => { map[r.survey_id] = r.status; });
      setResponses(map);
      setSurveys((sData ?? []) as SurveyItem[]);
      setLoading(false);
    })();
  }, [navigate]);

  const statusOf = (id: string) => {
    const r = responses[id];
    if (r === "submitted") return { label: "Respondida", variant: "default" as const, icon: CheckCircle2 };
    if (r === "in_progress") return { label: "En Proceso", variant: "secondary" as const, icon: Clock };
    return { label: "Pendiente", variant: "outline" as const, icon: Clock };
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            Mis Encuestas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Encuestas asignadas que debes diligenciar.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : surveys.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No tienes encuestas asignadas por el momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {surveys.map((s) => {
              const st = statusOf(s.id);
              const Icon = st.icon;
              return (
                <Card key={s.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{s.title}</CardTitle>
                      <Badge variant={st.variant} className="flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {st.label}
                      </Badge>
                    </div>
                    {s.description && <CardDescription>{s.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      disabled={responses[s.id] === "submitted"}
                      onClick={() => navigate(`/surveys/${s.id}/respond`)}
                    >
                      {responses[s.id] === "submitted" ? "Ya respondida" : responses[s.id] === "in_progress" ? "Continuar" : "Responder"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
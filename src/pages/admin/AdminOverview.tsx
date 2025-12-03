import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle, XCircle, Clock, TrendingUp, Calendar, Users, FileText } from "lucide-react";

interface AreaStats {
  name: string;
  count: number;
  color: string;
}

interface RecentTraining {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  area_name: string;
}

const AdminOverview = () => {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    draft: 0,
  });
  const [areaStats, setAreaStats] = useState<AreaStats[]>([]);
  const [recentTrainings, setRecentTrainings] = useState<RecentTraining[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    // Fetch all trainings with area info
    const { data: trainings } = await supabase
      .from("trainings")
      .select(`
        id,
        title,
        type,
        status,
        created_at,
        areas:area_id (name, color)
      `)
      .order("created_at", { ascending: false });

    if (trainings) {
      // Calculate general stats
      const active = trainings.filter(t => t.status === "active").length;
      const inactive = trainings.filter(t => t.status === "archived").length;
      const draft = trainings.filter(t => t.status === "draft").length;

      setStats({
        total: trainings.length,
        active,
        inactive,
        draft,
      });

      // Calculate stats by area
      const areaMap = new Map<string, { count: number; color: string }>();
      trainings.forEach(t => {
        const area = t.areas as any;
        if (area) {
          const current = areaMap.get(area.name) || { count: 0, color: area.color || "primary" };
          areaMap.set(area.name, { count: current.count + 1, color: current.color });
        }
      });

      setAreaStats(
        Array.from(areaMap.entries()).map(([name, data]) => ({
          name,
          count: data.count,
          color: data.color,
        }))
      );

      // Get recent trainings (last 5)
      setRecentTrainings(
        trainings.slice(0, 5).map(t => ({
          id: t.id,
          title: t.title,
          type: t.type,
          status: t.status,
          created_at: t.created_at,
          area_name: (t.areas as any)?.name || "Sin área",
        }))
      );
    }

    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      active: { label: "Activo", variant: "default" },
      draft: { label: "Borrador", variant: "secondary" },
      archived: { label: "Archivado", variant: "outline" },
    };
    const { label, variant } = config[status] || { label: status, variant: "outline" };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      capacitacion: "Capacitación",
      induccion: "Inducción",
      entrenamiento: "Entrenamiento",
    };
    return <Badge variant="outline" className="text-xs">{labels[type] || type}</Badge>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando estadísticas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Panel Administrativo</h1>
        <p className="text-muted-foreground mt-2">
          Resumen general de capacitaciones y estadísticas
        </p>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Total Capacitaciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              Activas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-amber-600">
              <Clock className="w-4 h-4" />
              Borradores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-600">{stats.draft}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-muted/30 border-muted-foreground/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Archivadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-muted-foreground">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Stats by Area and Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stats by Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
              Capacitaciones por Área
            </CardTitle>
            <CardDescription>Distribución de capacitaciones</CardDescription>
          </CardHeader>
          <CardContent>
            {areaStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay datos disponibles</p>
            ) : (
              <div className="space-y-4">
                {areaStats.map((area, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="font-medium text-sm">{area.name}</span>
                    </div>
                    <Badge variant="secondary">{area.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Trainings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Capacitaciones Recientes
            </CardTitle>
            <CardDescription>Últimas 5 creadas</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTrainings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay capacitaciones</p>
            ) : (
              <div className="space-y-3">
                {recentTrainings.map((training) => (
                  <div key={training.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{training.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{training.area_name}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{formatDate(training.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {getTypeBadge(training.type)}
                      {getStatusBadge(training.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Accesos Rápidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a href="/admin" className="p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center">
              <BookOpen className="w-6 h-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Ver Capacitaciones</span>
            </a>
            <a href="/dashboard/reports" className="p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Reportes</span>
            </a>
            <a href="/dashboard/users" className="p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Usuarios</span>
            </a>
            <a href="/documents" className="p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center">
              <FileText className="w-6 h-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Documentos</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;

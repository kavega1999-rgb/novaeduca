import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Users, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format, subDays } from "date-fns";

interface Training {
  id: string;
  title: string;
  type: string;
}

interface UserProgress {
  id: string;
  user_id: string;
  training_id: string;
  status: string;
  progress_percentage: number | null;
  completed_at: string | null;
  started_at: string | null;
  profiles: {
    full_name: string;
    area: string | null;
    position: string | null;
  };
}

const AttendanceRecords = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAccess = roles?.some(r => r.role === "admin" || r.role === "leader");

      if (!hasAccess) {
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos para acceder a esta página",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      fetchData();
    };

    checkAccess();
  }, [navigate, toast]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [trainingsRes, progressRes] = await Promise.all([
        supabase.from("trainings").select("id, title, type").eq("status", "active"),
        supabase.from("user_progress").select(`
          id,
          user_id,
          training_id,
          status,
          progress_percentage,
          completed_at,
          started_at,
          profiles:user_id (
            full_name,
            area,
            position
          )
        `),
      ]);

      setTrainings(trainingsRes.data || []);
      setUserProgress((progressRes.data || []) as UserProgress[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter progress
  const filteredProgress = userProgress.filter(p => {
    const progressDate = p.started_at ? new Date(p.started_at) : null;
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59);

    if (selectedTraining !== "all" && p.training_id !== selectedTraining) return false;
    if (areaFilter !== "all" && p.profiles?.area !== areaFilter) return false;
    if (progressDate && (progressDate < fromDate || progressDate > toDate)) return false;
    return true;
  });

  // Stats
  const completedCount = filteredProgress.filter(p => p.status === "completed").length;
  const inProgressCount = filteredProgress.filter(p => p.status === "in_progress").length;
  const pendingCount = filteredProgress.filter(p => p.status === "pending").length;

  const getAreaLabel = (area: string | null) => {
    const labels: Record<string, string> = {
      medicos: "Médicos",
      asistencial: "Asistencial",
      administrativos: "Administrativos",
    };
    return area ? labels[area] || area : "N/A";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      completed: { label: "Completado", variant: "default" },
      in_progress: { label: "En progreso", variant: "secondary" },
      pending: { label: "Pendiente", variant: "outline" },
    };
    const { label, variant } = config[status] || { label: status, variant: "outline" };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const downloadCSV = () => {
    if (filteredProgress.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay registros para exportar",
        variant: "destructive",
      });
      return;
    }

    const trainingName = selectedTraining === "all" 
      ? "todas_capacitaciones" 
      : trainings.find(t => t.id === selectedTraining)?.title || "capacitacion";

    const csvContent = [
      ["Nombre", "Área", "Posición", "Capacitación", "Estado", "Progreso", "Fecha Inicio", "Fecha Completado"].join(","),
      ...filteredProgress.map(p => {
        const training = trainings.find(t => t.id === p.training_id);
        return [
          `"${p.profiles?.full_name || "N/A"}"`,
          getAreaLabel(p.profiles?.area || null),
          `"${p.profiles?.position || "N/A"}"`,
          `"${training?.title || "N/A"}"`,
          p.status === "completed" ? "Completado" : p.status === "in_progress" ? "En progreso" : "Pendiente",
          `${p.progress_percentage || 0}%`,
          p.started_at ? format(new Date(p.started_at), "dd/MM/yyyy") : "N/A",
          p.completed_at ? format(new Date(p.completed_at), "dd/MM/yyyy") : "N/A"
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `asistencia_${trainingName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportado",
      description: `Se exportaron ${filteredProgress.length} registros`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Asistencia y Registros</h1>
        <p className="text-muted-foreground text-sm">Listas de asistencia y exportación de datos</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[hsl(152,55%,42%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-200" />
            <div>
              <p className="text-green-100 text-xs">Completados</p>
              <p className="text-2xl font-bold text-white">{completedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,70%,45%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-200" />
            <div>
              <p className="text-blue-100 text-xs">En Progreso</p>
              <p className="text-2xl font-bold text-white">{inProgressCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,50%,55%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-blue-200" />
            <div>
              <p className="text-blue-100 text-xs">Pendientes</p>
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Filtros y Exportación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <Label className="text-xs">Capacitación</Label>
              <Select value={selectedTraining} onValueChange={setSelectedTraining}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las capacitaciones</SelectItem>
                  {trainings.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Área</Label>
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  <SelectItem value="medicos">Médicos</SelectItem>
                  <SelectItem value="asistencial">Asistencial</SelectItem>
                  <SelectItem value="administrativos">Administrativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" className="h-9" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" className="h-9" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={downloadCSV} className="w-full h-9">
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Lista de Asistencia ({filteredProgress.length} registros)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Capacitación</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Progreso</TableHead>
                  <TableHead className="text-center">Fecha Inicio</TableHead>
                  <TableHead className="text-center">Completado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProgress.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No hay registros con los filtros seleccionados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProgress.slice(0, 50).map(p => {
                    const training = trainings.find(t => t.id === p.training_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.profiles?.full_name || "N/A"}</TableCell>
                        <TableCell>{getAreaLabel(p.profiles?.area || null)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{training?.title || "N/A"}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                        <TableCell className="text-center">{p.progress_percentage || 0}%</TableCell>
                        <TableCell className="text-center text-sm">
                          {p.started_at ? format(new Date(p.started_at), "dd/MM/yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {p.completed_at ? format(new Date(p.completed_at), "dd/MM/yyyy") : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredProgress.length > 50 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Mostrando 50 de {filteredProgress.length} registros. Exporta a CSV para ver todos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceRecords;

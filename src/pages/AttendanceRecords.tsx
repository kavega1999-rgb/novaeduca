import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Users, Filter } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface Training {
  id: string;
  title: string;
  year: number;
  area_id: string;
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
    id_type: string | null;
    id_number: string | null;
  };
  email?: string;
}

interface Area {
  id: string;
  name: string;
}

const AttendanceRecords = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedTraining, setSelectedTraining] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<string>("all");

  // Get unique years from trainings
  const years = [...new Set(trainings.map(t => t.year))].sort((a, b) => b - a);

  // Filter trainings by year and area
  const filteredTrainings = trainings.filter(t => {
    const matchesYear = selectedYear === "all" || t.year === parseInt(selectedYear);
    const matchesArea = selectedArea === "all" || t.area_id === selectedArea;
    return matchesYear && matchesArea;
  });

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
      const [trainingsRes, areasRes] = await Promise.all([
        supabase
          .from("trainings")
          .select("id, title, year, area_id")
          .eq("status", "active")
          .order("year", { ascending: false }),
        supabase
          .from("areas")
          .select("id, name")
          .order("name"),
      ]);

      setTrainings(trainingsRes.data || []);
      setAreas(areasRes.data || []);
      
      // Set default year to current year if exists
      if (trainingsRes.data && trainingsRes.data.length > 0) {
        const currentYear = new Date().getFullYear();
        const hasCurrentYear = trainingsRes.data.some(t => t.year === currentYear);
        if (hasCurrentYear) {
          setSelectedYear(currentYear.toString());
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch progress when training is selected
  useEffect(() => {
    const fetchProgress = async () => {
      if (!selectedTraining) {
        setUserProgress([]);
        return;
      }

      const { data: progressData } = await supabase
        .from("user_progress")
        .select(`
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
            position,
            id_type,
            id_number
          )
        `)
        .eq("training_id", selectedTraining);

      // Fetch emails for users with progress
      const userIds = (progressData || []).map((p: any) => p.user_id);
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        // Get emails from auth via profiles - we'll use the user's email from auth
        // Since we can't query auth.users, we'll fetch from supabase auth admin
        // For now, we include the data we have
      }

      const enrichedProgress = (progressData || []).map((p: any) => ({
        ...p,
      }));

      setUserProgress(enrichedProgress as UserProgress[]);
    };

    fetchProgress();
  }, [selectedTraining]);

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
    if (userProgress.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay registros para exportar",
        variant: "destructive",
      });
      return;
    }

    const training = trainings.find(t => t.id === selectedTraining);

    const rows = userProgress.map(p => ({
      "Nombre": p.profiles?.full_name || "N/A",
      "Tipo Documento": p.profiles?.id_type || "N/A",
      "No. Documento": p.profiles?.id_number || "N/A",
      "Área": getAreaLabel(p.profiles?.area || null),
      "Cargo": p.profiles?.position || "N/A",
      "Estado": p.status === "completed" ? "Completado" : p.status === "in_progress" ? "En progreso" : "Pendiente",
      "Progreso": `${p.progress_percentage || 0}%`,
      "Fecha Inicio": p.started_at ? format(new Date(p.started_at), "dd/MM/yyyy") : "N/A",
      "Fecha Completado": p.completed_at ? format(new Date(p.completed_at), "dd/MM/yyyy") : "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");

    // Auto-size columns
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key]).length)) + 2,
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `asistencia_${training?.title.replace(/\s+/g, "_") || "capacitacion"}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({
      title: "Exportado",
      description: `Se exportaron ${userProgress.length} registros`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Asistencia y Registros</h1>
        <p className="text-muted-foreground text-sm">Reportes de asistencia por capacitación</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Seleccionar Capacitación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Área
              </Label>
              <Select value={selectedArea} onValueChange={(value) => {
                setSelectedArea(value);
                setSelectedTraining("");
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas las áreas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  {areas.map(area => (
                    <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Año</Label>
              <Select value={selectedYear} onValueChange={(value) => {
                setSelectedYear(value);
                setSelectedTraining("");
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los años</SelectItem>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Capacitación</Label>
              <Select value={selectedTraining} onValueChange={setSelectedTraining}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar capacitación" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTrainings.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title} ({t.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={downloadCSV} 
                className="w-full h-9"
                disabled={userProgress.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar Reporte
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {selectedTraining ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Lista de Asistencia ({userProgress.length} registros)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo Doc.</TableHead>
                    <TableHead>No. Documento</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">Progreso</TableHead>
                    <TableHead className="text-center">Fecha Completado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userProgress.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No hay registros de asistencia para esta capacitación
                      </TableCell>
                    </TableRow>
                  ) : (
                    userProgress.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.profiles?.full_name || "N/A"}</TableCell>
                        <TableCell>{p.profiles?.id_type || "N/A"}</TableCell>
                        <TableCell>{p.profiles?.id_number || "N/A"}</TableCell>
                        <TableCell>{getAreaLabel(p.profiles?.area || null)}</TableCell>
                        <TableCell>{p.profiles?.position || "N/A"}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                        <TableCell className="text-center">{p.progress_percentage || 0}%</TableCell>
                        <TableCell className="text-center text-sm">
                          {p.completed_at ? format(new Date(p.completed_at), "dd/MM/yyyy") : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecciona una capacitación para ver el reporte de asistencia
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceRecords;

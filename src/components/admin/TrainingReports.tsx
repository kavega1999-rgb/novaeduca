import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Award, BookOpen, CheckCircle, Clock, AlertCircle, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface Training {
  id: string;
  title: string;
  type: string;
  area_id: string;
  areas: { name: string } | null;
}

interface UserProgress {
  id: string;
  user_id: string;
  status: string;
  progress_percentage: number;
  completed_at: string | null;
  started_at: string | null;
  profiles: {
    full_name: string;
    area: string | null;
    position: string | null;
  };
  certificates: Array<{
    id: string;
    certificate_type: string;
    file_url: string;
  }>;
}

interface GlobalStats {
  totalTrainings: number;
  completedUsers: number;
  inProgressUsers: number;
  notStartedUsers: number;
  averageProgress: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

const TrainingReports = () => {
  const { toast } = useToast();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<string | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalTrainings: 0,
    completedUsers: 0,
    inProgressUsers: 0,
    notStartedUsers: 0,
    averageProgress: 0,
  });
  
  // Filters
  const [dateFilter, setDateFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedTraining) {
      fetchUserProgress();
    }
  }, [selectedTraining]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch trainings
    const { data: trainingsData } = await supabase
      .from("trainings")
      .select(`id, title, type, area_id, areas:area_id (name)`)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Fetch areas
    const { data: areasData } = await supabase
      .from("areas")
      .select("id, name");

    // Fetch global progress stats
    const { data: allProgress } = await supabase
      .from("user_progress")
      .select("status, progress_percentage");

    if (trainingsData) {
      setTrainings(trainingsData as any);
      if (trainingsData.length > 0) {
        setSelectedTraining(trainingsData[0].id);
      }
    }

    if (areasData) {
      setAreas(areasData);
    }

    if (allProgress) {
      const completed = allProgress.filter(p => p.status === "completed").length;
      const inProgress = allProgress.filter(p => p.status === "in_progress").length;
      const notStarted = allProgress.filter(p => p.status === "pending").length;
      const avgProgress = allProgress.length > 0 
        ? Math.round(allProgress.reduce((acc, p) => acc + (p.progress_percentage || 0), 0) / allProgress.length)
        : 0;

      setGlobalStats({
        totalTrainings: trainingsData?.length || 0,
        completedUsers: completed,
        inProgressUsers: inProgress,
        notStartedUsers: notStarted,
        averageProgress: avgProgress,
      });
    }

    setIsLoading(false);
  };

  const fetchUserProgress = async () => {
    if (!selectedTraining) return;

    let query = supabase
      .from("user_progress")
      .select(`
        id,
        user_id,
        status,
        progress_percentage,
        completed_at,
        started_at,
        profiles:user_id (
          full_name,
          area,
          position
        )
      `)
      .eq("training_id", selectedTraining)
      .order("completed_at", { ascending: false, nullsFirst: false });

    const { data: progress, error } = await query;

    if (error) {
      console.error("Error fetching user progress:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el progreso de usuarios",
        variant: "destructive",
      });
      setUserProgress([]);
      return;
    }

    let result = (progress || []).map((p: any) => ({ ...p, certificates: [] as any[] }));
    const userIds = (progress || []).map((p: any) => p.user_id);

    if (userIds.length > 0) {
      const { data: certs } = await supabase
        .from("certificates")
        .select("id,user_id,training_id,certificate_type,file_url")
        .eq("training_id", selectedTraining)
        .in("user_id", userIds);

      if (certs) {
        const byUser = new Map<string, any[]>();
        certs.forEach((c: any) => {
          const list = byUser.get(c.user_id) || [];
          list.push(c);
          byUser.set(c.user_id, list);
        });
        result = result.map((p: any) => ({ ...p, certificates: byUser.get(p.user_id) || [] }));
      }
    }

    setUserProgress(result as any);
  };

  // Filter user progress
  const filteredProgress = userProgress.filter(up => {
    const matchesArea = areaFilter === "all" || up.profiles.area === areaFilter;
    const matchesDate = !dateFilter || (up.completed_at && up.completed_at.startsWith(dateFilter));
    return matchesArea && (!dateFilter || matchesDate);
  });

  // Stats for selected training
  const trainingStats = {
    completed: filteredProgress.filter(p => p.status === "completed").length,
    inProgress: filteredProgress.filter(p => p.status === "in_progress").length,
    notStarted: filteredProgress.filter(p => p.status === "pending").length,
  };

  // Chart data
  const barChartData = [
    { name: "No Iniciadas", value: globalStats.notStartedUsers, fill: "hsl(var(--chart-3))" },
    { name: "En Progreso", value: globalStats.inProgressUsers, fill: "hsl(var(--chart-2))" },
    { name: "Completadas", value: globalStats.completedUsers, fill: "hsl(var(--primary))" },
  ];

  const pieChartData = [
    { name: "Completadas", value: globalStats.completedUsers },
    { name: "En Progreso", value: globalStats.inProgressUsers },
    { name: "No Iniciadas", value: globalStats.notStartedUsers },
  ];

  const downloadAttendance = () => {
    if (!selectedTraining || filteredProgress.length === 0) return;

    const training = trainings.find(t => t.id === selectedTraining);
    const csvContent = [
      ["Nombre", "Área", "Posición", "Estado", "Progreso", "Fecha Completado"].join(","),
      ...filteredProgress.map(up => [
        up.profiles.full_name,
        up.profiles.area || "N/A",
        up.profiles.position || "N/A",
        up.status === "completed" ? "Completado" : up.status === "in_progress" ? "En progreso" : "Pendiente",
        `${up.progress_percentage}%`,
        up.completed_at ? new Date(up.completed_at).toLocaleDateString() : "N/A"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `asistencia_${training?.title}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Descargado",
      description: "La asistencia ha sido descargada exitosamente",
    });
  };

  const downloadCertificate = (fileUrl: string, userName: string, certType: string) => {
    window.open(fileUrl, "_blank");
    toast({
      title: "Descargando",
      description: `Descargando ${certType === "certificate" ? "certificado" : "constancia"} de ${userName}`,
    });
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

  const getAreaLabel = (area: string | null) => {
    const labels: Record<string, string> = {
      medicos: "Médicos",
      asistencial: "Asistencial",
      administrativos: "Administrativos",
    };
    return area ? labels[area] || area : "N/A";
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando reportes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Capacitaciones</p>
                <p className="text-3xl font-bold text-primary">{globalStats.totalTrainings}</p>
              </div>
              <BookOpen className="h-10 w-10 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completadas</p>
                <p className="text-3xl font-bold text-primary">{globalStats.completedUsers}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Progreso</p>
                <p className="text-3xl font-bold text-primary">{globalStats.inProgressUsers}</p>
              </div>
              <Clock className="h-10 w-10 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">No Iniciadas</p>
                <p className="text-3xl font-bold text-primary">{globalStats.notStartedUsers}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Progreso Promedio</p>
                <p className="text-3xl font-bold text-primary">{globalStats.averageProgress}%</p>
              </div>
              <TrendingUp className="h-10 w-10 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Estado de Capacitaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} 
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Distribución de Avance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} 
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Reporte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={selectedTraining || ""} onValueChange={setSelectedTraining}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar capacitación" />
              </SelectTrigger>
              <SelectContent>
                {trainings.map((training) => (
                  <SelectItem key={training.id} value={training.id}>
                    {training.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                <SelectItem value="medicos">Médicos</SelectItem>
                <SelectItem value="asistencial">Asistencial</SelectItem>
                <SelectItem value="administrativos">Administrativos</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="month"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Filtrar por fecha"
            />

            <Button onClick={downloadAttendance} disabled={filteredProgress.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Descargar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Participantes ({filteredProgress.length})
            </CardTitle>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-primary" />
                {trainingStats.completed} completados
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-chart-2" />
                {trainingStats.inProgress} en progreso
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-chart-3" />
                {trainingStats.notStarted} pendientes
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Posición</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Fecha Completado</TableHead>
                  <TableHead className="text-right">Certificados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProgress.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay usuarios que coincidan con los filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProgress.map((up) => (
                    <TableRow key={up.id}>
                      <TableCell className="font-medium">{up.profiles.full_name}</TableCell>
                      <TableCell>{getAreaLabel(up.profiles.area)}</TableCell>
                      <TableCell>{up.profiles.position || "N/A"}</TableCell>
                      <TableCell>{getStatusBadge(up.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-secondary rounded-full h-2 max-w-[100px]">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${up.progress_percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{up.progress_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {up.completed_at
                          ? new Date(up.completed_at).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {up.certificates.map((cert) => (
                            <Button
                              key={cert.id}
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                downloadCertificate(cert.file_url, up.profiles.full_name, cert.certificate_type)
                              }
                              title={cert.certificate_type === "certificate" ? "Descargar certificado" : "Descargar constancia"}
                            >
                              {cert.certificate_type === "certificate" ? (
                                <Award className="w-4 h-4" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </Button>
                          ))}
                          {up.certificates.length === 0 && up.status === "completed" && (
                            <span className="text-xs text-muted-foreground">Sin documentos</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingReports;

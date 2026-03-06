import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, CheckCircle, Clock, AlertCircle, TrendingUp, Users, Award, Target, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface GlobalStats {
  totalTrainings: number;
  completedUsers: number;
  inProgressUsers: number;
  notStartedUsers: number;
  averageProgress: number;
}

interface AreaStats {
  area: string;
  label: string;
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
}

interface TopTraining {
  id: string;
  title: string;
  completedCount: number;
  totalUsers: number;
  percentage: number;
}

interface Area {
  id: string;
  name: string;
}

const COLORS = ["hsl(152, 60%, 45%)", "hsl(210, 70%, 55%)", "hsl(210, 40%, 75%)", "hsl(200, 50%, 65%)"];

const TrainingReports = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"general" | "assigned">("assigned");
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalTrainings: 0,
    completedUsers: 0,
    inProgressUsers: 0,
    notStartedUsers: 0,
    averageProgress: 0,
  });
  const [areaStats, setAreaStats] = useState<AreaStats[]>([]);
  const [topTrainings, setTopTrainings] = useState<TopTraining[]>([]);
  const [totalCertificates, setTotalCertificates] = useState(0);
  const [assignments, setAssignments] = useState<{ training_id: string; user_id: string }[]>([]);
  const [targetAreas, setTargetAreas] = useState<{ training_id: string; target_area: string }[]>([]);
  const [allProgress, setAllProgress] = useState<any[]>([]);
  const [trainingsData, setTrainingsData] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [selectedArea]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch areas
    const { data: areasData } = await supabase
      .from("areas")
      .select("id, name")
      .order("name");
    
    setAreas(areasData || []);

    // Fetch trainings count - filter by area if selected
    let trainingsQuery = supabase
      .from("trainings")
      .select("id, title, area_id")
      .eq("status", "active");
    
    if (selectedArea !== "all") {
      trainingsQuery = trainingsQuery.eq("area_id", selectedArea);
    }
    
    const { data: trainingsData } = await trainingsQuery;

    const trainingIds = trainingsData?.map(t => t.id) || [];

    // Fetch global progress stats - filter by training IDs if area is selected
    let progressQuery = supabase
      .from("user_progress")
      .select("status, progress_percentage, training_id, user_id");
    
    if (selectedArea !== "all" && trainingIds.length > 0) {
      progressQuery = progressQuery.in("training_id", trainingIds);
    } else if (selectedArea !== "all" && trainingIds.length === 0) {
      // No trainings for this area
      setGlobalStats({
        totalTrainings: 0,
        completedUsers: 0,
        inProgressUsers: 0,
        notStartedUsers: 0,
        averageProgress: 0,
      });
      setAreaStats([]);
      setTopTrainings([]);
      setTotalCertificates(0);
      setIsLoading(false);
      return;
    }
    
    const { data: allProgress } = await progressQuery;

    // Fetch profiles for area stats
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, area");

    // Fetch certificates count - filter by training IDs if area is selected
    let certificatesQuery = supabase.from("certificates").select("id");
    if (selectedArea !== "all" && trainingIds.length > 0) {
      certificatesQuery = certificatesQuery.in("training_id", trainingIds);
    }
    const { data: certificates } = await certificatesQuery;

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

      // Calculate area stats
      if (profiles) {
        const userAreas = ["medicos", "asistencial", "administrativos"];
        const areaLabels: Record<string, string> = {
          medicos: "Médicos",
          asistencial: "Asistencial",
          administrativos: "Administrativos",
        };

        const stats = userAreas.map(area => {
          const areaUsers = profiles.filter(p => p.area === area).map(p => p.id);
          const areaProgress = allProgress.filter(p => areaUsers.includes(p.user_id));
          
          return {
            area,
            label: areaLabels[area],
            completed: areaProgress.filter(p => p.status === "completed").length,
            inProgress: areaProgress.filter(p => p.status === "in_progress").length,
            pending: areaProgress.filter(p => p.status === "pending").length,
            total: areaProgress.length,
          };
        });

        setAreaStats(stats);
      }

      // Calculate top trainings
      if (trainingsData) {
        const trainingStats = trainingsData.map(t => {
          const trainingProgress = allProgress.filter(p => p.training_id === t.id);
          const completedCount = trainingProgress.filter(p => p.status === "completed").length;
          const totalUsers = trainingProgress.length;
          
          return {
            id: t.id,
            title: t.title,
            completedCount,
            totalUsers,
            percentage: totalUsers > 0 ? Math.round((completedCount / totalUsers) * 100) : 0,
          };
        }).sort((a, b) => b.percentage - a.percentage).slice(0, 5);

        setTopTrainings(trainingStats);
      }
    }

    setTotalCertificates(certificates?.length || 0);
    setIsLoading(false);
  };

  // Chart data
  const barChartData = [
    { name: "No Iniciadas", value: globalStats.notStartedUsers, fill: "hsl(210, 40%, 75%)" },
    { name: "En Progreso", value: globalStats.inProgressUsers, fill: "hsl(210, 70%, 55%)" },
    { name: "Completadas", value: globalStats.completedUsers, fill: "hsl(152, 60%, 45%)" },
  ];

  const pieChartData = [
    { name: "Completadas", value: globalStats.completedUsers },
    { name: "En Progreso", value: globalStats.inProgressUsers },
    { name: "No Iniciadas", value: globalStats.notStartedUsers },
  ];

  const areaChartData = areaStats.map(a => ({
    name: a.label,
    Completadas: a.completed,
    "En Progreso": a.inProgress,
    Pendientes: a.pending,
  }));

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando reportes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Area Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 max-w-xs">
              <Label className="text-xs">Filtrar por Área de Capacitación</Label>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
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
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-[hsl(210,80%,25%)] border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-200">Total Capacitaciones</p>
                <p className="text-3xl font-bold text-white">{globalStats.totalTrainings}</p>
              </div>
              <BookOpen className="h-10 w-10 text-blue-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(152,60%,40%)] border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-100">Completadas</p>
                <p className="text-3xl font-bold text-white">{globalStats.completedUsers}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,70%,45%)] border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100">En Progreso</p>
                <p className="text-3xl font-bold text-white">{globalStats.inProgressUsers}</p>
              </div>
              <Clock className="h-10 w-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,50%,55%)] border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100">No Iniciadas</p>
                <p className="text-3xl font-bold text-white">{globalStats.notStartedUsers}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,60%,40%)] border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-200">Progreso Promedio</p>
                <p className="text-3xl font-bold text-white">{globalStats.averageProgress}%</p>
              </div>
              <TrendingUp className="h-10 w-10 text-blue-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Estado de Capacitaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
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
            <ResponsiveContainer width="100%" height={280}>
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

      {/* Charts Row 2 - Area Stats & Top Trainings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Progreso por Área de Usuario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={areaChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} 
                />
                <Legend />
                <Bar dataKey="Completadas" stackId="a" fill="hsl(152, 60%, 45%)" />
                <Bar dataKey="En Progreso" stackId="a" fill="hsl(210, 70%, 55%)" />
                <Bar dataKey="Pendientes" stackId="a" fill="hsl(210, 40%, 75%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top Capacitaciones Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topTrainings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay datos disponibles</p>
              ) : (
                topTrainings.map((training, index) => (
                  <div key={training.id} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{training.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {training.completedCount} de {training.totalUsers} completados
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{training.percentage}%</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Certificados Emitidos</p>
                <p className="text-2xl font-bold text-primary">{totalCertificates}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Inscripciones</p>
                <p className="text-2xl font-bold text-primary">
                  {globalStats.completedUsers + globalStats.inProgressUsers + globalStats.notStartedUsers}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tasa de Finalización</p>
                <p className="text-2xl font-bold text-primary">
                  {globalStats.completedUsers + globalStats.inProgressUsers + globalStats.notStartedUsers > 0
                    ? Math.round((globalStats.completedUsers / (globalStats.completedUsers + globalStats.inProgressUsers + globalStats.notStartedUsers)) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrainingReports;

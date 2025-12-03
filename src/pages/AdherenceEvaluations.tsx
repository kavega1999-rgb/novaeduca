import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Users, 
  Target, 
  TrendingUp, 
  Award,
  Activity,
  Timer,
  BarChart3,
  AlertCircle
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { format, subDays, differenceInMinutes, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface EvaluationAttempt {
  id: string;
  evaluation_id: string;
  user_id: string;
  score: number | null;
  max_score: number;
  passed: boolean | null;
  started_at: string;
  completed_at: string | null;
  status: string;
}

interface UserProgress {
  id: string;
  user_id: string;
  training_id: string;
  progress_percentage: number | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Training {
  id: string;
  title: string;
  requires_evaluation: boolean | null;
}

interface Profile {
  id: string;
  full_name: string;
  area: string | null;
}

interface AccessLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string;
  event_type: string;
  event_timestamp: string;
}

interface Evaluation {
  id: string;
  training_id: string;
  title: string;
  trainings?: { title: string };
}

// Colors for charts - blue and green tones
const COLORS = {
  approved: "hsl(152, 60%, 45%)",
  failed: "hsl(0, 70%, 55%)",
  pending: "hsl(45, 80%, 50%)",
  notStarted: "hsl(210, 40%, 75%)",
  inProgress: "hsl(210, 70%, 55%)",
  primary: "hsl(210, 80%, 45%)",
};

const AdherenceEvaluations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [attempts, setAttempts] = useState<EvaluationAttempt[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  // Filter states
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedTraining, setSelectedTraining] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    const checkAccess = async () => {
      console.log("AdherenceEvaluations: checking access...");
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("AdherenceEvaluations: no user, redirecting to auth");
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      console.log("AdherenceEvaluations: user roles:", roles);
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

      console.log("AdherenceEvaluations: access granted, fetching data...");
      fetchData();
    };

    checkAccess();
  }, [navigate, toast]);

  const fetchData = async () => {
    console.log("AdherenceEvaluations: fetchData started");
    setIsLoading(true);
    try {
      // Fetch data individually to handle errors better
      const { data: attemptsData, error: attemptsError } = await supabase
        .from("evaluation_attempts").select("*");
      if (attemptsError) console.error("Error fetching attempts:", attemptsError);

      const { data: progressData, error: progressError } = await supabase
        .from("user_progress").select("*");
      if (progressError) console.error("Error fetching progress:", progressError);

      const { data: trainingsData, error: trainingsError } = await supabase
        .from("trainings").select("id, title, requires_evaluation");
      if (trainingsError) console.error("Error fetching trainings:", trainingsError);

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles").select("id, full_name, area");
      if (profilesError) console.error("Error fetching profiles:", profilesError);

      const { data: logsData, error: logsError } = await supabase
        .from("access_logs")
        .select("id, user_id, user_name, user_email, event_type, event_timestamp")
        .order("event_timestamp", { ascending: false })
        .limit(500);
      if (logsError) console.error("Error fetching logs:", logsError);

      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from("evaluations").select("id, training_id, title, trainings(title)");
      if (evaluationsError) console.error("Error fetching evaluations:", evaluationsError);

      setAttempts(attemptsData || []);
      setUserProgress(progressData || []);
      setTrainings(trainingsData || []);
      setProfiles(profilesData || []);
      setAccessLogs(logsData || []);
      setEvaluations(evaluationsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filters
  const filteredAttempts = attempts.filter(a => {
    const attemptDate = new Date(a.started_at);
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59);

    if (selectedUser !== "all" && a.user_id !== selectedUser) return false;
    if (attemptDate < fromDate || attemptDate > toDate) return false;
    if (selectedStatus !== "all") {
      if (selectedStatus === "approved" && !a.passed) return false;
      if (selectedStatus === "failed" && (a.passed || a.status !== "completed")) return false;
      if (selectedStatus === "pending" && a.status !== "in_progress") return false;
    }
    return true;
  });

  const filteredProgress = userProgress.filter(p => {
    if (selectedUser !== "all" && p.user_id !== selectedUser) return false;
    if (selectedTraining !== "all" && p.training_id !== selectedTraining) return false;
    return true;
  });

  // Calculate KPIs
  const completedAttempts = filteredAttempts.filter(a => a.status === "completed");
  const approvedCount = completedAttempts.filter(a => a.passed).length;
  const failedCount = completedAttempts.filter(a => !a.passed).length;
  const pendingCount = filteredAttempts.filter(a => a.status === "in_progress").length;
  
  // Users who haven't started any evaluation
  const usersWithAttempts = new Set(attempts.map(a => a.user_id));
  const notStartedCount = profiles.filter(p => !usersWithAttempts.has(p.id)).length;

  // General adherence percentage
  const totalMandatoryTrainings = trainings.filter(t => t.requires_evaluation).length;
  const completedMandatory = userProgress.filter(p => {
    const training = trainings.find(t => t.id === p.training_id);
    return training?.requires_evaluation && p.status === "completed";
  }).length;
  const expectedCompletions = profiles.length * totalMandatoryTrainings;
  const adherencePercentage = expectedCompletions > 0 
    ? Math.round((completedMandatory / expectedCompletions) * 100) 
    : 0;

  // Average time per evaluation (in minutes)
  const completedWithTime = completedAttempts.filter(a => a.completed_at && a.started_at);
  const avgTimeMinutes = completedWithTime.length > 0
    ? Math.round(completedWithTime.reduce((sum, a) => {
        return sum + differenceInMinutes(new Date(a.completed_at!), new Date(a.started_at));
      }, 0) / completedWithTime.length)
    : 0;

  // Attempts per evaluation
  const attemptsByEvaluation = evaluations.map(e => {
    const evalAttempts = filteredAttempts.filter(a => a.evaluation_id === e.id);
    return {
      name: e.title || (e.trainings as any)?.title || "Sin título",
      attempts: evalAttempts.length,
      approved: evalAttempts.filter(a => a.passed).length,
      failed: evalAttempts.filter(a => a.status === "completed" && !a.passed).length,
    };
  }).filter(e => e.attempts > 0).slice(0, 10);

  // User ranking by completion
  const userCompletionRanking = profiles.map(p => {
    const userAttempts = attempts.filter(a => a.user_id === p.id);
    const passed = userAttempts.filter(a => a.passed).length;
    const total = userAttempts.length;
    return {
      id: p.id,
      name: p.full_name,
      area: p.area,
      passed,
      total,
      percentage: total > 0 ? Math.round((passed / total) * 100) : 0,
    };
  }).sort((a, b) => b.percentage - a.percentage);

  const topUsers = userCompletionRanking.slice(0, 5);
  const bottomUsers = userCompletionRanking.filter(u => u.total > 0).slice(-5).reverse();

  // Mandatory courses without completion
  const mandatoryIncomplete = trainings
    .filter(t => t.requires_evaluation)
    .map(t => {
      const usersCompleted = userProgress.filter(
        p => p.training_id === t.id && p.status === "completed"
      ).length;
      return {
        id: t.id,
        title: t.title,
        completed: usersCompleted,
        pending: profiles.length - usersCompleted,
        percentage: Math.round((usersCompleted / profiles.length) * 100),
      };
    })
    .filter(t => t.percentage < 100)
    .sort((a, b) => a.percentage - b.percentage);

  // Low adherence alerts
  const lowAdherenceUsers = userCompletionRanking.filter(u => u.total > 0 && u.percentage < 50);
  const criticalCourses = mandatoryIncomplete.filter(c => c.percentage < 30);

  // Activity history - logins per day
  const activityByDay = accessLogs
    .filter(l => l.event_type === "login")
    .reduce((acc, log) => {
      const day = format(new Date(log.event_timestamp), "MM/dd");
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const activityData = Object.entries(activityByDay)
    .slice(-14)
    .map(([day, count]) => ({ day, accesos: count }));

  // Pie chart data
  const statusPieData = [
    { name: "Aprobados", value: approvedCount, color: COLORS.approved },
    { name: "No Aprobados", value: failedCount, color: COLORS.failed },
    { name: "Pendientes", value: pendingCount, color: COLORS.pending },
    { name: "No Iniciados", value: notStartedCount, color: COLORS.notStarted },
  ].filter(d => d.value > 0);

  // Progress by training
  const progressByTraining = trainings.slice(0, 8).map(t => {
    const trainingProgress = userProgress.filter(p => p.training_id === t.id);
    const avgProgress = trainingProgress.length > 0
      ? Math.round(trainingProgress.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / trainingProgress.length)
      : 0;
    return {
      name: t.title.length > 20 ? t.title.substring(0, 20) + "..." : t.title,
      progreso: avgProgress,
    };
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Adherencia y Evaluaciones</h1>
        <p className="text-muted-foreground mt-2">
          Dashboard avanzado de seguimiento y cumplimiento
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Usuario</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Curso</Label>
              <Select value={selectedTraining} onValueChange={setSelectedTraining}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los cursos</SelectItem>
                  {trainings.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="approved">Aprobados</SelectItem>
                  <SelectItem value="failed">No aprobados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card className="bg-[hsl(152,60%,40%)] border-none shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-100">Aprobados</p>
                <p className="text-2xl font-bold text-white">{approvedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0,65%,50%)] border-none shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-100">No Aprobados</p>
                <p className="text-2xl font-bold text-white">{failedCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(45,75%,45%)] border-none shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-100">Pendientes</p>
                <p className="text-2xl font-bold text-white">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,60%,55%)] border-none shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100">No Iniciados</p>
                <p className="text-2xl font-bold text-white">{notStartedCount}</p>
              </div>
              <Users className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,80%,35%)] border-none shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100">Adherencia</p>
                <p className="text-2xl font-bold text-white">{adherencePercentage}%</p>
              </div>
              <Target className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(200,50%,45%)] border-none shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyan-100">Tiempo Prom.</p>
                <p className="text-2xl font-bold text-white">{avgTimeMinutes} min</p>
              </div>
              <Timer className="h-8 w-8 text-cyan-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Distribución de Estados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attempts by Evaluation Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Intentos por Evaluación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={attemptsByEvaluation} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" name="Aprobados" fill={COLORS.approved} stackId="a" />
                <Bar dataKey="failed" name="No Aprobados" fill={COLORS.failed} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Actividad de Accesos (últimos 14 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="accesos" 
                  stroke={COLORS.primary} 
                  strokeWidth={2}
                  dot={{ fill: COLORS.primary }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Progress by Training */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Progreso Promedio por Curso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={progressByTraining}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, "Progreso"]} />
                <Bar dataKey="progreso" fill={COLORS.inProgress} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rankings and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-[hsl(152,60%,45%)]" />
              Mayor Cumplimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topUsers.map((user, i) => (
                <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">#{i + 1}</span>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.area || "Sin área"}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-[hsl(152,60%,90%)] text-[hsl(152,60%,30%)]">
                    {user.percentage}%
                  </Badge>
                </div>
              ))}
              {topUsers.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Sin datos disponibles</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[hsl(45,80%,50%)]" />
              Menor Cumplimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bottomUsers.map((user, i) => (
                <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">#{userCompletionRanking.length - 4 + i}</span>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.area || "Sin área"}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-[hsl(0,60%,95%)] text-[hsl(0,60%,40%)]">
                    {user.percentage}%
                  </Badge>
                </div>
              ))}
              {bottomUsers.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Sin datos disponibles</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Adherence Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[hsl(0,70%,55%)]" />
              Alertas de Baja Adherencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {lowAdherenceUsers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Usuarios con &lt;50% cumplimiento</p>
                  {lowAdherenceUsers.slice(0, 3).map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/20">
                      <span className="text-sm">{user.name}</span>
                      <Badge variant="destructive">{user.percentage}%</Badge>
                    </div>
                  ))}
                  {lowAdherenceUsers.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{lowAdherenceUsers.length - 3} más...</p>
                  )}
                </div>
              )}
              {criticalCourses.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Cursos críticos (&lt;30%)</p>
                  {criticalCourses.slice(0, 3).map(course => (
                    <div key={course.id} className="flex items-center justify-between p-2 rounded bg-yellow-50 dark:bg-yellow-950/20">
                      <span className="text-sm truncate max-w-[150px]">{course.title}</span>
                      <Badge className="bg-yellow-500">{course.percentage}%</Badge>
                    </div>
                  ))}
                </div>
              )}
              {lowAdherenceUsers.length === 0 && criticalCourses.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Sin alertas</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mandatory Courses Incomplete */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Cursos Obligatorios Sin Completar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mandatoryIncomplete.slice(0, 6).map(course => (
              <div key={course.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{course.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {course.completed}/{course.completed + course.pending} ({course.percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${course.percentage}%`,
                      backgroundColor: course.percentage < 30 ? COLORS.failed : 
                                       course.percentage < 70 ? COLORS.pending : COLORS.inProgress
                    }}
                  />
                </div>
              </div>
            ))}
            {mandatoryIncomplete.length === 0 && (
              <p className="text-muted-foreground text-center py-4">Todos los cursos obligatorios están completos</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdherenceEvaluations;

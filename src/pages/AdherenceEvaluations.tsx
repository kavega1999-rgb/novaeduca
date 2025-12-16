import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  Target, 
  Award,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Filter,
  Download
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
  Legend,
} from "recharts";
import { format, subDays } from "date-fns";
import * as XLSX from "xlsx";

interface Evaluation {
  id: string;
  training_id: string;
  title: string;
  passing_score: number;
}

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
}

interface Training {
  id: string;
  title: string;
  requires_evaluation: boolean | null;
  area_id: string;
}

interface Profile {
  id: string;
  full_name: string;
  area: string | null;
}

interface Area {
  id: string;
  name: string;
}

const COLORS = {
  approved: "hsl(152, 60%, 45%)",
  failed: "hsl(0, 70%, 55%)",
  pending: "hsl(45, 80%, 50%)",
  notStarted: "hsl(210, 40%, 75%)",
  primary: "hsl(210, 80%, 45%)",
};

const AdherenceEvaluations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [attempts, setAttempts] = useState<EvaluationAttempt[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedTraining, setSelectedTraining] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
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
      const [attemptsRes, evaluationsRes, progressRes, trainingsRes, profilesRes, areasRes] = await Promise.all([
        supabase.from("evaluation_attempts").select("*"),
        supabase.from("evaluations").select("id, training_id, title, passing_score"),
        supabase.from("user_progress").select("*"),
        supabase.from("trainings").select("id, title, requires_evaluation, area_id"),
        supabase.from("profiles").select("id, full_name, area"),
        supabase.from("areas").select("id, name").order("name"),
      ]);

      setAttempts(attemptsRes.data || []);
      setEvaluations(evaluationsRes.data || []);
      setUserProgress(progressRes.data || []);
      setTrainings(trainingsRes.data || []);
      setProfiles(profilesRes.data || []);
      setAreas(areasRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter trainings by area
  const filteredTrainingsByArea = selectedArea === "all"
    ? trainings
    : trainings.filter(t => t.area_id === selectedArea);

  const trainingIdsInArea = filteredTrainingsByArea.map(t => t.id);

  // Get evaluation IDs for selected training and area
  const evaluationIdsForTraining = selectedTraining === "all" 
    ? evaluations.filter(e => selectedArea === "all" || trainingIdsInArea.includes(e.training_id)).map(e => e.id)
    : evaluations.filter(e => e.training_id === selectedTraining).map(e => e.id);

  // Apply filters
  const filteredAttempts = attempts.filter(a => {
    const attemptDate = new Date(a.started_at);
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59);

    if (selectedUser !== "all" && a.user_id !== selectedUser) return false;
    if (!evaluationIdsForTraining.includes(a.evaluation_id)) return false;
    if (attemptDate < fromDate || attemptDate > toDate) return false;
    return true;
  });

  // KPIs
  const completedAttempts = filteredAttempts.filter(a => a.status === "completed");
  const approvedCount = completedAttempts.filter(a => a.passed).length;
  const failedCount = completedAttempts.filter(a => !a.passed).length;
  const pendingCount = filteredAttempts.filter(a => a.status === "in_progress").length;
  
  const usersWithAttempts = new Set(filteredAttempts.map(a => a.user_id));
  const notStartedCount = profiles.filter(p => !usersWithAttempts.has(p.id)).length;

  // Adherencia por evaluación
  const evaluationAdherence = evaluations
    .filter(e => (selectedTraining === "all" || e.training_id === selectedTraining) && 
                 (selectedArea === "all" || trainingIdsInArea.includes(e.training_id)))
    .map(e => {
      const training = trainings.find(t => t.id === e.training_id);
      const evalAttempts = attempts.filter(a => a.evaluation_id === e.id);
      const completedEval = evalAttempts.filter(a => a.status === "completed");
      const passedEval = completedEval.filter(a => a.passed).length;
      const failedEval = completedEval.filter(a => !a.passed).length;
      const usersAttempted = new Set(evalAttempts.map(a => a.user_id)).size;
      const adherence = profiles.length > 0 ? Math.round((passedEval / profiles.length) * 100) : 0;
      
      return {
        id: e.id,
        title: e.title,
        trainingTitle: training?.title || "Sin capacitación",
        passed: passedEval,
        failed: failedEval,
        inProgress: evalAttempts.filter(a => a.status === "in_progress").length,
        notStarted: profiles.length - usersAttempted,
        adherence,
        totalUsers: profiles.length,
      };
    });

  // Adherencia general (basada en evaluaciones filtradas)
  const totalEvaluations = evaluationAdherence.length;
  const totalExpectedCompletions = profiles.length * totalEvaluations;
  const totalPassed = evaluationAdherence.reduce((sum, e) => sum + e.passed, 0);
  const adherencePercentage = totalExpectedCompletions > 0 
    ? Math.round((totalPassed / totalExpectedCompletions) * 100) 
    : 0;

  // User ranking
  const userRanking = profiles.map(p => {
    const userAttempts = attempts.filter(a => a.user_id === p.id && evaluationIdsForTraining.includes(a.evaluation_id));
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

  const topUsers = userRanking.filter(u => u.total > 0).slice(0, 5);
  const lowUsers = userRanking.filter(u => u.total > 0 && u.percentage < 50).slice(0, 5);

  // Chart data
  const statusPieData = [
    { name: "Aprobados", value: approvedCount, color: COLORS.approved },
    { name: "No Aprobados", value: failedCount, color: COLORS.failed },
    { name: "En Curso", value: pendingCount, color: COLORS.pending },
    { name: "Sin Iniciar", value: notStartedCount, color: COLORS.notStarted },
  ].filter(d => d.value > 0);

  const progressByTraining = filteredTrainingsByArea
    .filter(t => selectedTraining === "all" || t.id === selectedTraining)
    .slice(0, 6)
    .map(t => {
      const trainingProgress = userProgress.filter(p => p.training_id === t.id);
      const avgProgress = trainingProgress.length > 0
        ? Math.round(trainingProgress.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / trainingProgress.length)
        : 0;
      return {
        name: t.title.length > 15 ? t.title.substring(0, 15) + "..." : t.title,
        fullName: t.title,
        progreso: avgProgress,
      };
    });

  // Cursos con baja adherencia
  const lowAdherenceCourses = filteredTrainingsByArea
    .filter(t => t.requires_evaluation)
    .map(t => {
      const completed = userProgress.filter(p => p.training_id === t.id && p.status === "completed").length;
      const percentage = profiles.length > 0 ? Math.round((completed / profiles.length) * 100) : 0;
      return { id: t.id, title: t.title, percentage, completed, total: profiles.length };
    })
    .filter(t => t.percentage < 70)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 4);

  // Export to XLSX - only completed evaluations
  const exportToXLSX = () => {
    const completedForExport = filteredAttempts.filter(a => a.status === 'completed');
    
    if (completedForExport.length === 0) {
      toast({ 
        title: "Sin datos", 
        description: "No hay evaluaciones finalizadas para exportar.", 
        variant: "destructive" 
      });
      return;
    }

    const exportData = completedForExport.map(attempt => {
      const evaluation = evaluations.find(e => e.id === attempt.evaluation_id);
      const training = evaluation ? trainings.find(t => t.id === evaluation.training_id) : null;
      const profile = profiles.find(p => p.id === attempt.user_id);
      const area = areas.find(a => a.id === training?.area_id);
      
      const userAttempts = attempts.filter(a => 
        a.user_id === attempt.user_id && a.evaluation_id === attempt.evaluation_id
      );
      const attemptNumber = userAttempts.indexOf(attempt) + 1;
      
      const percentage = attempt.score !== null && attempt.max_score > 0
        ? Math.round((attempt.score / attempt.max_score) * 100)
        : null;
      
      return {
        'Usuario': profile?.full_name || 'N/A',
        'Área': profile?.area || 'N/A',
        'Capacitación': training?.title || 'N/A',
        'Evaluación': evaluation?.title || 'N/A',
        'Puntos': attempt.score !== null ? Math.round(attempt.score) : 'N/A',
        'Puntos Máx': attempt.max_score,
        'Porcentaje': percentage !== null ? `${percentage}%` : 'N/A',
        'Mínimo Aprobación': evaluation?.passing_score ? `${evaluation.passing_score}%` : 'N/A',
        'Resultado': attempt.passed ? 'Aprobado' : 'No Aprobado',
        'Intento #': attemptNumber,
        'Fecha': attempt.completed_at ? format(new Date(attempt.completed_at), 'dd/MM/yyyy HH:mm') : 'N/A',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Evaluaciones Finalizadas");
    
    // Auto-size columns
    const maxWidth = 40;
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.min(maxWidth, Math.max(key.length, ...exportData.map(row => String(row[key as keyof typeof row]).length)))
    }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `evaluaciones_finalizadas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: "Archivo exportado", description: `${completedForExport.length} evaluaciones finalizadas descargadas.` });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Adherencia de Evaluaciones</h1>
          <p className="text-muted-foreground text-sm">Aprobados, reprobados, intentos, % de adherencia y filtros por capacitación</p>
        </div>
        <Button onClick={exportToXLSX} variant="outline" disabled={completedAttempts.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Finalizadas
        </Button>
      </div>

      {/* Filters - simplified */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Área
              </Label>
              <Select value={selectedArea} onValueChange={(value) => {
                setSelectedArea(value);
                setSelectedTraining("all");
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  {areas.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Usuario</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Curso</Label>
              <Select value={selectedTraining} onValueChange={setSelectedTraining}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filteredTrainingsByArea.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
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
          </div>
        </CardContent>
      </Card>

      {/* Main KPI - Adherencia */}
      <Card className="bg-gradient-to-r from-[hsl(210,80%,40%)] to-[hsl(210,70%,50%)] border-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">
                {selectedArea !== "all" 
                  ? `Adherencia: ${areas.find(a => a.id === selectedArea)?.name || "Área"}`
                  : selectedTraining === "all" 
                    ? "Adherencia General de Evaluaciones" 
                    : `Adherencia: ${trainings.find(t => t.id === selectedTraining)?.title || "Capacitación"}`}
              </p>
              <p className="text-4xl font-bold text-white">{adherencePercentage}%</p>
              <p className="text-blue-200 text-xs mt-1">
                {totalPassed} de {totalExpectedCompletions} evaluaciones aprobadas
              </p>
            </div>
            <Target className="h-16 w-16 text-blue-200/50" />
          </div>
          <Progress value={adherencePercentage} className="mt-4 h-2 bg-blue-900/30" />
        </CardContent>
      </Card>

      {/* Status KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[hsl(152,55%,42%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-200" />
            <div>
              <p className="text-green-100 text-xs">Aprobados</p>
              <p className="text-2xl font-bold text-white">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0,60%,50%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-200" />
            <div>
              <p className="text-red-100 text-xs">No Aprobados</p>
              <p className="text-2xl font-bold text-white">{failedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(45,70%,48%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-200" />
            <div>
              <p className="text-yellow-100 text-xs">En Curso</p>
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,50%,55%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-200" />
            <div>
              <p className="text-blue-100 text-xs">Sin Iniciar</p>
              <p className="text-2xl font-bold text-white">{notStartedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estado de Evaluaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Progreso por Curso</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={progressByTraining} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value) => [`${value}%`, "Progreso"]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar dataKey="progreso" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Adherencia por Evaluación */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Adherencia por Evaluación
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evaluationAdherence.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Evaluación</th>
                    <th className="text-left py-2 font-medium hidden md:table-cell">Capacitación</th>
                    <th className="text-center py-2 font-medium">Aprobados</th>
                    <th className="text-center py-2 font-medium">Reprobados</th>
                    <th className="text-center py-2 font-medium hidden sm:table-cell">En Curso</th>
                    <th className="text-center py-2 font-medium hidden sm:table-cell">Sin Iniciar</th>
                    <th className="text-center py-2 font-medium">Adherencia</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluationAdherence.slice(0, 10).map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{e.title}</td>
                      <td className="py-2 text-muted-foreground hidden md:table-cell">{e.trainingTitle}</td>
                      <td className="py-2 text-center">
                        <Badge variant="default" className="bg-green-600">{e.passed}</Badge>
                      </td>
                      <td className="py-2 text-center">
                        <Badge variant="destructive">{e.failed}</Badge>
                      </td>
                      <td className="py-2 text-center hidden sm:table-cell">
                        <Badge variant="secondary">{e.inProgress}</Badge>
                      </td>
                      <td className="py-2 text-center hidden sm:table-cell">
                        <Badge variant="outline">{e.notStarted}</Badge>
                      </td>
                      <td className="py-2 text-center">
                        <span className={`font-bold ${e.adherence >= 70 ? "text-green-600" : e.adherence >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                          {e.adherence}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No hay evaluaciones disponibles</p>
          )}
        </CardContent>
      </Card>

      {/* Rankings and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Mejor Desempeño
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUsers.length > 0 ? (
              <div className="space-y-3">
                {topUsers.map((u, idx) => (
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.passed}/{u.total} aprobadas</p>
                    </div>
                    <span className="text-lg font-bold text-green-600">{u.percentage}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4 text-sm">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Low Performance Users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Requieren Atención
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowUsers.length > 0 ? (
              <div className="space-y-3">
                {lowUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.passed}/{u.total} aprobadas</p>
                    </div>
                    <span className="text-lg font-bold text-red-600">{u.percentage}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4 text-sm">Todos los usuarios tienen buen desempeño</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Adherence Courses */}
      {lowAdherenceCourses.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Cursos con Baja Adherencia (&lt;70%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {lowAdherenceCourses.map(c => (
                <div key={c.id} className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{c.completed}/{c.total}</span>
                    <span className="text-lg font-bold text-yellow-600">{c.percentage}%</span>
                  </div>
                  <Progress value={c.percentage} className="mt-2 h-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdherenceEvaluations;

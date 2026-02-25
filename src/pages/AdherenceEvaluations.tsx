import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  Target, 
  Filter,
  Download,
  HelpCircle
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
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

interface Training {
  id: string;
  title: string;
  requires_evaluation: boolean | null;
  area_id: string;
  target_user_count: number | null;
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
};

// Componente de tarjeta KPI con tooltip
const KPICard = ({ 
  icon: Icon, 
  label, 
  value, 
  tooltip, 
  bgColor, 
  iconColor, 
  textColor 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  tooltip: string;
  bgColor: string;
  iconColor: string;
  textColor: string;
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className={`${bgColor} border-none cursor-help transition-transform hover:scale-[1.02]`}>
          <CardContent className="p-4 flex items-center gap-3">
            <Icon className={`h-8 w-8 ${iconColor}`} />
            <div>
              <p className={`${textColor} text-xs flex items-center gap-1`}>
                {label}
                <HelpCircle className="h-3 w-3 opacity-60" />
              </p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[250px] text-sm">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const AdherenceEvaluations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [attempts, setAttempts] = useState<EvaluationAttempt[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

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

  // Realtime subscription: refresh data when evaluation_attempts change
  useEffect(() => {
    const channel = supabase
      .channel('adherence-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evaluation_attempts',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [attemptsRes, evaluationsRes, trainingsRes, profilesRes, areasRes] = await Promise.all([
        supabase.from("evaluation_attempts").select("*"),
        supabase.from("evaluations").select("id, training_id, title, passing_score"),
        supabase.from("trainings").select("id, title, requires_evaluation, area_id, target_user_count"),
        supabase.from("profiles").select("id, full_name, area"),
        supabase.from("areas").select("id, name").order("name"),
      ]);

      setAttempts(attemptsRes.data || []);
      setEvaluations(evaluationsRes.data || []);
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

  // Filter profiles by selected area
  const filteredProfiles = selectedArea === "all"
    ? profiles
    : profiles.filter(p => {
        // Map area filter to profile area values
        const areaObj = areas.find(a => a.id === selectedArea);
        if (!areaObj) return true;
        return p.area !== null;
      });

  // Get evaluation IDs for selected training and area
  const evaluationIdsForTraining = selectedTraining === "all" 
    ? evaluations.filter(e => selectedArea === "all" || trainingIdsInArea.includes(e.training_id)).map(e => e.id)
    : evaluations.filter(e => e.training_id === selectedTraining).map(e => e.id);

  // Get the relevant trainings for the current filter to find target_user_count
  const relevantTrainingIds = selectedTraining === "all"
    ? trainingIdsInArea
    : [selectedTraining];

  // Apply filters
  const filteredAttempts = attempts.filter(a => {
    const attemptDate = new Date(a.started_at);
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59);

    if (!evaluationIdsForTraining.includes(a.evaluation_id)) return false;
    if (attemptDate < fromDate || attemptDate > toDate) return false;
    return true;
  });

  // KPIs
  const completedAttempts = filteredAttempts.filter(a => a.status === "completed");
  const approvedCount = completedAttempts.filter(a => a.passed).length;
  const failedCount = completedAttempts.filter(a => !a.passed).length;
  const pendingCount = filteredAttempts.filter(a => a.status === "in_progress").length;
  
  // Get unique users who have attempts
  const usersWithAttempts = new Set(filteredAttempts.map(a => a.user_id));
  
  // For "Sin Iniciar": only count users who are expected to take the evaluation
  // If a specific training is selected and has target_user_count, use that
  // Otherwise count users who have registered (user_progress) but haven't attempted
  const relevantTrainingsData = trainings.filter(t => relevantTrainingIds.includes(t.id));
  const hasTargetCount = relevantTrainingsData.some(t => t.target_user_count && t.target_user_count > 0);
  
  let expectedUserCount: number;
  if (hasTargetCount && selectedTraining !== "all") {
    const targetTraining = relevantTrainingsData.find(t => t.id === selectedTraining);
    expectedUserCount = targetTraining?.target_user_count || filteredProfiles.length;
  } else {
    expectedUserCount = filteredProfiles.length;
  }
  
  const notStartedCount = Math.max(0, expectedUserCount - usersWithAttempts.size - pendingCount);

  // Adherencia general: aprobados / usuarios esperados por evaluación
  const totalEvaluations = evaluations.filter(e => 
    (selectedTraining === "all" || e.training_id === selectedTraining) && 
    (selectedArea === "all" || trainingIdsInArea.includes(e.training_id))
  ).length;
  const totalExpectedCompletions = expectedUserCount * totalEvaluations;
  const totalPassed = approvedCount;
  const adherencePercentage = totalExpectedCompletions > 0 
    ? Math.round((totalPassed / totalExpectedCompletions) * 100) 
    : 0;

  // Chart data
  const statusPieData = [
    { name: "Aprobados", value: approvedCount, color: COLORS.approved },
    { name: "No Aprobados", value: failedCount, color: COLORS.failed },
    { name: "En Curso", value: pendingCount, color: COLORS.pending },
    { name: "Sin Iniciar", value: notStartedCount, color: COLORS.notStarted },
  ].filter(d => d.value > 0);

  // Export to XLSX
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
      
      return {
        'Usuario': profile?.full_name || 'N/A',
        'Área': profile?.area || 'N/A',
        'Capacitación': training?.title || 'N/A',
        'Puntaje': attempt.score !== null ? Math.round(attempt.score) : 'N/A',
        'Estado': attempt.passed ? 'Aprobado' : 'No Aprobado',
        'Fecha': attempt.completed_at ? format(new Date(attempt.completed_at), 'dd/MM/yyyy HH:mm') : 'N/A',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Evaluaciones");
    
    const maxWidth = 40;
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.min(maxWidth, Math.max(key.length, ...exportData.map(row => String(row[key as keyof typeof row]).length)))
    }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `evaluaciones_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: "Exportado", description: `${completedForExport.length} registros descargados.` });
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
          <p className="text-muted-foreground text-sm">Resumen del estado de las evaluaciones</p>
        </div>
        <Button onClick={exportToXLSX} variant="outline" size="sm" disabled={completedAttempts.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Filters - simplified */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Label className="text-xs">Capacitación</Label>
              <Select value={selectedTraining} onValueChange={setSelectedTraining}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="bg-gradient-to-r from-primary to-primary/80 border-none cursor-help">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-primary-foreground/80 text-sm flex items-center gap-2">
                      Adherencia General
                      <HelpCircle className="h-4 w-4 opacity-70" />
                    </p>
                    <p className="text-5xl font-bold text-primary-foreground">{adherencePercentage}%</p>
                    <p className="text-primary-foreground/70 text-xs mt-1">
                      {totalPassed} aprobaciones de {totalExpectedCompletions} esperadas
                    </p>
                  </div>
                  <Target className="h-16 w-16 text-primary-foreground/30" />
                </div>
                <Progress value={adherencePercentage} className="mt-4 h-2 bg-primary-foreground/20" />
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[300px]">
            <p className="font-medium mb-1">¿Qué es la Adherencia General?</p>
            <p className="text-sm text-muted-foreground">
              Porcentaje de usuarios que han aprobado las evaluaciones respecto al total esperado. 
              Se calcula como: (aprobaciones / total de usuarios × evaluaciones) × 100
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Status KPIs with tooltips */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={CheckCircle}
          label="Aprobados"
          value={approvedCount}
          tooltip="Número de usuarios que completaron y aprobaron la evaluación con el puntaje mínimo requerido."
          bgColor="bg-[hsl(152,55%,42%)]"
          iconColor="text-green-200"
          textColor="text-green-100"
        />
        <KPICard
          icon={XCircle}
          label="No Aprobados"
          value={failedCount}
          tooltip="Usuarios que completaron la evaluación pero no alcanzaron el puntaje mínimo de aprobación."
          bgColor="bg-[hsl(0,60%,50%)]"
          iconColor="text-red-200"
          textColor="text-red-100"
        />
        <KPICard
          icon={Clock}
          label="En Curso"
          value={pendingCount}
          tooltip="Evaluaciones iniciadas que aún no han sido finalizadas por los usuarios."
          bgColor="bg-[hsl(45,70%,48%)]"
          iconColor="text-yellow-200"
          textColor="text-yellow-100"
        />
        <KPICard
          icon={Users}
          label="Sin Iniciar"
          value={notStartedCount}
          tooltip="Usuarios que aún no han comenzado ninguna evaluación en el período seleccionado."
          bgColor="bg-[hsl(210,50%,55%)]"
          iconColor="text-blue-200"
          textColor="text-blue-100"
        />
      </div>

      {/* Chart - simplified to just one */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Distribución de Estados
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: "13px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-12">No hay datos para mostrar</p>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px]">
            <p className="font-medium mb-1">Distribución de Estados</p>
            <p className="text-sm text-muted-foreground">
              Gráfico que muestra la proporción de evaluaciones según su estado actual: aprobadas, no aprobadas, en curso y sin iniciar.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default AdherenceEvaluations;

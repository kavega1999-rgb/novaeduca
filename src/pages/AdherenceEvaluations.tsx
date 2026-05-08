import { useEffect, useState, useMemo } from "react";
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
  HelpCircle,
  ChevronDown
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
import { downloadXlsx } from "@/lib/xlsx-utils";
import UserDetailPanel, { type PanelType } from "@/components/adherence/UserDetailPanel";

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

// Componente de tarjeta KPI clickable
const KPICard = ({ 
  icon: Icon, 
  label, 
  value, 
  tooltip, 
  bgColor, 
  iconColor, 
  textColor,
  isActive,
  onClick,
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  tooltip: string;
  bgColor: string;
  iconColor: string;
  textColor: string;
  isActive?: boolean;
  onClick?: () => void;
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Card 
          className={`${bgColor} border-none cursor-pointer transition-all hover:scale-[1.02] ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-[1.03]' : ''}`}
          onClick={onClick}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Icon className={`h-8 w-8 ${iconColor}`} />
            <div className="flex-1">
              <p className={`${textColor} text-xs flex items-center gap-1`}>
                {label}
                <HelpCircle className="h-3 w-3 opacity-60" />
              </p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
            <ChevronDown className={`h-4 w-4 text-white/60 transition-transform ${isActive ? 'rotate-180' : ''}`} />
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
  const [userProgress, setUserProgress] = useState<{ user_id: string; training_id: string; status: string }[]>([]);
  const [assignments, setAssignments] = useState<{ training_id: string; user_id: string }[]>([]);
  const [targetAreas, setTargetAreas] = useState<{ training_id: string; target_area: string }[]>([]);

  const [selectedTraining, setSelectedTraining] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [viewMode, setViewMode] = useState<"assigned" | "general">("assigned");

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
      const [attemptsRes, evaluationsRes, trainingsRes, profilesRes, areasRes, progressRes, assignmentsRes, targetAreasRes] = await Promise.all([
        supabase.from("evaluation_attempts").select("*"),
        supabase.from("evaluations").select("id, training_id, title, passing_score"),
        supabase.from("trainings").select("id, title, requires_evaluation, area_id, target_user_count, visible_to_all"),
        supabase.from("profiles").select("id, full_name, area"),
        supabase.from("areas").select("id, name").order("name"),
        supabase.from("user_progress").select("user_id, training_id, status"),
        supabase.from("training_assignments").select("training_id, user_id"),
        supabase.from("training_target_areas").select("training_id, target_area"),
      ]);

      setAttempts(attemptsRes.data || []);
      setEvaluations(evaluationsRes.data || []);
      setTrainings((trainingsRes.data || []) as any);
      setProfiles(profilesRes.data || []);
      setAreas(areasRes.data || []);
      setUserProgress(progressRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setTargetAreas(targetAreasRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTrainingsByArea = selectedArea === "all"
    ? trainings
    : trainings.filter(t => t.area_id === selectedArea);

  const trainingIdsInArea = filteredTrainingsByArea.map(t => t.id);

  const filteredProfiles = useMemo(() => {
    let filtered = selectedArea === "all"
      ? profiles
      : profiles.filter(p => p.area !== null);

    if (viewMode === "assigned") {
      filtered = filtered.filter(p => {
        const relevantTrainings = selectedTraining === "all" 
          ? trainings.filter(t => selectedArea === "all" || t.area_id === selectedArea)
          : trainings.filter(t => t.id === selectedTraining);
        
        return relevantTrainings.some(t => {
          if ((t as any).visible_to_all) return true;
          const isAssigned = assignments.some(a => a.training_id === t.id && a.user_id === p.id);
          if (isAssigned) return true;
          const trainingTargets = targetAreas.filter(ta => ta.training_id === t.id).map(ta => ta.target_area);
          if (p.area && trainingTargets.includes(p.area)) return true;
          return false;
        });
      });
    }

    return filtered;
  }, [profiles, selectedArea, viewMode, selectedTraining, trainings, assignments, targetAreas]);

  const evaluationIdsForTraining = selectedTraining === "all" 
    ? evaluations.filter(e => selectedArea === "all" || trainingIdsInArea.includes(e.training_id)).map(e => e.id)
    : evaluations.filter(e => e.training_id === selectedTraining).map(e => e.id);

  const relevantTrainingIds = selectedTraining === "all"
    ? trainingIdsInArea
    : [selectedTraining];

  const filteredAttempts = attempts.filter(a => {
    const attemptDate = new Date(a.completed_at || a.started_at);

    if (!evaluationIdsForTraining.includes(a.evaluation_id)) return false;
    if (dateFrom && attemptDate < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo && attemptDate > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const latestAttempts = useMemo(() => {
    const latestByUserTraining = new Map<string, EvaluationAttempt>();

    filteredAttempts.forEach(attempt => {
      const evaluation = evaluations.find(e => e.id === attempt.evaluation_id);
      if (!evaluation) return;

      const key = `${attempt.user_id}:${evaluation.training_id}`;
      const existing = latestByUserTraining.get(key);
      const attemptTime = new Date(attempt.completed_at || attempt.started_at).getTime();
      const existingTime = existing ? new Date(existing.completed_at || existing.started_at).getTime() : 0;

      if (!existing || attemptTime > existingTime) {
        latestByUserTraining.set(key, attempt);
      }
    });

    return Array.from(latestByUserTraining.values());
  }, [filteredAttempts, evaluations]);

  const completedAttempts = latestAttempts.filter(a => a.status === "completed");
  const approvedCount = completedAttempts.filter(a => a.passed).length;
  const failedCount = completedAttempts.filter(a => !a.passed).length;
  const evalInProgressUserIds = new Set(
    latestAttempts.filter(a => a.status === "in_progress").map(a => a.user_id)
  );
  
  const trainingInProgressUserIds = useMemo(() => {
    const relevantProgress = userProgress.filter(up => {
      if (selectedTraining !== "all") {
        return up.training_id === selectedTraining && up.status === "in_progress";
      }
      return relevantTrainingIds.includes(up.training_id) && up.status === "in_progress";
    });
    const usersWithEvalAttempts = new Set(latestAttempts.map(a => a.user_id));
    return new Set(
      relevantProgress
        .filter(up => !usersWithEvalAttempts.has(up.user_id))
        .map(up => up.user_id)
    );
  }, [userProgress, selectedTraining, relevantTrainingIds, latestAttempts]);

  const pendingCount = evalInProgressUserIds.size + trainingInProgressUserIds.size;
  
  const usersWithAttempts = new Set(latestAttempts.map(a => a.user_id));
  const allActiveUserIds = new Set([...usersWithAttempts, ...trainingInProgressUserIds]);
  
  const relevantTrainingsData = trainings.filter(t => relevantTrainingIds.includes(t.id));
  const hasTargetCount = relevantTrainingsData.some(t => t.target_user_count && t.target_user_count > 0);
  
  let expectedUserCount: number;
  if (hasTargetCount && selectedTraining !== "all") {
    const targetTraining = relevantTrainingsData.find(t => t.id === selectedTraining);
    expectedUserCount = targetTraining?.target_user_count || filteredProfiles.length;
  } else {
    expectedUserCount = filteredProfiles.length;
  }
  
  const notStartedCount = Math.max(0, expectedUserCount - allActiveUserIds.size);

  const notStartedUserIds = useMemo(() => {
    const allUserIds = filteredProfiles.map(p => p.id);
    return allUserIds.filter(id => !allActiveUserIds.has(id));
  }, [filteredProfiles, allActiveUserIds]);
  
  const inProgressUserIds = useMemo(() => {
    return [...trainingInProgressUserIds];
  }, [trainingInProgressUserIds]);

  const togglePanel = (panel: PanelType) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const totalEvaluations = evaluations.filter(e => 
    (selectedTraining === "all" || e.training_id === selectedTraining) && 
    (selectedArea === "all" || trainingIdsInArea.includes(e.training_id))
  ).length;
  const totalExpectedCompletions = selectedTraining === "all"
    ? expectedUserCount * Math.max(1, totalEvaluations)
    : expectedUserCount;
  const totalPassed = approvedCount;
  const adherencePercentage = totalExpectedCompletions > 0 
    ? Math.min(100, Math.round((totalPassed / totalExpectedCompletions) * 100)) 
    : 0;

  const statusPieData = [
    { name: "Aprobados", value: approvedCount, color: COLORS.approved },
    { name: "No Aprobados", value: failedCount, color: COLORS.failed },
    { name: "En Proceso", value: pendingCount, color: COLORS.pending },
    { name: "Sin Iniciar", value: notStartedCount, color: COLORS.notStarted },
  ].filter(d => d.value > 0);

  const exportToXLSX = () => {
    const completedForExport = latestAttempts.filter(a => a.status === 'completed');
    
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

    downloadXlsx(workbook, `evaluaciones_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Vista</Label>
              <Select value={viewMode} onValueChange={(v: "assigned" | "general") => setViewMode(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">Solo asignados</SelectItem>
                  <SelectItem value="general">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Área</Label>
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Capacitación</Label>
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Desde</Label>
              <Input type="date" className="h-9" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Hasta</Label>
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

      {/* Status KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={CheckCircle}
          label="Aprobados"
          value={approvedCount}
          tooltip="Haz clic para ver la lista de usuarios aprobados."
          bgColor="bg-[hsl(152,55%,42%)]"
          iconColor="text-green-200"
          textColor="text-green-100"
          isActive={activePanel === "approved"}
          onClick={() => togglePanel("approved")}
        />
        <KPICard
          icon={XCircle}
          label="No Aprobados"
          value={failedCount}
          tooltip="Haz clic para ver usuarios reprobados y habilitar reevaluación."
          bgColor="bg-[hsl(0,60%,50%)]"
          iconColor="text-red-200"
          textColor="text-red-100"
          isActive={activePanel === "failed"}
          onClick={() => togglePanel("failed")}
        />
        <KPICard
          icon={Clock}
          label="En Proceso"
          value={pendingCount}
          tooltip="Usuarios con la capacitación o evaluación en proceso."
          bgColor="bg-[hsl(45,70%,48%)]"
          iconColor="text-yellow-200"
          textColor="text-yellow-100"
          isActive={activePanel === "inProgress"}
          onClick={() => togglePanel("inProgress")}
        />
        <KPICard
          icon={Users}
          label="Sin Iniciar"
          value={notStartedCount}
          tooltip="Haz clic para ver usuarios que no han iniciado la evaluación."
          bgColor="bg-[hsl(210,50%,55%)]"
          iconColor="text-blue-200"
          textColor="text-blue-100"
          isActive={activePanel === "notStarted"}
          onClick={() => togglePanel("notStarted")}
        />
      </div>

      {/* Expandable user detail panel */}
      {activePanel && (
        <UserDetailPanel
          panelType={activePanel}
          onClose={() => setActivePanel(null)}
          filteredAttempts={filteredAttempts}
          evaluations={evaluations}
          trainings={trainings}
          profiles={profiles}
          notStartedUserIds={notStartedUserIds}
          inProgressUserIds={inProgressUserIds}
          onDataRefresh={fetchData}
        />
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Distribución de Estados</CardTitle>
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
    </div>
  );
};

export default AdherenceEvaluations;

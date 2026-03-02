import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  X,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";

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

export type PanelType = "approved" | "failed" | "inProgress" | "notStarted" | null;

interface UserDetailPanelProps {
  panelType: PanelType;
  onClose: () => void;
  filteredAttempts: EvaluationAttempt[];
  evaluations: Evaluation[];
  trainings: Training[];
  profiles: Profile[];
  notStartedUserIds: string[];
  onDataRefresh: () => void;
}

const panelConfig = {
  approved: {
    title: "Usuarios Aprobados",
    icon: CheckCircle,
    iconColor: "text-green-600",
    badgeVariant: "default" as const,
    badgeClass: "bg-green-600",
  },
  failed: {
    title: "Usuarios No Aprobados",
    icon: XCircle,
    iconColor: "text-destructive",
    badgeVariant: "destructive" as const,
    badgeClass: "",
  },
  inProgress: {
    title: "Evaluaciones En Curso",
    icon: Clock,
    iconColor: "text-yellow-600",
    badgeVariant: "secondary" as const,
    badgeClass: "bg-yellow-500 text-white",
  },
  notStarted: {
    title: "Usuarios Sin Iniciar",
    icon: Users,
    iconColor: "text-blue-500",
    badgeVariant: "secondary" as const,
    badgeClass: "bg-blue-400 text-white",
  },
};

const UserDetailPanel = ({
  panelType,
  onClose,
  filteredAttempts,
  evaluations,
  trainings,
  profiles,
  notStartedUserIds,
  onDataRefresh,
}: UserDetailPanelProps) => {
  const { toast } = useToast();
  const [reevalDialogOpen, setReevalDialogOpen] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<EvaluationAttempt | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  if (!panelType) return null;

  const config = panelConfig[panelType];
  const Icon = config.icon;

  const getUsers = () => {
    switch (panelType) {
      case "approved":
        return filteredAttempts
          .filter(a => a.status === "completed" && a.passed)
          .sort((a, b) => new Date(b.completed_at || b.started_at).getTime() - new Date(a.completed_at || a.started_at).getTime());
      case "failed":
        return filteredAttempts
          .filter(a => a.status === "completed" && !a.passed)
          .sort((a, b) => new Date(b.completed_at || b.started_at).getTime() - new Date(a.completed_at || a.started_at).getTime());
      case "inProgress":
        return filteredAttempts
          .filter(a => a.status === "in_progress")
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
      default:
        return [];
    }
  };

  const handleReeval = (attempt: EvaluationAttempt) => {
    setSelectedAttempt(attempt);
    setReevalDialogOpen(true);
  };

  const confirmReeval = async () => {
    if (!selectedAttempt) return;
    setIsResetting(true);
    try {
      // Delete the failed attempt's answers first, then the attempt itself
      await supabase
        .from("evaluation_answers")
        .delete()
        .eq("attempt_id", selectedAttempt.id);

      await supabase
        .from("evaluation_attempts")
        .delete()
        .eq("id", selectedAttempt.id);

      toast({
        title: "Reevaluación habilitada",
        description: "El usuario podrá volver a presentar la evaluación.",
      });
      onDataRefresh();
    } catch (error) {
      console.error("Error resetting attempt:", error);
      toast({
        title: "Error",
        description: "No se pudo habilitar la reevaluación.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
      setReevalDialogOpen(false);
      setSelectedAttempt(null);
    }
  };

  const attempts = getUsers();
  const selectedProfile = selectedAttempt
    ? profiles.find(p => p.id === selectedAttempt.user_id)
    : null;

  return (
    <>
      <Card className="animate-in slide-in-from-top-2 duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.iconColor}`} />
              {config.title}
              <Badge variant={config.badgeVariant} className={config.badgeClass}>
                {panelType === "notStarted" ? notStartedUserIds.length : attempts.length}
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {panelType === "notStarted" ? (
            notStartedUserIds.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Usuario</th>
                      <th className="pb-2 font-medium text-muted-foreground">Área</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notStartedUserIds.map(userId => {
                      const profile = profiles.find(p => p.id === userId);
                      return (
                        <tr key={userId} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2 font-medium">{profile?.full_name || "N/A"}</td>
                          <td className="py-2 text-muted-foreground">{profile?.area || "N/A"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6">Todos los usuarios han iniciado 🎉</p>
            )
          ) : attempts.length > 0 ? (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Usuario</th>
                    <th className="pb-2 font-medium text-muted-foreground">Área</th>
                    <th className="pb-2 font-medium text-muted-foreground">Capacitación</th>
                    <th className="pb-2 font-medium text-muted-foreground text-center">Puntaje</th>
                    <th className="pb-2 font-medium text-muted-foreground">Fecha</th>
                    {panelType === "failed" && (
                      <th className="pb-2 font-medium text-muted-foreground text-center">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map(attempt => {
                    const evaluation = evaluations.find(e => e.id === attempt.evaluation_id);
                    const training = evaluation ? trainings.find(t => t.id === evaluation.training_id) : null;
                    const profile = profiles.find(p => p.id === attempt.user_id);
                    return (
                      <tr key={attempt.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 font-medium">{profile?.full_name || "N/A"}</td>
                        <td className="py-2 text-muted-foreground">{profile?.area || "N/A"}</td>
                        <td className="py-2">{training?.title || "N/A"}</td>
                        <td className="py-2 text-center">
                          {attempt.score !== null ? (
                            <span className={panelType === "approved" ? "text-green-600 font-semibold" : panelType === "failed" ? "text-destructive font-semibold" : ""}>
                              {Math.round(attempt.score)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {attempt.completed_at
                            ? format(new Date(attempt.completed_at), "dd/MM/yyyy")
                            : format(new Date(attempt.started_at), "dd/MM/yyyy")}
                        </td>
                        {panelType === "failed" && (
                          <td className="py-2 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleReeval(attempt)}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reevaluar
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">No hay registros en esta categoría</p>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog for re-evaluation */}
      <Dialog open={reevalDialogOpen} onOpenChange={setReevalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Reevaluación</DialogTitle>
            <DialogDescription>
              ¿Deseas permitir que <strong>{selectedProfile?.full_name}</strong> vuelva a presentar la evaluación?
              Se eliminará su intento reprobado y podrá iniciar uno nuevo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReevalDialogOpen(false)} disabled={isResetting}>
              Cancelar
            </Button>
            <Button onClick={confirmReeval} disabled={isResetting}>
              {isResetting ? "Procesando..." : "Confirmar Reevaluación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserDetailPanel;

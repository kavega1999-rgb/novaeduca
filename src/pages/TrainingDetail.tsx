import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import FloatingDocumentsButton from "@/components/documents/FloatingDocumentsButton";
import FloatingCSAT from "@/components/FloatingCSAT";
import EvaluationTaker from "@/components/evaluations/EvaluationTaker";
import EvaluationManager from "@/components/evaluations/EvaluationManager";
import PretestTaker from "@/components/evaluations/PretestTaker";
import PagedContentViewer from "@/components/PagedContentViewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Clock, Award, CheckCircle, PlayCircle, Download, AlertCircle, ClipboardCheck, Lock, Eye, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { getCertificateSignedUrl } from "@/lib/storage-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { downloadXlsx } from "@/lib/xlsx-utils";

const TrainingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [training, setTraining] = useState<any>(null);
  const [userProgress, setUserProgress] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [evaluation, setEvaluation] = useState<any>(null);
  const [isAdminOrLeader, setIsAdminOrLeader] = useState(false);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showPretest, setShowPretest] = useState(false);
  const [pretestCompleted, setPretestCompleted] = useState(false);
  const [evaluationPassed, setEvaluationPassed] = useState(false);
  const [isAssigned, setIsAssigned] = useState(false);
  const [checkingAssignment, setCheckingAssignment] = useState(true);

  // Admin: evaluation answers viewing
  const [evalAnswers, setEvalAnswers] = useState<any[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const loadTraining = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserId(session.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, area")
      .eq("id", session.user.id)
      .single();

    let adminOrLeader = false;
    if (profile) {
      setUserRole(profile.role);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .in("role", ["admin", "leader"]);
      adminOrLeader = (roles || []).length > 0;
      setIsAdminOrLeader(adminOrLeader);
    }

    // Fetch training details
    const { data: trainingData, error: trainingError } = await supabase
      .from("trainings")
      .select(`
        *,
        areas (
          name,
          color,
          icon
        )
      `)
      .eq("id", id)
      .single();

    if (trainingError || !trainingData) {
      toast.error("No se pudo cargar la capacitación");
      navigate("/trainings");
      return;
    }

    setTraining(trainingData);

    // Check if user is assigned to this training
    const userAssigned = await checkUserAssignment(session.user.id, id!, trainingData, profile?.area, adminOrLeader);
    setIsAssigned(userAssigned);
    setCheckingAssignment(false);

    // Fetch evaluation
    const { data: evalData } = await supabase
      .from("evaluations")
      .select("*")
      .eq("training_id", id)
      .maybeSingle();

    if (evalData) {
      setEvaluation(evalData);
      
      const { data: passedAttempt } = await supabase
        .from("evaluation_attempts")
        .select("id, passed")
        .eq("evaluation_id", evalData.id)
        .eq("user_id", session.user.id)
        .eq("passed", true)
        .limit(1)
        .maybeSingle();
      
      setEvaluationPassed(!!passedAttempt);
    }

    // Only create progress if user is assigned
    if (userAssigned) {
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("training_id", id)
        .single();

      if (progressData) {
        setUserProgress(progressData);
        setPretestCompleted(progressData.pretest_completed || false);
      } else {
        const { data: newProgress } = await supabase
          .from("user_progress")
          .insert({
            user_id: session.user.id,
            training_id: id,
            status: "in_progress",
            progress_percentage: 0,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (newProgress) {
          setUserProgress(newProgress);
          setPretestCompleted(false);
        }
      }
    }

    // Fetch certificates
    const { data: certsData } = await supabase
      .from("certificates")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("training_id", id)
      .order("issued_at", { ascending: false });

    if (certsData) {
      setCertificates(certsData);
    }

    setLoading(false);
  };

  const checkUserAssignment = async (
    currentUserId: string, 
    trainingId: string, 
    trainingData: any,
    userArea: string | null,
    adminOrLeader: boolean
  ): Promise<boolean> => {
    // If visible_to_all, everyone is assigned
    if (trainingData.visible_to_all) return true;

    // Check direct assignment
    const { data: directAssignment } = await supabase
      .from("training_assignments")
      .select("id")
      .eq("training_id", trainingId)
      .eq("user_id", currentUserId)
      .limit(1)
      .maybeSingle();

    if (directAssignment) return true;

    // Check area targeting
    if (userArea) {
      const { data: targetAreas } = await supabase
        .from("training_target_areas")
        .select("target_area")
        .eq("training_id", trainingId);

      if (targetAreas?.some(ta => ta.target_area === userArea)) return true;
    }

    return false;
  };

  useEffect(() => {
    loadTraining();
  }, [id, navigate]);

  const updateProgress = async (percentage: number) => {
    if (!userProgress || !userId) return;

    const { error } = await supabase
      .from("user_progress")
      .update({
        progress_percentage: percentage,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", userProgress.id);

    if (!error) {
      setUserProgress({ ...userProgress, progress_percentage: percentage });
      toast.success(`Progreso actualizado: ${percentage}%`);
    }
  };

  const completeTraining = async () => {
    if (!userProgress || !userId) return;

    const { error } = await supabase
      .from("user_progress")
      .update({
        status: "completed",
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", userProgress.id);

    if (!error) {
      setUserProgress({
        ...userProgress,
        status: "completed",
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
      });
      toast.success("¡Capacitación completada exitosamente!");
    }
  };

  const finishTraining = async () => {
    if (!training || !isAdminOrLeader) return;

    const { error } = await supabase
      .from("trainings")
      .update({
        is_finished: true,
        finished_at: new Date().toISOString(),
        finished_by: userId,
      })
      .eq("id", training.id);

    if (error) {
      toast.error("Error al finalizar la capacitación");
      return;
    }

    setTraining({
      ...training,
      is_finished: true,
      finished_at: new Date().toISOString(),
    });
    toast.success("Capacitación marcada como finalizada. Las evaluaciones están bloqueadas.");
  };

  // Load evaluation answers for admin/leader view
  const loadEvalAnswers = async () => {
    if (!evaluation || !isAdminOrLeader) return;
    setLoadingAnswers(true);

    const { data: attempts } = await supabase
      .from("evaluation_attempts")
      .select("id, user_id, score, max_score, passed, completed_at, status")
      .eq("evaluation_id", evaluation.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    if (!attempts || attempts.length === 0) {
      setEvalAnswers([]);
      setLoadingAnswers(false);
      setShowAnswers(true);
      return;
    }

    // Get profiles for these users
    const userIds = [...new Set(attempts.map(a => a.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, area")
      .in("id", userIds);

    // Get answers for all attempts
    const attemptIds = attempts.map(a => a.id);
    const { data: answers } = await supabase
      .from("evaluation_answers")
      .select("attempt_id, question_id, is_correct, points_earned, text_response, ai_feedback, selected_option_id")
      .in("attempt_id", attemptIds);

    // Get questions
    const { data: questions } = await supabase
      .from("evaluation_questions")
      .select("id, question_text, question_type, points, order_index")
      .eq("evaluation_id", evaluation.id)
      .order("order_index");

    // Get options
    const questionIds = (questions || []).map(q => q.id);
    const { data: options } = await supabase
      .from("evaluation_question_options")
      .select("id, question_id, option_text, is_correct")
      .in("question_id", questionIds);

    const enriched = attempts.map(attempt => {
      const profile = profiles?.find(p => p.id === attempt.user_id);
      const attemptAnswers = (answers || []).filter(a => a.attempt_id === attempt.id);
      
      return {
        ...attempt,
        user_name: profile?.full_name || 'Usuario',
        user_area: profile?.area || 'N/A',
        answers: attemptAnswers.map(ans => {
          const question = questions?.find(q => q.id === ans.question_id);
          const selectedOption = options?.find(o => o.id === ans.selected_option_id);
          const correctOption = options?.filter(o => o.question_id === ans.question_id && o.is_correct);
          return {
            ...ans,
            question_text: question?.question_text || '',
            question_type: question?.question_type || '',
            selected_option_text: selectedOption?.option_text || ans.text_response || '',
            correct_option_text: correctOption?.map(o => o.option_text).join(', ') || '',
          };
        }),
      };
    });

    setEvalAnswers(enriched);
    setLoadingAnswers(false);
    setShowAnswers(true);
  };

  const exportAnswersXLSX = () => {
    if (evalAnswers.length === 0) return;

    const rows: any[] = [];
    evalAnswers.forEach(attempt => {
      attempt.answers.forEach((ans: any) => {
        rows.push({
          'Usuario': attempt.user_name,
          'Área': attempt.user_area,
          'Puntaje Total': `${attempt.score}/${attempt.max_score}`,
          'Aprobado': attempt.passed ? 'Sí' : 'No',
          'Fecha': attempt.completed_at ? format(new Date(attempt.completed_at), 'dd/MM/yyyy HH:mm') : '',
          'Pregunta': ans.question_text,
          'Tipo': ans.question_type,
          'Respuesta': ans.selected_option_text,
          'Respuesta Correcta': ans.correct_option_text,
          'Correcto': ans.is_correct ? 'Sí' : 'No',
          'Puntos': ans.points_earned || 0,
          'Retroalimentación IA': ans.ai_feedback || '',
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Respuestas");
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.min(50, Math.max(key.length, ...rows.map(r => String(r[key]).length)))
    }));
    ws['!cols'] = colWidths;
    downloadXlsx(wb, `respuestas_${training?.title?.replace(/\s+/g, '_') || 'evaluacion'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success("Respuestas exportadas");
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      capacitacion: "Capacitación",
      curso: "Curso",
      socializacion: "Socialización",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      capacitacion: "bg-primary",
      curso: "bg-secondary",
      socializacion: "bg-accent",
    };
    return colors[type] || "bg-muted";
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation userRole={userRole} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Cargando capacitación...</div>
        </div>
      </div>
    );
  }

  if (!training) {
    return null;
  }

  const progressPercentage = userProgress?.progress_percentage || 0;
  const isCompleted = userProgress?.status === "completed";
  const needsPretest = training?.requires_pretest && evaluation && !pretestCompleted && !isCompleted;

  // If user is not assigned and not admin/leader viewing, show restricted message
  const canInteract = isAssigned;
  const canViewContent = isAssigned || isAdminOrLeader;

  return (
    <div className="min-h-screen bg-background relative">
      <Navigation userRole={userRole} />
      
      {/* Pretest Overlay */}
      {showPretest && evaluation && canInteract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <PretestTaker
              evaluationId={evaluation.id}
              trainingId={id!}
              onComplete={(score) => {
                setShowPretest(false);
                setPretestCompleted(true);
                loadTraining();
              }}
              onSkip={() => {
                setShowPretest(false);
                setPretestCompleted(true);
              }}
            />
          </div>
        </div>
      )}
      
      {/* Evaluation Overlay */}
      {showEvaluation && evaluation && canInteract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <EvaluationTaker
              evaluationId={evaluation.id}
              trainingId={id!}
              onComplete={async () => {
                setShowEvaluation(false);
                try {
                  const { data: latestAttempt } = await supabase
                    .from("evaluation_attempts")
                    .select("id")
                    .eq("evaluation_id", evaluation.id)
                    .eq("user_id", userId)
                    .eq("status", "completed")
                    .order("completed_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (latestAttempt) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.access_token) {
                      await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-adherence-report`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({
                            postestAttemptId: latestAttempt.id,
                            trainingId: id,
                          }),
                        }
                      );
                    }
                  }
                } catch (err) {
                  console.error("Error generating adherence report:", err);
                }
                loadTraining();
              }}
            />
            <Button 
              variant="ghost" 
              className="mt-4 w-full"
              onClick={() => setShowEvaluation(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancelar y volver
            </Button>
          </div>
        </div>
      )}
      
      <div className={`container mx-auto px-4 py-8 ${showEvaluation ? 'blur-sm pointer-events-none' : ''}`}>
        <Button
          variant="ghost"
          onClick={() => navigate("/trainings")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a capacitaciones
        </Button>

        {/* Not assigned warning */}
        {!checkingAssignment && !canViewContent && (
          <Alert className="mb-6 border-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No estás asignado a esta capacitación. Contacta a tu administrador para solicitar acceso.
            </AlertDescription>
          </Alert>
        )}

        {!checkingAssignment && isAdminOrLeader && !isAssigned && (
          <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              No estás asignado a esta capacitación. Puedes ver el contenido y configurarla, pero no puedes realizar evaluaciones ni registrar progreso.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge className={`${getTypeColor(training.type)} text-white`}>
                    {getTypeLabel(training.type)}
                  </Badge>
                  {training.generates_certificate && (
                    <Award className="w-5 h-5 text-secondary" />
                  )}
                </div>
                <CardTitle className="text-2xl">{training.title}</CardTitle>
                <CardDescription>{training.description}</CardDescription>
              </CardHeader>

              <CardContent>
                <Tabs defaultValue="content" className="w-full">
                  <TabsList className={`grid w-full ${isAdminOrLeader ? 'grid-cols-4' : 'grid-cols-2'}`}>
                    <TabsTrigger value="content">Contenido</TabsTrigger>
                    <TabsTrigger value="details">Detalles</TabsTrigger>
                    {isAdminOrLeader && <TabsTrigger value="evaluation-setup">Configurar Evaluación</TabsTrigger>}
                    {isAdminOrLeader && <TabsTrigger value="answers">Respuestas</TabsTrigger>}
                  </TabsList>
                  
                  <TabsContent value="content" className="space-y-4">
                    {canInteract && needsPretest && !showPretest && (
                      <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
                        <CardHeader>
                          <div className="flex items-center gap-2 text-amber-600">
                            <ClipboardCheck className="w-5 h-5" />
                            <CardTitle className="text-lg">Evaluación Diagnóstica Requerida</CardTitle>
                          </div>
                          <CardDescription>
                            Antes de acceder al contenido, realiza un pretest para medir tu conocimiento inicial.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button 
                            onClick={() => setShowPretest(true)}
                            className="w-full"
                          >
                            <ClipboardCheck className="w-4 h-4 mr-2" />
                            Iniciar Pretest
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {canViewContent && (!needsPretest || pretestCompleted || !canInteract) && training.content_url ? (
                      <PagedContentViewer
                        contentUrl={training.content_url}
                        userProgressId={canInteract ? userProgress?.id : undefined}
                        onContentViewed={canInteract ? loadTraining : undefined}
                        contentViewedCompletely={userProgress?.content_viewed_completely || false}
                        totalPages={training.total_pages || 10}
                        requiresEvaluation={training.requires_evaluation}
                      />
                    ) : canViewContent && (!needsPretest || pretestCompleted || !canInteract) ? (
                      <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <PlayCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            El contenido de esta capacitación estará disponible próximamente
                          </p>
                        </div>
                      </div>
                    ) : !canViewContent ? (
                      <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            No tienes acceso a esta capacitación
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {canInteract && (!needsPretest || pretestCompleted) && (
                      <div className="space-y-4 pt-4">
                        <div>
                          <h3 className="text-lg font-semibold mb-2">Sobre esta capacitación</h3>
                          <p className="text-muted-foreground">
                            {training.description || "Sin descripción disponible"}
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="details" className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium mb-1">Área</h4>
                        <p className="text-muted-foreground">{training.areas?.name || "N/A"}</p>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h4 className="font-medium mb-1">Duración estimada</h4>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{training.duration_minutes || 30} minutos</span>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h4 className="font-medium mb-1">Tipo</h4>
                        <p className="text-muted-foreground">{getTypeLabel(training.type)}</p>
                      </div>
                      
                      {training.requires_evaluation && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-medium mb-1">Evaluación</h4>
                            <p className="text-muted-foreground">Esta capacitación requiere evaluación</p>
                          </div>
                        </>
                      )}
                      
                      {training.generates_certificate && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-medium mb-1">Certificación</h4>
                            <p className="text-muted-foreground">Genera certificado al completar</p>
                          </div>
                        </>
                      )}

                      {training.generates_constancia && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-medium mb-1">Constancia</h4>
                            <p className="text-muted-foreground">Genera constancia al completar</p>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>
                  
                  {isAdminOrLeader && (
                    <TabsContent value="evaluation-setup">
                      <EvaluationManager 
                        trainingId={id!} 
                        trainingTitle={training?.title}
                        contentUrl={training?.content_url}
                      />
                    </TabsContent>
                  )}

                  {isAdminOrLeader && (
                    <TabsContent value="answers" className="space-y-4">
                      {!showAnswers ? (
                        <Card>
                          <CardContent className="py-8 text-center">
                            <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground mb-4">
                              Ver las respuestas de los usuarios que han completado la evaluación.
                            </p>
                            <Button onClick={loadEvalAnswers} disabled={loadingAnswers || !evaluation}>
                              {loadingAnswers ? "Cargando..." : "Cargar Respuestas"}
                            </Button>
                            {!evaluation && (
                              <p className="text-xs text-muted-foreground mt-2">
                                No hay evaluación configurada para esta capacitación.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                              <Users className="w-5 h-5" />
                              Respuestas ({evalAnswers.length} intentos completados)
                            </h3>
                            <Button variant="outline" size="sm" onClick={exportAnswersXLSX} disabled={evalAnswers.length === 0}>
                              <Download className="w-4 h-4 mr-2" />
                              Descargar XLSX
                            </Button>
                          </div>

                          {evalAnswers.length === 0 ? (
                            <Card>
                              <CardContent className="py-8 text-center text-muted-foreground">
                                No hay evaluaciones completadas aún.
                              </CardContent>
                            </Card>
                          ) : (
                            evalAnswers.map((attempt: any) => (
                              <Card key={attempt.id}>
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <CardTitle className="text-base">{attempt.user_name}</CardTitle>
                                      <CardDescription>
                                        {attempt.completed_at ? format(new Date(attempt.completed_at), 'dd/MM/yyyy HH:mm') : ''} — 
                                        Puntaje: {attempt.score}/{attempt.max_score}
                                      </CardDescription>
                                    </div>
                                    <Badge variant={attempt.passed ? "default" : "destructive"}>
                                      {attempt.passed ? "Aprobado" : "No Aprobado"}
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {attempt.answers.map((ans: any, idx: number) => (
                                      <div key={idx} className="border rounded-lg p-3 text-sm">
                                        <p className="font-medium mb-1">{idx + 1}. {ans.question_text}</p>
                                        <div className="flex items-start gap-2 mt-2">
                                          <span className="text-muted-foreground shrink-0">Respuesta:</span>
                                          <span className={ans.is_correct ? 'text-green-600' : 'text-red-600'}>
                                            {ans.selected_option_text || '(sin respuesta)'}
                                            {ans.is_correct ? ' ✓' : ' ✗'}
                                          </span>
                                        </div>
                                        {!ans.is_correct && ans.correct_option_text && (
                                          <div className="flex items-start gap-2 mt-1">
                                            <span className="text-muted-foreground shrink-0">Correcta:</span>
                                            <span className="text-green-600">{ans.correct_option_text}</span>
                                          </div>
                                        )}
                                        {ans.ai_feedback && (
                                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                                            <span className="font-medium">Retroalimentación IA: </span>
                                            {ans.ai_feedback}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      )}
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {canInteract && (
              <Card style={{ boxShadow: "var(--shadow-card)" }}>
                <CardHeader>
                  <CardTitle className="text-lg">Tu Progreso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {training.requires_evaluation && evaluation && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pretest</span>
                      {pretestCompleted ? (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                          Pendiente
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-medium">{progressPercentage}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                  </div>

                  {!isCompleted && !training.requires_evaluation && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Actualizar progreso manualmente:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[25, 50, 75, 100].map((value) => (
                          <Button
                            key={value}
                            size="sm"
                            variant="outline"
                            onClick={() => updateProgress(value)}
                            disabled={progressPercentage >= value}
                          >
                            {value}%
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isCompleted && training.requires_evaluation && (
                    <div className="text-center py-2">
                      <p className="text-sm text-muted-foreground">
                        Completa y aprueba la evaluación para finalizar esta capacitación
                      </p>
                    </div>
                  )}

                  <Separator />

                  {isCompleted ? (
                    <div className="text-center py-4">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <p className="font-medium text-green-600">¡Completado!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(userProgress.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                  ) : !training.requires_evaluation ? (
                    <Button
                      className="w-full"
                      onClick={completeTraining}
                      disabled={progressPercentage < 100}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Marcar como completado
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {canInteract && training.requires_evaluation && evaluation && !evaluationPassed && !training.is_finished && (
              <Card style={{ boxShadow: "var(--shadow-card)" }}>
                <CardHeader>
                  <CardTitle className="text-lg">Evaluación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!userProgress?.content_viewed_completely ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Debes visualizar todo el contenido de la capacitación antes de poder realizar la evaluación.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-2">{evaluation.title}</p>
                        <p>{evaluation.description}</p>
                      </div>
                      <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                          Durante la evaluación no tendrás acceso al material de apoyo.
                        </AlertDescription>
                      </Alert>
                      <Button 
                        className="w-full"
                        onClick={() => setShowEvaluation(true)}
                      >
                        Iniciar Evaluación
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {canInteract && training.requires_evaluation && evaluation && evaluationPassed && (
              <Card style={{ boxShadow: "var(--shadow-card)" }} className="border-green-500/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Evaluación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-2">
                    <p className="font-medium text-green-600">¡Evaluación aprobada!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Has completado exitosamente esta evaluación.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {canInteract && training.requires_evaluation && evaluation && training.is_finished && !evaluationPassed && (
              <Card style={{ boxShadow: "var(--shadow-card)" }} className="border-amber-500/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="w-5 h-5 text-amber-500" />
                    Evaluación Bloqueada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                    <Lock className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                      Esta capacitación ha sido finalizada por un administrador. Ya no es posible realizar la evaluación.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
            
            {training.requires_evaluation && !evaluation && isAdminOrLeader && (
              <Card style={{ boxShadow: "var(--shadow-card)" }}>
                <CardHeader>
                  <CardTitle className="text-lg">Evaluación</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Esta capacitación requiere una evaluación pero aún no está configurada.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ve a la pestaña "Configurar Evaluación" para crearla.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Admin: Finish Training Button */}
            {isAdminOrLeader && !training.is_finished && (
              <Card style={{ boxShadow: "var(--shadow-card)" }} className="border-orange-500/30">
                <CardHeader>
                  <CardTitle className="text-lg text-orange-600">Administración</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Al finalizar la capacitación, los usuarios ya no podrán realizar evaluaciones. El contenido seguirá disponible en modo lectura.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
                    onClick={finishTraining}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Finalizar Capacitación
                  </Button>
                </CardContent>
              </Card>
            )}

            {isAdminOrLeader && training.is_finished && (
              <Card style={{ boxShadow: "var(--shadow-card)" }} className="border-green-500/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    Capacitación Finalizada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Esta capacitación fue finalizada el {training.finished_at ? new Date(training.finished_at).toLocaleDateString() : 'N/A'}. Las evaluaciones están bloqueadas.
                  </p>
                </CardContent>
              </Card>
            )}

            {certificates.length > 0 && (
              <Card style={{ boxShadow: "var(--shadow-card)" }}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Certificados y Constancias
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {cert.certificate_type === 'certificate' ? 'Certificado' : 'Constancia'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Emitido: {new Date(cert.issued_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const signedUrl = await getCertificateSignedUrl(cert.file_url);
                              window.open(signedUrl, '_blank');
                            } catch (error) {
                              console.error('Certificate link error:', error);
                              toast.error('No se pudo generar el enlace del certificado');
                            }
                          }}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Descargar
                        </Button>
                      </div>
                      {certificates.indexOf(cert) < certificates.length - 1 && <Separator />}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      {!showEvaluation && <FloatingDocumentsButton isAdmin={isAdminOrLeader} />}
      {!showEvaluation && <FloatingCSAT context="training" contextLabel="Detalle de capacitación" />}
    </div>
  );
};

export default TrainingDetail;

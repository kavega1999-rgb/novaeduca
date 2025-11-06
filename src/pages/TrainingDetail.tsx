import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import EvaluationTaker from "@/components/evaluations/EvaluationTaker";
import EvaluationManager from "@/components/evaluations/EvaluationManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, Award, CheckCircle, PlayCircle, Download } from "lucide-react";
import { toast } from "sonner";

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

  const loadTraining = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Fetch user role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);
        
        // Check if user is admin or leader
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .in("role", ["admin", "leader"]);
        
        setIsAdminOrLeader((roles || []).length > 0);
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

      // Fetch evaluation
      const { data: evalData } = await supabase
        .from("evaluations")
        .select("*")
        .eq("training_id", id)
        .maybeSingle();

      if (evalData) {
        setEvaluation(evalData);
      }

      // Fetch or create user progress
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("training_id", id)
        .single();

      if (progressData) {
        setUserProgress(progressData);
      } else {
        // Create initial progress record
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/trainings")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a capacitaciones
        </Button>

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
                  <TabsList className={`grid w-full ${isAdminOrLeader ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <TabsTrigger value="content">Contenido</TabsTrigger>
                    <TabsTrigger value="details">Detalles</TabsTrigger>
                    {isAdminOrLeader && <TabsTrigger value="evaluation-setup">Configurar Evaluación</TabsTrigger>}
                  </TabsList>
                  
                  <TabsContent value="content" className="space-y-4">
                    {training.content_url ? (
                      <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden">
                        <iframe
                          src={training.content_url}
                          className="w-full h-full"
                          title={training.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <PlayCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            El contenido de esta capacitación estará disponible próximamente
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 pt-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Sobre esta capacitación</h3>
                        <p className="text-muted-foreground">
                          {training.description || "Sin descripción disponible"}
                        </p>
                      </div>
                    </div>
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
                      <EvaluationManager trainingId={id!} />
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader>
                <CardTitle className="text-lg">Tu Progreso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completado</span>
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

            {training.requires_evaluation && evaluation && (
              <Card style={{ boxShadow: "var(--shadow-card)" }}>
                <CardHeader>
                  <CardTitle className="text-lg">Evaluación</CardTitle>
                </CardHeader>
                <CardContent>
                  <EvaluationTaker
                    evaluationId={evaluation.id}
                    trainingId={id!}
                    onComplete={loadTraining}
                  />
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
                          onClick={() => window.open(cert.file_url, '_blank')}
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
    </div>
  );
};

export default TrainingDetail;

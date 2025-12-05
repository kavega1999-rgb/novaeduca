import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Clock, AlertTriangle, ArrowLeft, ShieldAlert, BookOpen } from "lucide-react";
import { toast } from "sonner";

const EvaluationPage = () => {
  const { trainingId } = useParams();
  const [searchParams] = useSearchParams();
  const evaluationId = searchParams.get("evaluationId");
  const navigate = useNavigate();

  const [evaluation, setEvaluation] = useState<any>(null);
  const [training, setTraining] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [previousAttempts, setPreviousAttempts] = useState<any[]>([]);
  const [hasViewedContent, setHasViewedContent] = useState(false);

  useEffect(() => {
    // Wait until we have both trainingId and evaluationId before loading
    if (!trainingId || !evaluationId) {
      return;
    }
    loadData();
  }, [trainingId, evaluationId]);

  const loadData = async () => {
    if (!evaluationId) {
      toast.error("ID de evaluación no proporcionado");
      navigate("/trainings");
      return;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Clean trainingId - remove any query params that might have been appended
    const cleanTrainingId = trainingId?.split('?')[0];
    
    // Load training details
    const { data: trainingData } = await supabase
      .from("trainings")
      .select("id, title, content_url")
      .eq("id", cleanTrainingId)
      .maybeSingle();

    if (!trainingData) {
      toast.error("Capacitación no encontrada");
      navigate("/trainings");
      return;
    }

    setTraining(trainingData);

    // Check if user has viewed content completely
    const { data: progressData } = await supabase
      .from("user_progress")
      .select("content_viewed_completely")
      .eq("user_id", session.user.id)
      .eq("training_id", cleanTrainingId)
      .maybeSingle();

    if (!progressData?.content_viewed_completely) {
      setHasViewedContent(false);
      setLoading(false);
      return;
    }

    setHasViewedContent(true);

    // Load evaluation details
    const { data: evalData, error: evalError } = await supabase
      .from("evaluations")
      .select("*")
      .eq("id", evaluationId)
      .maybeSingle();

    console.log('Evaluation loaded:', evalData, 'Error:', evalError);
    
    if (evalData) {
      setEvaluation(evalData);
    }

    // Load questions with options
    const { data: questionsData, error: questionsError } = await supabase
      .from("evaluation_questions")
      .select(`
        *,
        evaluation_question_options (*)
      `)
      .eq("evaluation_id", evaluationId)
      .order("order_index");

    console.log('Questions loaded:', questionsData, 'Error:', questionsError);

    if (questionsData && questionsData.length > 0) {
      const sortedQuestions = questionsData.map(q => ({
        ...q,
        evaluation_question_options: q.evaluation_question_options.sort(
          (a: any, b: any) => a.order_index - b.order_index
        ),
      }));
      setQuestions(sortedQuestions);
    }

    // Load previous attempts
    const { data: attemptsData } = await supabase
      .from("evaluation_attempts")
      .select("*")
      .eq("evaluation_id", evaluationId)
      .eq("user_id", session.user.id)
      .order("started_at", { ascending: false });

    if (attemptsData) {
      setPreviousAttempts(attemptsData);
    }

    setLoading(false);
  };

  const startAttempt = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const { data: attempt, error } = await supabase
      .from("evaluation_attempts")
      .insert({
        evaluation_id: evaluationId,
        user_id: session.user.id,
        max_score: totalPoints,
        status: "in_progress",
      })
      .select()
      .single();

    if (error) {
      toast.error("Error al iniciar la evaluación");
      return;
    }

    if (attempt) {
      setAttemptId(attempt.id);
    }
  };

  const handleAnswerChange = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const submitAnswer = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    const selectedOptionId = answers[currentQuestion.id];

    if (!selectedOptionId) {
      toast.error("Por favor selecciona una respuesta");
      return;
    }

    const selectedOption = currentQuestion.evaluation_question_options.find(
      (opt: any) => opt.id === selectedOptionId
    );

    const { error } = await supabase
      .from("evaluation_answers")
      .insert({
        attempt_id: attemptId,
        question_id: currentQuestion.id,
        selected_option_id: selectedOptionId,
        is_correct: selectedOption.is_correct,
        points_earned: selectedOption.is_correct ? currentQuestion.points : 0,
      });

    if (error) {
      toast.error("Error al guardar la respuesta");
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      await finishAttempt();
    }
  };

  const finishAttempt = async () => {
    setSubmitting(true);

    // Calculate score
    const { data: answersData } = await supabase
      .from("evaluation_answers")
      .select("points_earned")
      .eq("attempt_id", attemptId);

    if (!answersData) {
      setSubmitting(false);
      return;
    }

    const totalEarned = answersData.reduce((sum, a) => sum + a.points_earned, 0);
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const scorePercentage = (totalEarned / totalPoints) * 100;
    const passed = scorePercentage >= evaluation.passing_score;

    const { data: updatedAttempt, error } = await supabase
      .from("evaluation_attempts")
      .update({
        score: scorePercentage,
        passed,
        completed_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", attemptId)
      .select()
      .single();

    if (error) {
      toast.error("Error al finalizar la evaluación");
      setSubmitting(false);
      return;
    }

    setResult(updatedAttempt);

    if (passed) {
      // Get current session with fresh token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        // Call edge function to generate certificate/constancia with explicit auth
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-certificate`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                attemptId: attemptId,
                trainingId: trainingId?.split('?')[0],
              }),
            }
          );

          const certificateData = await response.json();

          if (!response.ok) {
            console.error('Error generating certificate:', certificateData);
            toast.error("No se pudo generar el certificado/constancia");
          } else {
            console.log('Certificate generated:', certificateData);
            toast.success("Certificado generado exitosamente");
          }
        } catch (err) {
          console.error('Error calling certificate function:', err);
          toast.error("Error al generar el certificado");
        }
      }

      toast.success("¡Felicitaciones! Has aprobado la evaluación");
    } else {
      toast.error("No has alcanzado el puntaje mínimo");
    }

    setSubmitting(false);
  };

  const goBackToTraining = () => {
    navigate(`/training/${trainingId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando evaluación...</p>
        </div>
      </div>
    );
  }

  if (!hasViewedContent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-6 w-6" />
              <CardTitle>Acceso Denegado</CardTitle>
            </div>
            <CardDescription>
              No puedes acceder a la evaluación sin antes visualizar todo el contenido de la capacitación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <BookOpen className="h-4 w-4" />
              <AlertDescription>
                Debes revisar todas las páginas del material de apoyo antes de realizar la evaluación.
              </AlertDescription>
            </Alert>
            <Button onClick={goBackToTraining} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Material
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!evaluation || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
              <CardTitle>Sin Preguntas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Esta evaluación no tiene preguntas configuradas aún.
            </p>
            <Button onClick={goBackToTraining} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a la Capacitación
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has reached max attempts
  const completedAttempts = previousAttempts.filter(a => a.status === "completed");
  const hasReachedMaxAttempts = evaluation.max_attempts && completedAttempts.length >= evaluation.max_attempts;
  const hasPassed = previousAttempts.some(a => a.passed);

  if (hasPassed) {
    const passedAttempt = previousAttempts.find(a => a.passed);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              <CardTitle>Evaluación Aprobada</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Ya has aprobado esta evaluación con un puntaje de {passedAttempt?.score?.toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">
              Fecha: {new Date(passedAttempt.completed_at).toLocaleDateString()}
            </p>
            <Button onClick={goBackToTraining} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a la Capacitación
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasReachedMaxAttempts) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="w-6 h-6" />
              <CardTitle>Intentos Agotados</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Has alcanzado el máximo de {evaluation.max_attempts} intentos permitidos.
            </p>
            <Button onClick={goBackToTraining} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a la Capacitación
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show result screen
  if (result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className={`flex items-center gap-2 ${result.passed ? 'text-green-600' : 'text-destructive'}`}>
              {result.passed ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              <CardTitle>{result.passed ? '¡Aprobado!' : 'No Aprobado'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <p className="text-4xl font-bold">{result.score?.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground mt-2">
                Puntaje mínimo requerido: {evaluation.passing_score}%
              </p>
            </div>

            {!result.passed && (
              <Alert>
                <AlertDescription>
                  Intentos usados: {completedAttempts.length + 1} de {evaluation.max_attempts}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              {!result.passed && completedAttempts.length + 1 < evaluation.max_attempts && (
                <Button onClick={() => window.location.reload()} className="flex-1">
                  Intentar Nuevamente
                </Button>
              )}
              <Button onClick={goBackToTraining} variant={result.passed ? "default" : "outline"} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show start screen
  if (!attemptId) {
    return (
      <div className="min-h-screen bg-background">
        {/* Warning Banner */}
        <div className="bg-amber-500 text-amber-950 py-3 px-4">
          <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
            <ShieldAlert className="h-5 w-5" />
            <span>Durante la evaluación no podrás acceder al material de apoyo. Asegúrate de haberlo estudiado bien.</span>
          </div>
        </div>

        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-52px)]">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <CardTitle className="text-2xl">{evaluation.title}</CardTitle>
              <CardDescription>{evaluation.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Información de la Evaluación</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Capacitación</p>
                    <p className="font-medium">{training?.title}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Preguntas</p>
                    <p className="font-medium">{questions.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Puntaje mínimo</p>
                    <p className="font-medium">{evaluation.passing_score}%</p>
                  </div>
                  {evaluation.time_limit_minutes && (
                    <div>
                      <p className="text-muted-foreground">Tiempo límite</p>
                      <p className="font-medium flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {evaluation.time_limit_minutes} min
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Intentos disponibles</p>
                    <p className="font-medium">
                      {evaluation.max_attempts - completedAttempts.length} de {evaluation.max_attempts}
                    </p>
                  </div>
                </div>
              </div>

              {completedAttempts.length > 0 && (
                <Alert>
                  <AlertDescription>
                    Mejor puntaje anterior: {Math.max(...completedAttempts.map(a => a.score || 0)).toFixed(1)}%
                  </AlertDescription>
                </Alert>
              )}

              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Importante:</strong> Una vez iniciada la evaluación, no podrás volver al material de apoyo. 
                  Asegúrate de haber estudiado bien antes de comenzar.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button variant="outline" onClick={goBackToTraining} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al Material
                </Button>
                <Button onClick={startAttempt} className="flex-1">
                  Comenzar Evaluación
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show question screen
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Warning Banner */}
      <div className="bg-destructive text-destructive-foreground py-3 px-4">
        <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
          <ShieldAlert className="h-5 w-5" />
          <span>Evaluación en curso - El material de apoyo no está disponible durante el examen</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Pregunta {currentQuestionIndex + 1} de {questions.length}</span>
                <span>{currentQuestion.points} {currentQuestion.points === 1 ? 'punto' : 'puntos'}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <CardTitle className="text-xl mt-4">{currentQuestion.question_text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={answers[currentQuestion.id] || ""}
              onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
            >
              {currentQuestion.evaluation_question_options.map((option: any) => (
                <div 
                  key={option.id} 
                  className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleAnswerChange(currentQuestion.id, option.id)}
                >
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id} className="flex-1 cursor-pointer text-base">
                    {option.option_text}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex gap-2 pt-4">
              {currentQuestionIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                >
                  Anterior
                </Button>
              )}
              <Button
                onClick={submitAnswer}
                disabled={!answers[currentQuestion.id] || submitting}
                className="flex-1"
              >
                {submitting
                  ? "Finalizando..."
                  : currentQuestionIndex < questions.length - 1
                  ? "Siguiente"
                  : "Finalizar Evaluación"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EvaluationPage;

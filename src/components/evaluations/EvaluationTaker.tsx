import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EvaluationTakerProps {
  evaluationId: string;
  trainingId: string;
  onComplete: () => void;
}

type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended';

const questionTypeLabels: Record<QuestionType, string> = {
  multiple_choice: 'Selección Múltiple',
  true_false: 'Verdadero/Falso',
  open_ended: 'Respuesta Abierta',
};

const EvaluationTaker = ({ evaluationId, trainingId, onComplete }: EvaluationTakerProps) => {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [evaluatingAI, setEvaluatingAI] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [previousAttempts, setPreviousAttempts] = useState<any[]>([]);

  useEffect(() => {
    loadEvaluation();
  }, [evaluationId]);

  const loadEvaluation = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load evaluation details
    const { data: evalData } = await supabase
      .from("evaluations")
      .select("*")
      .eq("id", evaluationId)
      .single();

    if (evalData) {
      setEvaluation(evalData);
    }

    // Load questions with options
    const { data: questionsData } = await supabase
      .from("evaluation_questions")
      .select(`
        *,
        evaluation_question_options (*)
      `)
      .eq("evaluation_id", evaluationId)
      .order("order_index");

    if (questionsData) {
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

  const handleTextAnswerChange = (questionId: string, text: string) => {
    setTextAnswers(prev => ({ ...prev, [questionId]: text }));
  };

  const submitAnswer = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    const questionType = currentQuestion.question_type || 'multiple_choice';

    if (questionType === 'open_ended') {
      const textResponse = textAnswers[currentQuestion.id];
      if (!textResponse || textResponse.trim().length < 10) {
        toast.error("Por favor escribe una respuesta de al menos 10 caracteres");
        return;
      }

      setEvaluatingAI(true);
      try {
        // Call AI to evaluate open response
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-open-response`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              attemptId,
              questionId: currentQuestion.id,
              textResponse: textResponse.trim(),
              trainingId,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al evaluar la respuesta');
        }

        // Show feedback to user
        if (data.feedback) {
          toast.info(`IA: ${data.feedback}`, { duration: 5000 });
        }

      } catch (error) {
        console.error("Error evaluating open response:", error);
        toast.error(error instanceof Error ? error.message : "Error al evaluar la respuesta");
        setEvaluatingAI(false);
        return;
      }
      setEvaluatingAI(false);

    } else {
      // Multiple choice or true/false
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
      .select("question_id, points_earned, created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: true });

    if (!answersData) {
      setSubmitting(false);
      return;
    }

    // Deduplicar: tomar solo la última respuesta por pregunta
    const latestByQuestion = new Map<string, number>();
    for (const a of answersData) {
      latestByQuestion.set(a.question_id, a.points_earned || 0);
    }
    // Cap puntos por pregunta al máximo definido
    const questionMaxMap = new Map(questions.map(q => [q.id, q.points]));
    let totalEarned = 0;
    for (const [qid, earned] of latestByQuestion.entries()) {
      const max = questionMaxMap.get(qid) ?? earned;
      totalEarned += Math.min(earned, max);
    }
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const scorePercentage = totalPoints > 0 ? Math.min(100, (totalEarned / totalPoints) * 100) : 0;
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
                trainingId: trainingId,
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
      onComplete();
    } else {
      toast.error("No has alcanzado el puntaje mínimo");
    }

    setSubmitting(false);
  };

  if (loading) {
    return <div className="text-center py-8">Cargando evaluación...</div>;
  }

  if (!evaluation || questions.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Esta evaluación no tiene preguntas configuradas aún.
        </AlertDescription>
      </Alert>
    );
  }

  // Check if user has reached max attempts
  const completedAttempts = previousAttempts.filter(a => a.status === "completed");
  const hasReachedMaxAttempts = evaluation.max_attempts && completedAttempts.length >= evaluation.max_attempts;
  const hasPassed = previousAttempts.some(a => a.passed);

  if (hasPassed) {
    const passedAttempt = previousAttempts.find(a => a.passed);
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-6 h-6" />
            <CardTitle>Evaluación Aprobada</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Ya has aprobado esta evaluación con un puntaje de {passedAttempt?.score?.toFixed(1)}%
          </p>
          <p className="text-sm text-muted-foreground">
            Fecha: {new Date(passedAttempt.completed_at).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (hasReachedMaxAttempts) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="w-6 h-6" />
            <CardTitle>Intentos Agotados</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Has alcanzado el máximo de {evaluation.max_attempts} intentos permitidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show result screen
  if (result) {
    return (
      <Card>
        <CardHeader>
          <div className={`flex items-center gap-2 ${result.passed ? 'text-green-600' : 'text-destructive'}`}>
            {result.passed ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            <CardTitle>{result.passed ? '¡Aprobado!' : 'No Aprobado'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-2xl font-bold">{result.score?.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">
              Puntaje mínimo requerido: {evaluation.passing_score}%
            </p>
          </div>

          {!result.passed && (
            <>
              <Alert>
                <AlertDescription>
                  Intentos usados: {completedAttempts.length + 1} de {evaluation.max_attempts}
                </AlertDescription>
              </Alert>
              {completedAttempts.length + 1 < evaluation.max_attempts && (
                <Button onClick={() => window.location.reload()}>
                  Intentar nuevamente
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show start screen
  if (!attemptId) {
    const hasOpenEndedQuestions = questions.some(q => q.question_type === 'open_ended');
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>{evaluation.title}</CardTitle>
          <CardDescription>{evaluation.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
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

          {hasOpenEndedQuestions && (
            <Alert>
              <AlertDescription>
                Esta evaluación incluye preguntas de respuesta abierta que serán evaluadas automáticamente por IA basándose en el material de capacitación.
              </AlertDescription>
            </Alert>
          )}

          {completedAttempts.length > 0 && (
            <Alert>
              <AlertDescription>
                Mejor puntaje anterior: {Math.max(...completedAttempts.map(a => a.score || 0)).toFixed(1)}%
              </AlertDescription>
            </Alert>
          )}

          <Button onClick={startAttempt} className="w-full">
            Comenzar Evaluación
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show question screen
  const currentQuestion = questions[currentQuestionIndex];
  const questionType = (currentQuestion.question_type || 'multiple_choice') as QuestionType;
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const isAnswered = questionType === 'open_ended' 
    ? (textAnswers[currentQuestion.id]?.trim().length || 0) >= 10
    : !!answers[currentQuestion.id];

  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Pregunta {currentQuestionIndex + 1} de {questions.length}</span>
              <Badge variant="outline" className="text-xs">
                {questionTypeLabels[questionType]}
              </Badge>
            </div>
            <span>{currentQuestion.points} {currentQuestion.points === 1 ? 'punto' : 'puntos'}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <CardTitle className="text-lg">{currentQuestion.question_text}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {questionType === 'open_ended' ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Escribe tu respuesta aquí..."
              value={textAnswers[currentQuestion.id] || ""}
              onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              {(textAnswers[currentQuestion.id]?.length || 0)} / 2000 caracteres
              {(textAnswers[currentQuestion.id]?.length || 0) < 10 && " (mínimo 10 caracteres)"}
            </p>
            <p className="text-xs text-muted-foreground">
              Tu respuesta será evaluada automáticamente comparándola con el material de capacitación.
            </p>
          </div>
        ) : (
          <RadioGroup
            value={answers[currentQuestion.id] || ""}
            onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
          >
            {currentQuestion.evaluation_question_options.map((option: any) => (
              <div key={option.id} className="flex items-center space-x-2">
                <RadioGroupItem value={option.id} id={option.id} />
                <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                  {option.option_text}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        <div className="flex gap-2">
          {currentQuestionIndex > 0 && (
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              disabled={submitting || evaluatingAI}
            >
              Anterior
            </Button>
          )}
          <Button
            onClick={submitAnswer}
            disabled={!isAnswered || submitting || evaluatingAI}
            className="flex-1"
          >
            {evaluatingAI ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Evaluando con IA...
              </>
            ) : submitting ? (
              "Finalizando..."
            ) : currentQuestionIndex < questions.length - 1 ? (
              "Siguiente"
            ) : (
              "Finalizar"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EvaluationTaker;

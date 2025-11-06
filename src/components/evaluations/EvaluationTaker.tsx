import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface EvaluationTakerProps {
  evaluationId: string;
  trainingId: string;
  onComplete: () => void;
}

const EvaluationTaker = ({ evaluationId, trainingId, onComplete }: EvaluationTakerProps) => {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Call edge function to generate certificate/constancia
        try {
          const { data: certificateData, error: certError } = await supabase.functions.invoke(
            'generate-certificate',
            {
              body: {
                attemptId: attemptId,
                userId: session.user.id,
                trainingId: trainingId,
              },
            }
          );

          if (certError) {
            console.error('Error generating certificate:', certError);
            toast.error("No se pudo generar el certificado/constancia");
          } else {
            console.log('Certificate generated:', certificateData);
          }
        } catch (err) {
          console.error('Error calling certificate function:', err);
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
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Pregunta {currentQuestionIndex + 1} de {questions.length}</span>
            <span>{currentQuestion.points} {currentQuestion.points === 1 ? 'punto' : 'puntos'}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <CardTitle className="text-lg">{currentQuestion.question_text}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="flex gap-2">
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
              : "Finalizar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EvaluationTaker;

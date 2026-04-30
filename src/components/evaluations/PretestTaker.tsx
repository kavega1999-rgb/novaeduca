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
import { CheckCircle, Clock, AlertTriangle, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PretestTakerProps {
  evaluationId: string;
  trainingId: string;
  onComplete: (score: number) => void;
  onSkip?: () => void;
}

type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended';

const questionTypeLabels: Record<QuestionType, string> = {
  multiple_choice: 'Selección Múltiple',
  true_false: 'Verdadero/Falso',
  open_ended: 'Respuesta Abierta',
};

const getScoreCategory = (score: number): string => {
  if (score >= 90) return 'Excelente';
  if (score >= 80) return 'Bueno';
  if (score >= 70) return 'Aceptable';
  return 'Inaceptable';
};

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'Excelente': return 'text-green-600 bg-green-100';
    case 'Bueno': return 'text-blue-600 bg-blue-100';
    case 'Aceptable': return 'text-amber-600 bg-amber-100';
    default: return 'text-red-600 bg-red-100';
  }
};

const PretestTaker = ({ evaluationId, trainingId, onComplete, onSkip }: PretestTakerProps) => {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [hasCompletedPretest, setHasCompletedPretest] = useState(false);

  useEffect(() => {
    loadEvaluation();
  }, [evaluationId]);

  const loadEvaluation = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Check if user already completed pretest
    const { data: existingPretest } = await supabase
      .from("pretest_attempts")
      .select("*")
      .eq("evaluation_id", evaluationId)
      .eq("user_id", session.user.id)
      .eq("status", "completed")
      .maybeSingle();

    if (existingPretest) {
      setHasCompletedPretest(true);
      setResult(existingPretest);
      setLoading(false);
      return;
    }

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

    setLoading(false);
  };

  const startAttempt = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const { data: attempt, error } = await supabase
      .from("pretest_attempts")
      .insert({
        evaluation_id: evaluationId,
        training_id: trainingId,
        user_id: session.user.id,
        max_score: totalPoints,
        status: "in_progress",
      })
      .select()
      .single();

    if (error) {
      toast.error("Error al iniciar el pretest");
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
      if (!textResponse || textResponse.trim().length < 5) {
        toast.error("Por favor escribe una respuesta");
        return;
      }

      // For pretest, we just save the answer without AI evaluation
      const { error } = await supabase
        .from("pretest_answers")
        .insert({
          attempt_id: attemptId,
          question_id: currentQuestion.id,
          text_response: textResponse.trim(),
          is_correct: null, // Will be evaluated after training
          points_earned: 0,
        });

      if (error) {
        toast.error("Error al guardar la respuesta");
        return;
      }
    } else {
      const selectedOptionId = answers[currentQuestion.id];

      if (!selectedOptionId) {
        toast.error("Por favor selecciona una respuesta");
        return;
      }

      const selectedOption = currentQuestion.evaluation_question_options.find(
        (opt: any) => opt.id === selectedOptionId
      );

      const { error } = await supabase
        .from("pretest_answers")
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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Calculate score
    const { data: answersData } = await supabase
      .from("pretest_answers")
      .select("question_id, points_earned, created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: true });

    if (!answersData) {
      setSubmitting(false);
      return;
    }

    const latestByQuestion = new Map<string, number>();
    for (const a of answersData) {
      latestByQuestion.set(a.question_id, a.points_earned || 0);
    }
    const questionMaxMap = new Map(questions.map(q => [q.id, q.points]));
    let totalEarned = 0;
    for (const [qid, earned] of latestByQuestion.entries()) {
      const max = questionMaxMap.get(qid) ?? earned;
      totalEarned += Math.min(earned, max);
    }
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const scorePercentage = totalPoints > 0 ? Math.min(100, (totalEarned / totalPoints) * 100) : 0;

    const { data: updatedAttempt, error } = await supabase
      .from("pretest_attempts")
      .update({
        score: scorePercentage,
        completed_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", attemptId)
      .select()
      .single();

    if (error) {
      toast.error("Error al finalizar el pretest");
      setSubmitting(false);
      return;
    }

    // Update user progress
    await supabase
      .from("user_progress")
      .update({
        pretest_completed: true,
        pretest_score: scorePercentage,
      })
      .eq("user_id", session.user.id)
      .eq("training_id", trainingId);

    setResult(updatedAttempt);
    setSubmitting(false);
    
    toast.success("Pretest completado. ¡Ahora puedes comenzar la capacitación!");
    onComplete(scorePercentage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasCompletedPretest && result) {
    const category = getScoreCategory(result.score || 0);
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle className="w-6 h-6" />
            <CardTitle>Pretest Completado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <p className="text-3xl font-bold">{result.score?.toFixed(1)}%</p>
            <Badge className={`mt-2 ${getCategoryColor(category)}`}>
              {category}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Ya completaste el diagnóstico inicial. Continúa con la capacitación para mejorar tu conocimiento.
          </p>
          <Button onClick={() => onComplete(result.score)} className="w-full">
            <BookOpen className="w-4 h-4 mr-2" />
            Continuar al Contenido
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!evaluation || questions.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Esta capacitación no tiene pretest configurado.
        </AlertDescription>
      </Alert>
    );
  }

  // Show result screen
  if (result) {
    const category = getScoreCategory(result.score || 0);
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle className="w-6 h-6" />
            <CardTitle>Pretest Completado</CardTitle>
          </div>
          <CardDescription>
            Este es tu diagnóstico inicial. No te preocupes por el resultado, el objetivo es medir tu conocimiento previo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <p className="text-3xl font-bold">{result.score?.toFixed(1)}%</p>
            <Badge className={`mt-2 ${getCategoryColor(category)}`}>
              {category}
            </Badge>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">¿Qué significa esto?</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Este resultado NO afecta tu certificación</li>
              <li>• Sirve para medir tu conocimiento antes de la capacitación</li>
              <li>• Al final, compararemos tu mejora con el postest</li>
            </ul>
          </div>

          <Button onClick={() => onComplete(result.score)} className="w-full">
            <BookOpen className="w-4 h-4 mr-2" />
            Comenzar Capacitación
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show start screen
  if (!attemptId) {
    return (
      <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <Clock className="w-6 h-6" />
            <CardTitle>Evaluación Diagnóstica (Pretest)</CardTitle>
          </div>
          <CardDescription>
            Antes de comenzar la capacitación, realizaremos un diagnóstico de tus conocimientos actuales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-500 bg-amber-100/50 dark:bg-amber-900/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <strong>Importante:</strong> Este pretest NO bloquea el acceso al curso ni afecta tu certificación. 
              Es solo para medir tu conocimiento previo.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Preguntas</p>
              <p className="font-medium">{questions.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tipo</p>
              <p className="font-medium">Diagnóstico inicial</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={startAttempt} className="flex-1">
              Comenzar Pretest
            </Button>
            {onSkip && (
              <Button variant="outline" onClick={onSkip}>
                Omitir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show question screen
  const currentQuestion = questions[currentQuestionIndex];
  const questionType = (currentQuestion.question_type || 'multiple_choice') as QuestionType;
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const isAnswered = questionType === 'open_ended' 
    ? (textAnswers[currentQuestion.id]?.trim().length || 0) >= 5
    : !!answers[currentQuestion.id];

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-amber-600 border-amber-500">
            PRETEST
          </Badge>
          <span className="text-sm text-muted-foreground">
            Pregunta {currentQuestionIndex + 1} de {questions.length}
          </span>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
        <CardTitle className="text-lg mt-4">{currentQuestion.question_text}</CardTitle>
        <Badge variant="secondary" className="w-fit">
          {questionTypeLabels[questionType]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {questionType === 'open_ended' ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Escribe tu respuesta aquí..."
              value={textAnswers[currentQuestion.id] || ""}
              onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              {(textAnswers[currentQuestion.id]?.length || 0)} / 1000 caracteres
            </p>
          </div>
        ) : (
          <RadioGroup
            value={answers[currentQuestion.id] || ""}
            onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
            className="space-y-3"
          >
            {currentQuestion.evaluation_question_options.map((option: any) => (
              <div
                key={option.id}
                className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleAnswerChange(currentQuestion.id, option.id)}
              >
                <RadioGroupItem value={option.id} id={option.id} />
                <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                  {option.option_text}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        <Button
          onClick={submitAnswer}
          disabled={!isAnswered || submitting}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : currentQuestionIndex < questions.length - 1 ? (
            "Siguiente Pregunta"
          ) : (
            "Finalizar Pretest"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PretestTaker;

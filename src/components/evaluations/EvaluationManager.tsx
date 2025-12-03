import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface EvaluationManagerProps {
  trainingId: string;
  trainingTitle?: string;
  contentUrl?: string;
}

const questionSchema = z.object({
  question_text: z.string().trim().min(5, "La pregunta debe tener al menos 5 caracteres").max(500, "Máximo 500 caracteres"),
  points: z.number().int().min(1, "Mínimo 1 punto").max(10, "Máximo 10 puntos"),
});

const optionSchema = z.object({
  option_text: z.string().trim().min(1, "La opción no puede estar vacía").max(200, "Máximo 200 caracteres"),
});

const evaluationSchema = z.object({
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres").max(200, "Máximo 200 caracteres"),
  description: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
  passing_score: z.number().int().min(1, "Mínimo 1%").max(100, "Máximo 100%"),
  max_attempts: z.number().int().min(1, "Mínimo 1 intento").max(10, "Máximo 10 intentos"),
  time_limit_minutes: z.number().int().min(1, "Mínimo 1 minuto").max(180, "Máximo 180 minutos").optional().nullable(),
});

const EvaluationManager = ({ trainingId, trainingTitle, contentUrl }: EvaluationManagerProps) => {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  useEffect(() => {
    loadEvaluation();
  }, [trainingId]);

  const loadEvaluation = async () => {
    const { data: evalData } = await supabase
      .from("evaluations")
      .select("*")
      .eq("training_id", trainingId)
      .single();

    if (evalData) {
      setEvaluation(evalData);

      const { data: questionsData } = await supabase
        .from("evaluation_questions")
        .select(`
          *,
          evaluation_question_options (*)
        `)
        .eq("evaluation_id", evalData.id)
        .order("order_index");

      if (questionsData) {
        setQuestions(questionsData.map(q => ({
          ...q,
          evaluation_question_options: q.evaluation_question_options.sort(
            (a: any, b: any) => a.order_index - b.order_index
          ),
        })));
      }
    } else {
      setEvaluation({
        training_id: trainingId,
        title: "",
        description: "",
        passing_score: 70,
        max_attempts: 3,
        time_limit_minutes: null,
      });
    }

    setLoading(false);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `temp-${Date.now()}`,
        question_text: "",
        points: 1,
        order_index: questions.length,
        evaluation_question_options: [
          { id: `temp-opt-1-${Date.now()}`, option_text: "", is_correct: false, order_index: 0 },
          { id: `temp-opt-2-${Date.now()}`, option_text: "", is_correct: false, order_index: 1 },
        ],
      },
    ]);
  };

  const generateQuestionsWithAI = async () => {
    if (!contentUrl) {
      toast.error("Debes subir el contenido PDF primero para generar preguntas automáticamente");
      return;
    }

    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-evaluation-questions', {
        body: { 
          pdfUrl: contentUrl,
          trainingTitle: trainingTitle || "Capacitación"
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.questions && Array.isArray(data.questions)) {
        const newQuestions = data.questions.map((q: any, index: number) => ({
          id: `temp-ai-${Date.now()}-${index}`,
          question_text: q.question_text,
          points: 1,
          order_index: questions.length + index,
          evaluation_question_options: q.options.map((opt: any, optIndex: number) => ({
            id: `temp-opt-ai-${Date.now()}-${index}-${optIndex}`,
            option_text: opt.option_text,
            is_correct: opt.is_correct,
            order_index: optIndex,
          })),
        }));

        setQuestions([...questions, ...newQuestions]);
        toast.success(`Se generaron ${newQuestions.length} preguntas con IA`);
      }
    } catch (error) {
      console.error("Error generating questions with AI:", error);
      toast.error("Error al generar preguntas con IA");
    } finally {
      setGeneratingAI(false);
    }
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    const question = updated[questionIndex];
    question.evaluation_question_options.push({
      id: `temp-opt-${Date.now()}`,
      option_text: "",
      is_correct: false,
      order_index: question.evaluation_question_options.length,
    });
    setQuestions(updated);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].evaluation_question_options.splice(optionIndex, 1);
    setQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, field: string, value: any) => {
    const updated = [...questions];
    const option = updated[questionIndex].evaluation_question_options[optionIndex];
    
    if (field === "is_correct" && value) {
      updated[questionIndex].evaluation_question_options.forEach((opt: any) => {
        opt.is_correct = false;
      });
    }
    
    option[field] = value;
    setQuestions(updated);
  };

  const saveEvaluation = async () => {
    try {
      // Validate evaluation data
      evaluationSchema.parse({
        ...evaluation,
        time_limit_minutes: evaluation.time_limit_minutes || null,
      });

      // Validate questions
      if (questions.length === 0) {
        toast.error("Debes agregar al menos una pregunta");
        return;
      }

      for (const question of questions) {
        questionSchema.parse(question);
        
        if (question.evaluation_question_options.length < 2) {
          toast.error("Cada pregunta debe tener al menos 2 opciones");
          return;
        }

        const hasCorrectOption = question.evaluation_question_options.some((opt: any) => opt.is_correct);
        if (!hasCorrectOption) {
          toast.error("Cada pregunta debe tener una opción correcta marcada");
          return;
        }

        for (const option of question.evaluation_question_options) {
          optionSchema.parse(option);
        }
      }

      setSaving(true);

      let evaluationId = evaluation.id;
      
      if (!evaluationId) {
        const { data: newEval, error: evalError } = await supabase
          .from("evaluations")
          .insert({
            training_id: trainingId,
            title: evaluation.title,
            description: evaluation.description,
            passing_score: evaluation.passing_score,
            max_attempts: evaluation.max_attempts,
            time_limit_minutes: evaluation.time_limit_minutes,
          })
          .select()
          .single();

        if (evalError) throw evalError;
        evaluationId = newEval.id;
        setEvaluation(newEval);
      } else {
        const { error: updateError } = await supabase
          .from("evaluations")
          .update({
            title: evaluation.title,
            description: evaluation.description,
            passing_score: evaluation.passing_score,
            max_attempts: evaluation.max_attempts,
            time_limit_minutes: evaluation.time_limit_minutes,
          })
          .eq("id", evaluationId);

        if (updateError) throw updateError;

        await supabase
          .from("evaluation_questions")
          .delete()
          .eq("evaluation_id", evaluationId);
      }

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        const { data: newQuestion, error: questionError } = await supabase
          .from("evaluation_questions")
          .insert({
            evaluation_id: evaluationId,
            question_text: question.question_text,
            question_type: "multiple_choice",
            points: question.points,
            order_index: i,
          })
          .select()
          .single();

        if (questionError) throw questionError;

        for (let j = 0; j < question.evaluation_question_options.length; j++) {
          const option = question.evaluation_question_options[j];
          
          const { error: optionError } = await supabase
            .from("evaluation_question_options")
            .insert({
              question_id: newQuestion.id,
              option_text: option.option_text,
              is_correct: option.is_correct,
              order_index: j,
            });

          if (optionError) throw optionError;
        }
      }

      toast.success("Evaluación guardada exitosamente");
      loadEvaluation();
    } catch (error: any) {
      console.error("Error saving evaluation:", error);
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Error al guardar la evaluación");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de la Evaluación</CardTitle>
          <CardDescription>
            Define las características generales de la evaluación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={evaluation.title}
              onChange={(e) => setEvaluation({ ...evaluation, title: e.target.value })}
              placeholder="Ej: Evaluación Final del Curso"
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={evaluation.description || ""}
              onChange={(e) => setEvaluation({ ...evaluation, description: e.target.value })}
              placeholder="Descripción opcional de la evaluación"
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="passing_score">Puntaje Mínimo (%) *</Label>
              <Input
                id="passing_score"
                type="number"
                min="1"
                max="100"
                value={evaluation.passing_score}
                onChange={(e) => setEvaluation({ ...evaluation, passing_score: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="max_attempts">Intentos Máximos *</Label>
              <Input
                id="max_attempts"
                type="number"
                min="1"
                max="10"
                value={evaluation.max_attempts}
                onChange={(e) => setEvaluation({ ...evaluation, max_attempts: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="time_limit">Tiempo Límite (min)</Label>
              <Input
                id="time_limit"
                type="number"
                min="1"
                max="180"
                value={evaluation.time_limit_minutes || ""}
                onChange={(e) => setEvaluation({ ...evaluation, time_limit_minutes: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Opcional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Preguntas</h3>
        <div className="flex gap-2">
          <Button 
            onClick={generateQuestionsWithAI} 
            size="sm" 
            variant="outline"
            disabled={generatingAI || !contentUrl}
            title={!contentUrl ? "Sube el PDF de la capacitación primero" : "Generar preguntas automáticamente"}
          >
            {generatingAI ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {generatingAI ? "Generando..." : "Generar con IA"}
          </Button>
          <Button onClick={addQuestion} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Pregunta
          </Button>
        </div>
      </div>

      {questions.map((question, qIndex) => (
        <Card key={question.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pregunta {qIndex + 1}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeQuestion(qIndex)}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Texto de la Pregunta *</Label>
              <Textarea
                value={question.question_text}
                onChange={(e) => updateQuestion(qIndex, "question_text", e.target.value)}
                placeholder="Escribe tu pregunta aquí"
                maxLength={500}
              />
            </div>

            <div className="w-32">
              <Label>Puntos *</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={question.points}
                onChange={(e) => updateQuestion(qIndex, "points", parseInt(e.target.value))}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Opciones de Respuesta</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addOption(qIndex)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Opción
                </Button>
              </div>

              {question.evaluation_question_options.map((option: any, oIndex: number) => (
                <div key={option.id} className="flex items-start gap-2">
                  <Input
                    value={option.option_text}
                    onChange={(e) => updateOption(qIndex, oIndex, "option_text", e.target.value)}
                    placeholder={`Opción ${oIndex + 1}`}
                    maxLength={200}
                    className="flex-1"
                  />
                  <Label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={option.is_correct}
                      onChange={(e) => updateOption(qIndex, oIndex, "is_correct", e.target.checked)}
                      className="cursor-pointer"
                    />
                    Correcta
                  </Label>
                  {question.evaluation_question_options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(qIndex, oIndex)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={saveEvaluation} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Guardando..." : "Guardar Evaluación"}
        </Button>
      </div>
    </div>
  );
};

export default EvaluationManager;

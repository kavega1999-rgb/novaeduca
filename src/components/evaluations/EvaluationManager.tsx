import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Sparkles, Loader2, Upload } from "lucide-react";
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

type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended';

const questionTypeLabels: Record<QuestionType, string> = {
  multiple_choice: 'Selección Múltiple',
  true_false: 'Verdadero/Falso',
  open_ended: 'Respuesta Abierta',
};

const questionTypeBadgeVariants: Record<QuestionType, "default" | "secondary" | "outline"> = {
  multiple_choice: 'default',
  true_false: 'secondary',
  open_ended: 'outline',
};

const EvaluationManager = ({ trainingId, trainingTitle, contentUrl }: EvaluationManagerProps) => {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [extractingPDF, setExtractingPDF] = useState(false);
  const [extractionStep, setExtractionStep] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        requires_pretest: false,
        title: "",
        description: "",
        passing_score: 70,
        max_attempts: 3,
        time_limit_minutes: null,
      });
    }

    setLoading(false);
  };

  const addQuestion = (type: QuestionType = 'multiple_choice') => {
    let defaultOptions: any[] = [];
    
    if (type === 'multiple_choice') {
      defaultOptions = [
        { id: `temp-opt-1-${Date.now()}`, option_text: "", is_correct: false, order_index: 0 },
        { id: `temp-opt-2-${Date.now()}`, option_text: "", is_correct: false, order_index: 1 },
      ];
    } else if (type === 'true_false') {
      defaultOptions = [
        { id: `temp-opt-1-${Date.now()}`, option_text: "Verdadero", is_correct: true, order_index: 0 },
        { id: `temp-opt-2-${Date.now()}`, option_text: "Falso", is_correct: false, order_index: 1 },
      ];
    }
    // open_ended has no options

    setQuestions([
      ...questions,
      {
        id: `temp-${Date.now()}`,
        question_text: "",
        question_type: type,
        points: 1,
        order_index: questions.length,
        evaluation_question_options: defaultOptions,
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
          question_type: q.question_type || 'multiple_choice',
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

  const extractQuestionsFromPDF = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      toast.error("Por favor selecciona un archivo PDF válido");
      return;
    }

    setExtractingPDF(true);
    setExtractionStep("Preparando archivo...");
    try {
      const formData = new FormData();
      formData.append('file', file);

      setExtractionStep("Enviando PDF al analizador...");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-evaluation-from-pdf`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      setExtractionStep("Procesando respuesta de la IA...");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al extraer preguntas');
      }

      if (data.questions && Array.isArray(data.questions)) {
        const newQuestions = data.questions.map((q: any, index: number) => {
          const questionType = q.question_type || 'multiple_choice';
          const options = q.options || [];
          
          return {
            id: `temp-pdf-${Date.now()}-${index}`,
            question_text: q.question_text,
            question_type: questionType,
            points: 1,
            order_index: questions.length + index,
            evaluation_question_options: options.map((opt: any, optIndex: number) => ({
              id: `temp-opt-pdf-${Date.now()}-${index}-${optIndex}`,
              option_text: opt.option_text,
              is_correct: opt.is_correct,
              order_index: optIndex,
            })),
          };
        });

        setQuestions([...questions, ...newQuestions]);
        
        const typeCounts = data.metadata?.question_types_count;
        let summaryMessage = `Se extrajeron ${newQuestions.length} preguntas del PDF`;
        if (typeCounts) {
          const parts = [];
          if (typeCounts.multiple_choice) parts.push(`${typeCounts.multiple_choice} selección múltiple`);
          if (typeCounts.true_false) parts.push(`${typeCounts.true_false} verdadero/falso`);
          if (typeCounts.open_ended) parts.push(`${typeCounts.open_ended} abiertas`);
          if (parts.length > 0) {
            summaryMessage += ` (${parts.join(', ')})`;
          }
        }
        toast.success(summaryMessage);
        
        if (data.metadata?.title && !evaluation.title) {
          setEvaluation({ ...evaluation, title: data.metadata.title });
        }
      }
    } catch (error) {
      console.error("Error extracting questions from PDF:", error);
      toast.error(error instanceof Error ? error.message : "Error al extraer preguntas del PDF");
    } finally {
      setExtractingPDF(false);
      setExtractionStep("");
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      extractQuestionsFromPDF(file);
    }
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    
    // If changing question type, update options accordingly
    if (field === 'question_type') {
      if (value === 'open_ended') {
        updated[index].evaluation_question_options = [];
      } else if (value === 'true_false') {
        updated[index].evaluation_question_options = [
          { id: `temp-opt-1-${Date.now()}`, option_text: "Verdadero", is_correct: true, order_index: 0 },
          { id: `temp-opt-2-${Date.now()}`, option_text: "Falso", is_correct: false, order_index: 1 },
        ];
      } else if (value === 'multiple_choice' && updated[index].evaluation_question_options.length < 2) {
        updated[index].evaluation_question_options = [
          { id: `temp-opt-1-${Date.now()}`, option_text: "", is_correct: false, order_index: 0 },
          { id: `temp-opt-2-${Date.now()}`, option_text: "", is_correct: false, order_index: 1 },
        ];
      }
    }
    
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
        
        const questionType = question.question_type || 'multiple_choice';
        
        // For non-open-ended questions, validate options
        if (questionType !== 'open_ended') {
          if (question.evaluation_question_options.length < 2) {
            toast.error("Las preguntas de selección deben tener al menos 2 opciones");
            return;
          }

          const hasCorrectOption = question.evaluation_question_options.some((opt: any) => opt.is_correct);
          if (!hasCorrectOption) {
            toast.error("Las preguntas de selección deben tener una opción correcta marcada");
            return;
          }

          for (const option of question.evaluation_question_options) {
            optionSchema.parse(option);
          }
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
            requires_pretest: evaluation.requires_pretest || false,
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
            requires_pretest: evaluation.requires_pretest || false,
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
            question_type: question.question_type || "multiple_choice",
            points: question.points,
            order_index: i,
          })
          .select()
          .single();

        if (questionError) throw questionError;

        // Only insert options for non-open-ended questions
        if (question.question_type !== 'open_ended') {
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

          <Separator className="my-4" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requires_pretest">Habilitar Pretest</Label>
              <p className="text-sm text-muted-foreground">
                Aplicar un diagnóstico inicial antes de la capacitación para medir adherencia
              </p>
            </div>
            <Switch
              id="requires_pretest"
              checked={evaluation.requires_pretest || false}
              onCheckedChange={(checked) => setEvaluation({ ...evaluation, requires_pretest: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Preguntas</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            size="sm" 
            variant="outline"
            disabled={extractingPDF}
            title="Subir un PDF de examen y extraer las preguntas automáticamente"
          >
            {extractingPDF ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {extractingPDF ? extractionStep || "Extrayendo..." : "Importar desde PDF"}
          </Button>
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
          <Select onValueChange={(value) => addQuestion(value as QuestionType)}>
            <SelectTrigger className="w-[180px]">
              <Plus className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Agregar Pregunta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple_choice">Selección Múltiple</SelectItem>
              <SelectItem value="true_false">Verdadero/Falso</SelectItem>
              <SelectItem value="open_ended">Respuesta Abierta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {questions.map((question, qIndex) => (
        <Card key={question.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Pregunta {qIndex + 1}</CardTitle>
                <Badge variant={questionTypeBadgeVariants[question.question_type as QuestionType] || 'default'}>
                  {questionTypeLabels[question.question_type as QuestionType] || 'Selección Múltiple'}
                </Badge>
              </div>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <Label>Tipo de Pregunta</Label>
                <Select 
                  value={question.question_type || 'multiple_choice'}
                  onValueChange={(value) => updateQuestion(qIndex, "question_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Selección Múltiple</SelectItem>
                    <SelectItem value="true_false">Verdadero/Falso</SelectItem>
                    <SelectItem value="open_ended">Respuesta Abierta</SelectItem>
                  </SelectContent>
                </Select>
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
            </div>

            <div>
              <Label>Texto de la Pregunta *</Label>
              <Textarea
                value={question.question_text}
                onChange={(e) => updateQuestion(qIndex, "question_text", e.target.value)}
                placeholder="Escribe tu pregunta aquí"
                maxLength={500}
              />
            </div>

        {question.question_type === 'open_ended' ? (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Esta es una pregunta de respuesta abierta. El usuario escribirá su respuesta en un campo de texto.
              La calificación será automática mediante IA, comparando la respuesta con el material de capacitación.
            </p>
          </div>
        ) : (
              <>
                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Opciones de Respuesta</Label>
                    {question.question_type !== 'true_false' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addOption(qIndex)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Opción
                      </Button>
                    )}
                  </div>

                  {question.evaluation_question_options.map((option: any, oIndex: number) => (
                    <div key={option.id} className="flex items-start gap-2">
                      <Input
                        value={option.option_text}
                        onChange={(e) => updateOption(qIndex, oIndex, "option_text", e.target.value)}
                        placeholder={`Opción ${oIndex + 1}`}
                        maxLength={200}
                        className="flex-1"
                        disabled={question.question_type === 'true_false'}
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
                      {question.question_type !== 'true_false' && question.evaluation_question_options.length > 2 && (
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
              </>
            )}
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

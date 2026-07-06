import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, Download, Upload, Trash2, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  parseSurveyXlsx,
  createSurveyFromImport,
  downloadImportTemplate,
  type ImportQType,
  type ImportSection,
  type ImportQuestion,
} from "@/lib/import-survey-xlsx";

const TYPES: { value: ImportQType; label: string }[] = [
  { value: "short_text", label: "Texto corto" },
  { value: "long_text", label: "Texto largo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "time", label: "Hora" },
  { value: "email", label: "Correo" },
  { value: "phone", label: "Teléfono" },
  { value: "single_choice", label: "Opción única" },
  { value: "multi_choice", label: "Opción múltiple" },
  { value: "dropdown", label: "Desplegable" },
  { value: "boolean", label: "Sí/No" },
  { value: "rating", label: "Estrellas" },
  { value: "scale", label: "Escala" },
];

const rid = () => Math.random().toString(36).slice(2, 10);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function ImportSurveyDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<ImportSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep("upload");
    setTitle("");
    setDescription("");
    setSections([]);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseSurveyXlsx(file);
      if (!parsed.sections.length) {
        toast({ title: "Archivo vacío", description: "No se detectaron preguntas.", variant: "destructive" });
        return;
      }
      setTitle(parsed.title);
      setSections(parsed.sections);
      setStep("preview");
      toast({
        title: "Archivo procesado",
        description: `${parsed.sections.length} sección(es), ${parsed.sections.reduce((a, s) => a + s.questions.length, 0)} pregunta(s).`,
      });
    } catch (e: any) {
      toast({ title: "Error al leer archivo", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateSection = (sid: string, patch: Partial<ImportSection>) =>
    setSections((prev) => prev.map((s) => (s.id === sid ? { ...s, ...patch } : s)));

  const removeSection = (sid: string) =>
    setSections((prev) => prev.filter((s) => s.id !== sid));

  const addSection = () =>
    setSections((prev) => [...prev, { id: rid(), title: `Sección ${prev.length + 1}`, questions: [] }]);

  const updateQuestion = (sid: string, qid: string, patch: Partial<ImportQuestion>) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id === sid
          ? { ...s, questions: s.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }
          : s
      )
    );

  const removeQuestion = (sid: string, qid: string) =>
    setSections((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, questions: s.questions.filter((q) => q.id !== qid) } : s))
    );

  const addQuestion = (sid: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id === sid
          ? {
              ...s,
              questions: [
                ...s.questions,
                { id: rid(), question_text: "Nueva pregunta", question_type: "short_text", is_required: false, options: [] },
              ],
            }
          : s
      )
    );

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!title.trim()) {
      toast({ title: "Falta el título", variant: "destructive" });
      return;
    }
    const totalQ = sections.reduce((a, s) => a + s.questions.length, 0);
    if (!totalQ) {
      toast({ title: "Sin preguntas", description: "Agrega al menos una pregunta.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const id = await createSurveyFromImport(user.id, title, description, sections);
      toast({ title: "Encuesta creada", description: "Se importó como borrador." });
      onOpenChange(false);
      reset();
      navigate(`/dashboard/surveys/${id}/edit`);
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar encuesta desde Excel
          </DialogTitle>
          <DialogDescription>
            Sube un archivo .xlsx con la estructura de preguntas. Podrás revisarlo y ajustarlo antes de guardar.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <Card className="border-dashed">
              <CardContent className="p-6 text-center space-y-3">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Formatos soportados: .xlsx, .xls, .csv
                </p>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  disabled={loading}
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  className="max-w-md mx-auto"
                />
                {loading && (
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Procesando…
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="rounded-md border p-3 text-sm space-y-2">
              <p className="font-medium">Estructura recomendada</p>
              <p className="text-muted-foreground">
                Columnas: <b>Sección</b>, <b>Pregunta</b>, <b>Tipo</b>, <b>Obligatoria</b>, <b>Opciones</b> (separadas por <code>|</code>), <b>Ayuda</b>.
                Si no está estructurado, se toma cada hoja como una sección y la primera columna como preguntas.
              </p>
              <Button variant="outline" size="sm" onClick={downloadImportTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Descargar plantilla
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>Descripción</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            <ScrollArea className="flex-1 -mx-1 px-1 border rounded-md">
              <div className="p-3 space-y-4">
                {sections.map((sec) => (
                  <div key={sec.id} className="border rounded-md p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Input
                        value={sec.title}
                        onChange={(e) => updateSection(sec.id, { title: e.target.value })}
                        className="font-medium"
                      />
                      <Badge variant="secondary">{sec.questions.length} preg.</Badge>
                      <Button size="icon" variant="ghost" onClick={() => removeSection(sec.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {sec.questions.map((q) => (
                        <div key={q.id} className="grid grid-cols-12 gap-2 items-start border-t pt-2">
                          <Textarea
                            value={q.question_text}
                            onChange={(e) => updateQuestion(sec.id, q.id, { question_text: e.target.value })}
                            className="col-span-5 min-h-[38px]"
                            rows={1}
                          />
                          <Select
                            value={q.question_type}
                            onValueChange={(v) =>
                              updateQuestion(sec.id, q.id, { question_type: v as ImportQType })
                            }
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Opciones (|)"
                            value={q.options.join(" | ")}
                            onChange={(e) =>
                              updateQuestion(sec.id, q.id, {
                                options: e.target.value.split("|").map((x) => x.trim()).filter(Boolean),
                              })
                            }
                            className="col-span-3"
                            disabled={!["single_choice", "multi_choice", "dropdown"].includes(q.question_type)}
                          />
                          <div className="col-span-1 flex items-center justify-end gap-1">
                            <label className="flex items-center gap-1 text-xs" title="Obligatoria">
                              <Checkbox
                                checked={q.is_required}
                                onCheckedChange={(c) => updateQuestion(sec.id, q.id, { is_required: !!c })}
                              />
                              <span>*</span>
                            </label>
                            <Button size="icon" variant="ghost" onClick={() => removeQuestion(sec.id, q.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => addQuestion(sec.id)}>
                        <Plus className="w-4 h-4 mr-1" /> Agregar pregunta
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addSection}>
                  <Plus className="w-4 h-4 mr-2" /> Agregar sección
                </Button>
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => setStep("upload")} disabled={saving}>
                Volver
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando…</> : "Crear encuesta"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";

interface Document {
  id: string;
  title: string;
  category: string;
  published_at: string;
  summary: string | null;
  file_url: string;
  visible_to: string[];
}

interface DocumentFormProps {
  document?: Document;
  onSuccess: () => void;
}

const categories = ["Norma", "Circular", "Resolución", "Manual", "Otro"];
const visibilityOptions = ["Administrativos", "Médicos", "Operativos", "Todos"];

const DocumentForm = ({ document, onSuccess }: DocumentFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(document?.title || "");
  const [category, setCategory] = useState(document?.category || "");
  const [publishedAt, setPublishedAt] = useState(document?.published_at || new Date().toISOString().split("T")[0]);
  const [summary, setSummary] = useState(document?.summary || "");
  const [visibleTo, setVisibleTo] = useState<string[]>(document?.visible_to || ["Todos"]);
  const [file, setFile] = useState<File | null>(null);

  const handleVisibilityChange = (option: string, checked: boolean) => {
    if (option === "Todos") {
      setVisibleTo(checked ? ["Todos"] : []);
    } else {
      if (checked) {
        setVisibleTo((prev) => [...prev.filter((v) => v !== "Todos"), option]);
      } else {
        setVisibleTo((prev) => prev.filter((v) => v !== option));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !category || !publishedAt || visibleTo.length === 0) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    if (!document && !file) {
      toast({
        title: "Error",
        description: "Por favor seleccione un archivo PDF",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let fileUrl = document?.file_url || "";

      // Upload new file if provided
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("institutional-documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("institutional-documents")
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;

        // Delete old file if updating
        if (document?.file_url) {
          const oldUrlParts = document.file_url.split("/");
          const oldFilePath = oldUrlParts.slice(-2).join("/");
          await supabase.storage.from("institutional-documents").remove([oldFilePath]);
        }
      }

      const documentData = {
        title,
        category: category as "Norma" | "Circular" | "Resolución" | "Manual" | "Otro",
        published_at: publishedAt,
        summary: summary || null,
        file_url: fileUrl,
        visible_to: visibleTo as ("Administrativos" | "Médicos" | "Operativos" | "Todos")[],
      };

      if (document) {
        // Update existing document
        const { error } = await supabase
          .from("institutional_documents")
          .update(documentData)
          .eq("id", document.id);

        if (error) throw error;

        toast({
          title: "Documento actualizado",
          description: "El documento se ha actualizado correctamente",
        });
      } else {
        // Create new document
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from("institutional_documents")
          .insert({
            ...documentData,
            created_by: user?.id,
          });

        if (error) throw error;

        toast({
          title: "Documento creado",
          description: "El documento se ha creado correctamente",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error saving document:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el documento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre del documento"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Categoría *</Label>
          <Select value={category} onValueChange={setCategory} required>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="publishedAt">Fecha de publicación *</Label>
          <Input
            id="publishedAt"
            type="date"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">Resumen</Label>
        <Textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Descripción breve del documento"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Visible para *</Label>
        <div className="grid grid-cols-2 gap-3">
          {visibilityOptions.map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                id={`visibility-${option}`}
                checked={visibleTo.includes(option)}
                onCheckedChange={(checked) => handleVisibilityChange(option, checked as boolean)}
              />
              <Label htmlFor={`visibility-${option}`} className="font-normal cursor-pointer">
                {option}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Archivo PDF {!document && "*"}</Label>
        <div className="flex items-center gap-4">
          <Input
            id="file"
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="flex-1"
          />
          {file && (
            <span className="text-sm text-muted-foreground">
              {file.name}
            </span>
          )}
        </div>
        {document && !file && (
          <p className="text-sm text-muted-foreground">
            Archivo actual: {document.file_url.split("/").pop()}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              {document ? "Actualizar" : "Crear"} Documento
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default DocumentForm;

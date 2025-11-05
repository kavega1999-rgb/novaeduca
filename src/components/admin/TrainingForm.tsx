import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import FileUploader from "./FileUploader";

const formSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres").max(200),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres").max(1000),
  type: z.enum(["capacitacion", "induccion", "entrenamiento"]),
  area_id: z.string().uuid("Selecciona un área válida"),
  duration_minutes: z.coerce.number().min(1, "La duración debe ser mayor a 0"),
  status: z.enum(["active", "draft", "archived"]),
  requires_evaluation: z.boolean().default(false),
  generates_certificate: z.boolean().default(false),
  generates_constancia: z.boolean().default(false),
});

interface TrainingFormProps {
  trainingId?: string;
  onSuccess?: () => void;
}

const TrainingForm = ({ trainingId, onSuccess }: TrainingFormProps) => {
  const { toast } = useToast();
  const [areas, setAreas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "capacitacion",
      area_id: "",
      duration_minutes: 60,
      status: "active",
      requires_evaluation: false,
      generates_certificate: false,
      generates_constancia: false,
    },
  });

  useEffect(() => {
    fetchAreas();
    if (trainingId) {
      fetchTraining();
    }
  }, [trainingId]);

  const fetchAreas = async () => {
    const { data } = await supabase.from("areas").select("*").order("name");
    if (data) setAreas(data);
  };

  const fetchTraining = async () => {
    if (!trainingId) return;
    
    const { data } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (data) {
      form.reset({
        title: data.title,
        description: data.description || "",
        type: data.type as any,
        area_id: data.area_id,
        duration_minutes: data.duration_minutes || 60,
        status: data.status as any,
        requires_evaluation: data.requires_evaluation || false,
        generates_certificate: data.generates_certificate || false,
        generates_constancia: data.generates_constancia || false,
      });
      if (data.content_url) {
        setUploadedFileUrl(data.content_url);
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let error;
      if (trainingId) {
        const updateData: any = {
          title: values.title,
          description: values.description,
          type: values.type,
          area_id: values.area_id,
          duration_minutes: values.duration_minutes,
          status: values.status,
          requires_evaluation: values.requires_evaluation,
          generates_certificate: values.generates_certificate,
          generates_constancia: values.generates_constancia,
          content_url: uploadedFileUrl || null,
        };
        
        ({ error } = await supabase
          .from("trainings")
          .update(updateData)
          .eq("id", trainingId));
      } else {
        const insertData: any = {
          title: values.title,
          description: values.description,
          type: values.type,
          area_id: values.area_id,
          duration_minutes: values.duration_minutes,
          status: values.status,
          requires_evaluation: values.requires_evaluation,
          generates_certificate: values.generates_certificate,
          generates_constancia: values.generates_constancia,
          content_url: uploadedFileUrl || null,
          created_by: user?.id,
        };
        
        ({ error } = await supabase
          .from("trainings")
          .insert([insertData]));
      }

      if (error) throw error;

      toast({
        title: trainingId ? "Capacitación actualizada" : "Capacitación creada",
        description: "Los cambios se han guardado exitosamente",
      });

      if (!trainingId) {
        form.reset();
        setUploadedFileUrl("");
      }
      
      onSuccess?.();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la capacitación",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Manejo de equipos médicos" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe el contenido de la capacitación..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="capacitacion">Capacitación</SelectItem>
                    <SelectItem value="induccion">Inducción</SelectItem>
                    <SelectItem value="entrenamiento">Entrenamiento</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="area_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Área</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el área" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="duration_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duración (minutos)</FormLabel>
                <FormControl>
                  <Input type="number" min="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="requires_evaluation"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Requiere evaluación</FormLabel>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="generates_certificate"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Genera certificado</FormLabel>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="generates_constancia"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Genera constancia</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>

        <div>
          <FormLabel>Material de Apoyo</FormLabel>
          <FileUploader 
            onUploadComplete={setUploadedFileUrl}
            currentFileUrl={uploadedFileUrl}
          />
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Guardando..." : trainingId ? "Actualizar" : "Crear Capacitación"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default TrainingForm;

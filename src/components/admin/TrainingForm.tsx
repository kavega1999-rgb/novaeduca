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

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

const formSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres").max(200),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres").max(1000),
  type: z.enum(["capacitacion", "induccion", "entrenamiento"]),
  area_id: z.string().uuid("Selecciona un área válida"),
  duration_minutes: z.coerce.number().min(1, "La duración debe ser mayor a 0"),
  total_pages: z.coerce.number().min(1, "El número de páginas debe ser mayor a 0").default(10),
  status: z.enum(["active", "draft", "archived"]),
  year: z.coerce.number().min(2020).max(2100).default(currentYear),
  requires_evaluation: z.boolean().default(false),
  generates_certificate: z.boolean().default(false),
  generates_constancia: z.boolean().default(false),
  visible_to_all: z.boolean().default(false),
  target_areas: z.array(z.enum(["medicos", "asistencial", "administrativos"])).default([]),
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
      total_pages: 10,
      status: "active",
      year: currentYear,
      requires_evaluation: false,
      generates_certificate: false,
      generates_constancia: false,
      visible_to_all: false,
      target_areas: [],
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
    
    // Fetch target areas for this training
    const { data: targetAreasData } = await supabase
      .from("training_target_areas")
      .select("target_area")
      .eq("training_id", trainingId);

    if (data) {
      form.reset({
        title: data.title,
        description: data.description || "",
        type: data.type as any,
        area_id: data.area_id,
        duration_minutes: data.duration_minutes || 60,
        total_pages: data.total_pages || 10,
        status: data.status as any,
        year: data.year || currentYear,
        requires_evaluation: data.requires_evaluation || false,
        generates_certificate: data.generates_certificate || false,
        generates_constancia: data.generates_constancia || false,
        visible_to_all: data.visible_to_all || false,
        target_areas: targetAreasData?.map(ta => ta.target_area) || [],
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
      
      let trainingError;
      let savedTrainingId = trainingId;
      
      if (trainingId) {
        const updateData: any = {
          title: values.title,
          description: values.description,
          type: values.type,
          area_id: values.area_id,
          duration_minutes: values.duration_minutes,
          total_pages: values.total_pages,
          status: values.status,
          year: values.year,
          requires_evaluation: values.requires_evaluation,
          generates_certificate: values.generates_certificate,
          generates_constancia: values.generates_constancia,
          visible_to_all: values.visible_to_all,
          content_url: uploadedFileUrl || null,
        };
        
        ({ error: trainingError } = await supabase
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
          total_pages: values.total_pages,
          status: values.status,
          year: values.year,
          requires_evaluation: values.requires_evaluation,
          generates_certificate: values.generates_certificate,
          generates_constancia: values.generates_constancia,
          visible_to_all: values.visible_to_all,
          content_url: uploadedFileUrl || null,
          created_by: user?.id,
        };
        
        const { data: newTraining, error } = await supabase
          .from("trainings")
          .insert([insertData])
          .select()
          .single();
        
        trainingError = error;
        if (newTraining) savedTrainingId = newTraining.id;
      }

      if (trainingError) throw trainingError;
      
      // Update target areas if not visible to all
      if (savedTrainingId && !values.visible_to_all) {
        // Delete existing target areas
        await supabase
          .from("training_target_areas")
          .delete()
          .eq("training_id", savedTrainingId);
        
        // Insert new target areas
        if (values.target_areas.length > 0) {
          const targetAreasData = values.target_areas.map(area => ({
            training_id: savedTrainingId,
            target_area: area,
          }));
          
          const { error: targetAreasError } = await supabase
            .from("training_target_areas")
            .insert(targetAreasData);
          
          if (targetAreasError) throw targetAreasError;
        }
      } else if (savedTrainingId && values.visible_to_all) {
        // If visible to all, delete any target areas
        await supabase
          .from("training_target_areas")
          .delete()
          .eq("training_id", savedTrainingId);
      }

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
            name="total_pages"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total de páginas</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    {...field} 
                    className="bg-muted/50"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Se detecta automáticamente al subir un PDF</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Año</FormLabel>
                <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el año" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
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
          
          <FormField
            control={form.control}
            name="visible_to_all"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Visible para todos los usuarios</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>

        {!form.watch("visible_to_all") && (
          <FormField
            control={form.control}
            name="target_areas"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirigida a las siguientes áreas</FormLabel>
                <div className="space-y-2">
                  {["medicos", "asistencial", "administrativos"].map((area) => (
                    <FormItem key={area} className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(area as any)}
                          onCheckedChange={(checked) => {
                            const newValue = checked
                              ? [...(field.value || []), area]
                              : (field.value || []).filter((value: string) => value !== area);
                            field.onChange(newValue);
                          }}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        {area === "medicos" ? "Médicos" : area === "asistencial" ? "Asistencial" : "Administrativos"}
                      </FormLabel>
                    </FormItem>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div>
          <FormLabel>Material de Apoyo</FormLabel>
          <FileUploader 
            onUploadComplete={(url, pageCount) => {
              setUploadedFileUrl(url);
              if (pageCount) {
                form.setValue("total_pages", pageCount);
              }
            }}
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

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import TrainingsTable from "@/components/admin/TrainingsTable";
import TrainingForm from "@/components/admin/TrainingForm";
import EvaluationManager from "@/components/evaluations/EvaluationManager";
import { BookOpen, Plus, ArrowLeft, FileText, Settings2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface TrainingDetail {
  id: string;
  title: string;
  content_url: string | null;
  requires_evaluation: boolean | null;
}

const AdminTrainings = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("list");
  const [editingTraining, setEditingTraining] = useState<TrainingDetail | null>(null);
  const [editSubTab, setEditSubTab] = useState("general");

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleTrainingCreated = () => {
    handleRefresh();
    setActiveTab("list");
  };

  const handleEdit = async (trainingId: string) => {
    const { data } = await supabase
      .from("trainings")
      .select("id, title, content_url, requires_evaluation")
      .eq("id", trainingId)
      .single();

    if (data) {
      setEditingTraining(data);
      setEditSubTab("general");
      setActiveTab("edit");
    }
  };

  const handleBackToList = () => {
    setEditingTraining(null);
    setActiveTab("list");
    handleRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestionar Capacitaciones</h1>
        <p className="text-muted-foreground mt-2">
          Crea, edita y administra las capacitaciones del sistema
        </p>
      </div>

      {activeTab === "edit" && editingTraining ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al listado
            </Button>
            <div>
              <h2 className="text-xl font-semibold">{editingTraining.title}</h2>
              <p className="text-sm text-muted-foreground">Configuración completa de la capacitación</p>
            </div>
          </div>

          <Tabs value={editSubTab} onValueChange={setEditSubTab} className="w-full">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Contenido
              </TabsTrigger>
              <TabsTrigger value="evaluation" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Evaluación
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-6">
              <div className="max-w-2xl">
                <TrainingForm
                  trainingId={editingTraining.id}
                  onSuccess={() => {
                    // Refresh the training detail
                    handleEdit(editingTraining.id);
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="content" className="mt-6">
              <div className="max-w-2xl">
                <div className="rounded-lg border bg-card p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Material de Contenido</h3>
                  <p className="text-sm text-muted-foreground">
                    El contenido de la capacitación se gestiona desde la pestaña "General" en la sección de Material de Apoyo. 
                    Si deseas ver cómo se visualiza el contenido, accede a la capacitación desde la vista de usuario.
                  </p>
                  {editingTraining.content_url ? (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-primary">Contenido cargado</span>
                      <a 
                        href={editingTraining.content_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline ml-2"
                      >
                        Ver archivo
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No hay contenido cargado. Ve a la pestaña "General" para subir un archivo.
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evaluation" className="mt-6">
              <EvaluationManager
                trainingId={editingTraining.id}
                trainingTitle={editingTraining.title}
                contentUrl={editingTraining.content_url || undefined}
              />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Ver Capacitaciones
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Crear Nueva
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <TrainingsTable key={refreshKey} onRefresh={handleRefresh} onEdit={handleEdit} />
          </TabsContent>

          <TabsContent value="create" className="mt-6">
            <div className="max-w-2xl">
              <TrainingForm onSuccess={handleTrainingCreated} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default AdminTrainings;

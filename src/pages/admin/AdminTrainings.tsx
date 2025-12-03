import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TrainingsTable from "@/components/admin/TrainingsTable";
import TrainingForm from "@/components/admin/TrainingForm";
import { BookOpen, Plus } from "lucide-react";

const AdminTrainings = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("list");

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleTrainingCreated = () => {
    handleRefresh();
    setActiveTab("list");
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

      {/* Tabs */}
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
          <TrainingsTable key={refreshKey} onRefresh={handleRefresh} />
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <div className="max-w-2xl">
            <TrainingForm onSuccess={handleTrainingCreated} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminTrainings;

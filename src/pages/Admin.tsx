import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import TrainingForm from "@/components/admin/TrainingForm";
import TrainingsTable from "@/components/admin/TrainingsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user has admin or leader role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAccess = roles?.some(r => r.role === "admin" || r.role === "leader");

      if (!hasAccess) {
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos para acceder a esta página",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      const role = roles?.find(r => r.role === "admin")?.role || "leader";
      setUserRole(role);
      setIsLoading(false);
    };

    checkAccess();
  }, [navigate, toast]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole || undefined} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Panel de Administración</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona las capacitaciones y materiales de apoyo
          </p>
        </div>

        <Card className="p-6">
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="list">Ver Capacitaciones</TabsTrigger>
              <TabsTrigger value="create">Crear Nueva</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="mt-6">
              <TrainingsTable key={refreshKey} onRefresh={handleRefresh} />
            </TabsContent>
            
            <TabsContent value="create" className="mt-6">
              <TrainingForm onSuccess={handleRefresh} />
            </TabsContent>
          </Tabs>
        </Card>
      </main>
    </div>
  );
};

export default Admin;

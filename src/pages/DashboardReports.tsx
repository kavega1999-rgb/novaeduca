import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import TrainingReports from "@/components/admin/TrainingReports";
import { useToast } from "@/hooks/use-toast";

const DashboardReports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

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

      setIsLoading(false);
    };

    checkAccess();
  }, [navigate, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando reportes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Capacitaciones y Progreso</h1>
        <p className="text-muted-foreground text-sm">
          Estado global, completadas, iniciadas, no iniciadas y gráficos de progreso
        </p>
      </div>
      
      <TrainingReports />
    </div>
  );
};

export default DashboardReports;

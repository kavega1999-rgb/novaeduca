import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import DocumentsList from "@/components/documents/DocumentsList";
import DocumentForm from "@/components/documents/DocumentForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

const Documents = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const adminRole = roles?.some(r => r.role === "admin");
      setIsAdmin(adminRole || false);
      setUserRole(roles?.[0]?.role || "user");
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleDocumentCreated = () => {
    setDialogOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Documentos Institucionales</h1>
            <p className="text-muted-foreground mt-2">
              Accede a normas, circulares, resoluciones y manuales de la organización
            </p>
          </div>
          
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Documento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Documento</DialogTitle>
                </DialogHeader>
                <DocumentForm onSuccess={handleDocumentCreated} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        <DocumentsList key={refreshKey} isAdmin={isAdmin} onRefresh={() => setRefreshKey(prev => prev + 1)} />
      </main>
    </div>
  );
};

export default Documents;

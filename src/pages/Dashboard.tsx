import { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import FAQ from "@/components/FAQ";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WelcomeHero } from "@/components/dashboard/WelcomeHero";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { TrainingsFolders } from "@/components/dashboard/TrainingsFolders";
import { CertificatesList } from "@/components/profile/CertificatesList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowRight, Sparkles } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState<string>("");
  const [isAdminOrLeader, setIsAdminOrLeader] = useState(false);
  const [stats, setStats] = useState({
    totalTrainings: 0,
    completedTrainings: 0,
    inProgress: 0,
    averageProgress: 0,
  });
  const [loading, setLoading] = useState(true);

  const isSubRoute = location.pathname === "/dashboard/reports" || location.pathname === "/dashboard/users";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Fetch user roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const hasAdminAccess = roles?.some(r => r.role === "admin" || r.role === "leader");
      setIsAdminOrLeader(hasAdminAccess || false);
      
      if (roles && roles.length > 0) {
        const role = roles.find(r => r.role === "admin")?.role || roles[0].role;
        setUserRole(role);
      }

      // Fetch user stats
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", session.user.id);

      if (progressData) {
        const completed = progressData.filter(p => p.status === "completed").length;
        const inProgress = progressData.filter(p => p.status === "in_progress").length;
        const avgProgress = progressData.length > 0
          ? progressData.reduce((acc, p) => acc + (p.progress_percentage || 0), 0) / progressData.length
          : 0;

        setStats({
          totalTrainings: progressData.length,
          completedTrainings: completed,
          inProgress,
          averageProgress: Math.round(avgProgress),
        });
      }

      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation userRole={userRole} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-muted-foreground">Cargando...</div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard content component to avoid duplication
  const DashboardContent = () => (
    <div className="space-y-8">
      {/* Welcome Hero */}
      <WelcomeHero />

      {/* Quick Stats */}
      <QuickStats {...stats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trainings Section - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Mis Capacitaciones</h2>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/trainings")}
              className="text-primary hover:text-primary hover:bg-primary/10"
            >
              Ver todas
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          <TrainingsFolders />
        </div>

        {/* Sidebar Content - Takes 1 column */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Acceso Rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                onClick={() => navigate("/trainings")}
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Explorar Capacitaciones
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                onClick={() => navigate("/documents")}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Documentos Institucionales
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                onClick={() => navigate("/profile")}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Mi Perfil
              </Button>
            </CardContent>
          </Card>

          {/* Certificates */}
          <CertificatesList />
        </div>
      </div>

      {/* FAQ Section */}
      <FAQ />
    </div>
  );

  // If admin/leader and on a sub-route, show with sidebar
  if (isAdminOrLeader && isSubRoute) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation userRole={userRole} />
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-[calc(100vh-64px)] w-full">
            <AdminSidebar />
            <main className="flex-1 overflow-auto">
              <div className="container mx-auto px-6 py-8">
                <div className="mb-6 flex items-center gap-2">
                  <SidebarTrigger className="h-8 w-8" />
                  <div className="h-6 w-px bg-border" />
                  <h1 className="text-2xl font-bold">Panel de Administración</h1>
                </div>
                <Outlet />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </div>
    );
  }

  // Admin/Leader dashboard with sidebar
  if (isAdminOrLeader) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation userRole={userRole} />
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-[calc(100vh-64px)] w-full">
            <AdminSidebar />
            <main className="flex-1 overflow-auto">
              <div className="container mx-auto px-6 py-8">
                <div className="mb-6 flex items-center gap-2">
                  <SidebarTrigger className="h-8 w-8" />
                  <div className="h-6 w-px bg-border" />
                  <h1 className="text-2xl font-bold">Panel Principal</h1>
                </div>
                <DashboardContent />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </div>
    );
  }

  // Regular user dashboard
  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      <div className="container mx-auto px-4 py-8">
        <DashboardContent />
      </div>
    </div>
  );
};

export default Dashboard;

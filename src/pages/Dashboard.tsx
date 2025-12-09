import { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import FloatingFAQChat from "@/components/FloatingFAQChat";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Heart, Leaf, Activity, Users, Monitor, ArrowRight, BookOpen, Award, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CertificatesList } from "@/components/profile/CertificatesList";

import FloatingDocumentsButton from "@/components/documents/FloatingDocumentsButton";
import heroImage from "@/assets/team-celebration.jpg";

const iconMap: Record<string, any> = {
  shield: Shield,
  heart: Heart,
  leaf: Leaf,
  activity: Activity,
  users: Users,
  monitor: Monitor,
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [areas, setAreas] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [isAdminOrLeader, setIsAdminOrLeader] = useState(false);
  const [stats, setStats] = useState({
    totalTrainings: 0,
    completedTrainings: 0,
    inProgress: 0,
    averageProgress: 0,
  });
  const [loading, setLoading] = useState(true);

  const isSubRoute = ["/dashboard/reports", "/dashboard/users", "/dashboard/trainings", "/dashboard/overview", "/dashboard/adherence", "/dashboard/attendance", "/dashboard/certificates"].includes(location.pathname);

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

      // Fetch areas
      const { data: areasData } = await supabase
        .from("areas")
        .select("*")
        .order("name");

      if (areasData) {
        setAreas(areasData);
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
          ? progressData.reduce((acc, p) => acc + p.progress_percentage, 0) / progressData.length
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation userRole={userRole} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Cargando...</div>
        </div>
      </div>
    );
  }

  // If admin/leader and on a sub-route, show with sidebar
  if (isAdminOrLeader && isSubRoute) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation userRole={userRole} />
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] w-full">
            <AdminSidebar />
            <main className="flex-1 overflow-auto">
              <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">
                <div className="mb-4 md:mb-6 flex items-center gap-2">
                  <SidebarTrigger className="h-8 w-8" />
                  <div className="h-6 w-px bg-border hidden md:block" />
                  <h1 className="text-lg md:text-2xl font-bold">Panel de Administración</h1>
                </div>
                <Outlet />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </div>
    );
  }

  // Default dashboard view
  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      
      {isAdminOrLeader && (
        <>
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] w-full">
            <AdminSidebar />
            <main className="flex-1 overflow-auto">
              <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">
                <div className="mb-4 md:mb-6 flex items-center gap-2">
                  <SidebarTrigger className="h-8 w-8" />
                  <div className="h-6 w-px bg-border hidden md:block" />
                  <h1 className="text-lg md:text-2xl font-bold">Panel Principal</h1>
                </div>
                
                {/* Hero Section */}
                <div className="mb-6 md:mb-8 rounded-xl md:rounded-2xl overflow-hidden relative h-[200px] md:h-[400px] shadow-lg">
                  <img 
                    src={heroImage} 
                    alt="Equipo médico Novasalud" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/75 to-primary-glow/60 flex items-center">
                    <div className="container mx-auto px-4 md:px-8">
                      <h2 className="text-xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4">
                        Bienvenido a tu Centro de Aprendizaje
                      </h2>
                      <p className="text-sm md:text-xl text-white/95 max-w-2xl">
                        Desarrolla tus habilidades y mantente actualizado con nuestras capacitaciones profesionales de salud
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
                  <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
                      <CardDescription className="text-xs md:text-sm">Total Capacitaciones</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 md:p-6 pt-0">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                          <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                        <span className="text-xl md:text-3xl font-bold text-primary">{stats.totalTrainings}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
                      <CardDescription className="text-xs md:text-sm">Completadas</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 md:p-6 pt-0">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                          <Award className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                        <span className="text-xl md:text-3xl font-bold text-primary">{stats.completedTrainings}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
                      <CardDescription className="text-xs md:text-sm">En Progreso</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 md:p-6 pt-0">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                          <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                        <span className="text-xl md:text-3xl font-bold text-primary">{stats.inProgress}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
                      <CardDescription className="text-xs md:text-sm">Progreso Promedio</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 md:p-6 pt-0">
                      <div className="space-y-1 md:space-y-2">
                        <div className="text-xl md:text-3xl font-bold text-primary">{stats.averageProgress}%</div>
                        <Progress value={stats.averageProgress} className="h-1.5 md:h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Certificates Section */}
                <div className="mb-6 md:mb-8">
                  <CertificatesList />
                </div>

                {/* Areas Section */}
                <div className="mb-4 md:mb-6">
                  <h2 className="text-lg md:text-2xl font-bold text-foreground mb-4 md:mb-6">Áreas de Capacitación</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {areas.map((area) => {
                    const Icon = iconMap[area.icon] || BookOpen;
                    
                    return (
                      <Card 
                        key={area.id} 
                        className="group cursor-pointer transition-all hover:scale-105 hover:shadow-hover bg-gradient-to-br from-card to-muted/20"
                        style={{ boxShadow: "var(--shadow-card)" }}
                        onClick={() => navigate(`/trainings?area=${area.id}`)}
                      >
                        <CardHeader className="p-4 md:p-6">
                          <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center mb-2 md:mb-3 shadow-lg">
                            <Icon className="w-5 h-5 md:w-7 md:h-7 text-white" />
                          </div>
                          <CardTitle className="text-base md:text-xl">{area.name}</CardTitle>
                          <CardDescription className="text-xs md:text-sm">{area.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 pt-0">
                          <Button 
                            variant="ghost" 
                            className="w-full justify-between group-hover:bg-primary/10 group-hover:text-primary transition-colors text-sm md:text-base"
                          >
                            Ver capacitaciones
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

              </div>
            </main>
          </div>
        </SidebarProvider>
        <FloatingDocumentsButton isAdmin={true} />
        </>
      )}

      {!isAdminOrLeader && (
        <>
        <div className="container mx-auto px-4 py-4 md:py-8">
          {/* Hero Section */}
          <div className="mb-6 md:mb-8 rounded-xl md:rounded-2xl overflow-hidden relative h-[200px] md:h-[400px]">
            <img 
              src={heroImage} 
              alt="Equipo médico Novasalud" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/70 flex items-center">
              <div className="container mx-auto px-4 md:px-8">
                <h1 className="text-xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4">
                  Bienvenido a tu Centro de Aprendizaje
                </h1>
                <p className="text-sm md:text-xl text-white/90 max-w-2xl">
                  Desarrolla tus habilidades y mantente actualizado con nuestras capacitaciones profesionales de salud
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20" style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
                <CardDescription className="text-xs md:text-sm">Total Capacitaciones</CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  <span className="text-xl md:text-3xl font-bold text-primary">{stats.totalTrainings}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20" style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
                <CardDescription className="text-xs md:text-sm">Completadas</CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  <span className="text-xl md:text-3xl font-bold text-primary">{stats.completedTrainings}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20" style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
                <CardDescription className="text-xs md:text-sm">En Progreso</CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  <span className="text-xl md:text-3xl font-bold text-primary">{stats.inProgress}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20" style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
                <CardDescription className="text-xs md:text-sm">Progreso Promedio</CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="space-y-1 md:space-y-2">
                  <div className="text-xl md:text-3xl font-bold text-primary">{stats.averageProgress}%</div>
                  <Progress value={stats.averageProgress} className="h-1.5 md:h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Certificates Section */}
          <div className="mb-6 md:mb-8">
            <CertificatesList />
          </div>

          {/* Areas Section */}
          <div className="mb-4">
            <h2 className="text-lg md:text-2xl font-bold text-foreground mb-4 md:mb-6">Áreas de Capacitación</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {areas.map((area) => {
              const Icon = iconMap[area.icon] || BookOpen;
              
              return (
                <Card 
                  key={area.id} 
                  className="group cursor-pointer transition-all hover:scale-105"
                  style={{ boxShadow: "var(--shadow-card)" }}
                  onClick={() => navigate(`/trainings?area=${area.id}`)}
                >
                  <CardHeader className="p-4 md:p-6">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-${area.color}-100 dark:bg-${area.color}-900/20 flex items-center justify-center mb-2 md:mb-3`}>
                      <Icon className={`w-5 h-5 md:w-6 md:h-6 text-${area.color}-600 dark:text-${area.color}-400`} />
                    </div>
                    <CardTitle className="text-base md:text-xl">{area.name}</CardTitle>
                    <CardDescription className="text-xs md:text-sm">{area.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 pt-0">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between group-hover:bg-primary/10 transition-colors text-sm md:text-base"
                    >
                      Ver capacitaciones
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

        </div>
        <FloatingDocumentsButton isAdmin={false} />
        </>
      )}

      <FloatingFAQChat />
    </div>
  );
};

export default Dashboard;

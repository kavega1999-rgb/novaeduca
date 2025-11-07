import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Heart, Leaf, Activity, Users, Monitor, ArrowRight, BookOpen, Award, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CertificatesList } from "@/components/profile/CertificatesList";

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
  const { toast } = useToast();
  const [areas, setAreas] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [stats, setStats] = useState({
    totalTrainings: 0,
    completedTrainings: 0,
    inProgress: 0,
    averageProgress: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Fetch user profile and role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8 p-8 rounded-2xl" style={{ background: "var(--gradient-hero)" }}>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Bienvenido a tu Centro de Aprendizaje
          </h1>
          <p className="text-lg text-muted-foreground">
            Desarrolla tus habilidades y mantente actualizado con nuestras capacitaciones
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader className="pb-3">
              <CardDescription>Total Capacitaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <span className="text-3xl font-bold">{stats.totalTrainings}</span>
              </div>
            </CardContent>
          </Card>

          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader className="pb-3">
              <CardDescription>Completadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-secondary" />
                <span className="text-3xl font-bold">{stats.completedTrainings}</span>
              </div>
            </CardContent>
          </Card>

          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader className="pb-3">
              <CardDescription>En Progreso</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                <span className="text-3xl font-bold">{stats.inProgress}</span>
              </div>
            </CardContent>
          </Card>

          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader className="pb-3">
              <CardDescription>Progreso Promedio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{stats.averageProgress}%</div>
                <Progress value={stats.averageProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Certificates Section */}
        <div className="mb-8">
          <CertificatesList />
        </div>

        {/* Areas Section */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-foreground mb-6">Áreas de Capacitación</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {areas.map((area) => {
            const Icon = iconMap[area.icon] || BookOpen;
            
            return (
              <Card 
                key={area.id} 
                className="group cursor-pointer transition-all hover:scale-105"
                style={{ boxShadow: "var(--shadow-card)" }}
                onClick={() => navigate(`/trainings?area=${area.id}`)}
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl bg-${area.color}-100 dark:bg-${area.color}-900/20 flex items-center justify-center mb-3`}>
                    <Icon className={`w-6 h-6 text-${area.color}-600 dark:text-${area.color}-400`} />
                  </div>
                  <CardTitle className="text-xl">{area.name}</CardTitle>
                  <CardDescription>{area.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between group-hover:bg-primary/10 transition-colors"
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
    </div>
  );
};

export default Dashboard;

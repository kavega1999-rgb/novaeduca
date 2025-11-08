import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, BookOpen, Award, PlayCircle } from "lucide-react";

const Trainings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const areaId = searchParams.get("area");
  
  const [trainings, setTrainings] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>(areaId || "all");
  const [userRole, setUserRole] = useState<string>("");
  const [userArea, setUserArea] = useState<string>("");
  const [userProgress, setUserProgress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Fetch user role and area
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, area")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);
        setUserArea(profile.area || "");
      }

      // Fetch areas
      const { data: areasData } = await supabase
        .from("areas")
        .select("*")
        .order("name");

      if (areasData) {
        setAreas(areasData);
      }

      // Fetch user progress
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", session.user.id);

      if (progressData) {
        const progressMap = progressData.reduce((acc, p) => {
          acc[p.training_id] = p;
          return acc;
        }, {} as Record<string, any>);
        setUserProgress(progressMap);
      }

      fetchTrainings(selectedArea);
    };

    checkAuth();
  }, [navigate, selectedArea]);

  const fetchTrainings = async (areaFilter: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("area, role")
      .eq("id", session.user.id)
      .single();
    
    const userArea = profile?.area;
    const userRole = profile?.role;
    
    let query = supabase
      .from("trainings")
      .select(`
        *,
        areas (
          name,
          color,
          icon
        )
      `)
      .eq("status", "active")
      .order("published_at", { ascending: false });

    if (areaFilter !== "all") {
      query = query.eq("area_id", areaFilter);
    }

    const { data: allTrainings } = await query;
    
    if (allTrainings) {
      // If user is admin or leader, show all trainings
      if (userRole === 'admin' || userRole === 'leader') {
        setTrainings(allTrainings);
      } else {
        // Filter trainings based on user area
        const visibleTrainings = await Promise.all(
          allTrainings.map(async (training) => {
            // If training is visible to all, include it
            if (training.visible_to_all) {
              return training;
            }
            
            // Check if user's area is in the target areas
            const { data: targetAreas } = await supabase
              .from("training_target_areas")
              .select("target_area")
              .eq("training_id", training.id);
            
            if (targetAreas && targetAreas.some(ta => ta.target_area === userArea)) {
              return training;
            }
            
            return null;
          })
        );
        
        // Filter out null values (trainings not visible to user)
        setTrainings(visibleTrainings.filter(t => t !== null));
      }
    }
    setLoading(false);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      capacitacion: "Capacitación",
      curso: "Curso",
      socializacion: "Socialización",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      capacitacion: "bg-primary",
      curso: "bg-secondary",
      socializacion: "bg-accent",
    };
    return colors[type] || "bg-muted";
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation userRole={userRole} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Cargando capacitaciones...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Capacitaciones</h1>
            <p className="text-muted-foreground">Explora y completa tus programas de formación</p>
          </div>
          
          <div className="w-full md:w-64">
            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {trainings.length === 0 ? (
          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">
                No hay capacitaciones disponibles en esta área
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trainings.map((training) => {
              const progress = userProgress[training.id];
              const progressPercentage = progress?.progress_percentage || 0;
              const status = progress?.status || "pending";

              return (
                <Card 
                  key={training.id}
                  className="group hover:scale-105 transition-all cursor-pointer"
                  style={{ boxShadow: "var(--shadow-card)" }}
                  onClick={() => navigate(`/training/${training.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={`${getTypeColor(training.type)} text-white`}>
                        {getTypeLabel(training.type)}
                      </Badge>
                      {training.generates_certificate && (
                        <Award className="w-5 h-5 text-secondary" />
                      )}
                    </div>
                    <CardTitle className="text-xl line-clamp-2">{training.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {training.description || "Sin descripción"}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{training.duration_minutes || 30} minutos</span>
                      </div>
                      
                      {status !== "pending" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progreso</span>
                            <span className="font-medium">{progressPercentage}%</span>
                          </div>
                          <Progress value={progressPercentage} className="h-2" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      variant={status === "pending" ? "default" : "outline"}
                    >
                      <PlayCircle className="w-4 h-4 mr-2" />
                      {status === "completed" ? "Revisar" : status === "in_progress" ? "Continuar" : "Comenzar"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Trainings;

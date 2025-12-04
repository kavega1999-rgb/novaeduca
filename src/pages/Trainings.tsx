import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import FloatingDocumentsButton from "@/components/documents/FloatingDocumentsButton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, BookOpen, Award, PlayCircle, Folder, ChevronDown, ChevronRight } from "lucide-react";

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
  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>({});
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({});

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
      .order("year", { ascending: false })
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
        const filtered = visibleTrainings.filter(t => t !== null);
        setTrainings(filtered);
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

  // Group trainings by area, then by year
  const trainingsByAreaAndYear = trainings.reduce((acc, training) => {
    const areaName = training.areas?.name || "Sin área";
    const areaId = training.area_id;
    const year = training.year || new Date().getFullYear();
    
    if (!acc[areaId]) {
      acc[areaId] = {
        name: areaName,
        color: training.areas?.color,
        icon: training.areas?.icon,
        years: {}
      };
    }
    
    if (!acc[areaId].years[year]) {
      acc[areaId].years[year] = [];
    }
    acc[areaId].years[year].push(training);
    return acc;
  }, {} as Record<string, { name: string; color: string | null; icon: string | null; years: Record<number, any[]> }>);

  // Sort areas by name
  const sortedAreaIds = Object.keys(trainingsByAreaAndYear).sort((a, b) => 
    trainingsByAreaAndYear[a].name.localeCompare(trainingsByAreaAndYear[b].name)
  );

  const toggleArea = (areaId: string) => {
    setOpenAreas(prev => ({ ...prev, [areaId]: !prev[areaId] }));
  };

  const toggleYear = (areaId: string, year: number) => {
    const key = `${areaId}-${year}`;
    setOpenYears(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Count trainings per area
  const getAreaTrainingCount = (areaId: string): number => {
    const areaData = trainingsByAreaAndYear[areaId];
    let count = 0;
    Object.values(areaData.years).forEach((yearTrainings: any[]) => {
      count += yearTrainings.length;
    });
    return count;
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
          <div className="space-y-4">
            {sortedAreaIds.map((areaId) => {
              const areaData = trainingsByAreaAndYear[areaId];
              const sortedYears = Object.keys(areaData.years)
                .map(Number)
                .sort((a, b) => b - a);
              
              return (
                <Collapsible
                  key={areaId}
                  open={openAreas[areaId]}
                  onOpenChange={() => toggleArea(areaId)}
                >
                  <CollapsibleTrigger asChild>
                    <Card 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      style={{ boxShadow: "var(--shadow-card)" }}
                    >
                      <CardHeader className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Folder className="w-6 h-6 text-primary" />
                            <CardTitle className="text-xl">{areaData.name}</CardTitle>
                            <Badge variant="secondary">
                              {getAreaTrainingCount(areaId)} capacitación{getAreaTrainingCount(areaId) !== 1 ? 'es' : ''}
                            </Badge>
                          </div>
                          {openAreas[areaId] ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="space-y-3 mt-3 pl-4 border-l-2 border-primary/20 ml-3">
                      {sortedYears.map((year) => {
                        const yearKey = `${areaId}-${year}`;
                        const yearTrainings = areaData.years[year];
                        
                        return (
                          <Collapsible
                            key={yearKey}
                            open={openYears[yearKey]}
                            onOpenChange={() => toggleYear(areaId, year)}
                          >
                            <CollapsibleTrigger asChild>
                              <Card 
                                className="cursor-pointer hover:bg-muted/30 transition-colors"
                                style={{ boxShadow: "var(--shadow-card)" }}
                              >
                                <CardHeader className="py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <Folder className="w-5 h-5 text-secondary" />
                                      <span className="font-semibold text-lg">{year}</span>
                                      <Badge variant="outline">
                                        {yearTrainings.length} capacitación{yearTrainings.length !== 1 ? 'es' : ''}
                                      </Badge>
                                    </div>
                                    {openYears[yearKey] ? (
                                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </CardHeader>
                              </Card>
                            </CollapsibleTrigger>
                            
                            <CollapsibleContent>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 pl-4 border-l-2 border-secondary/20 ml-3">
                                {yearTrainings.map((training: any) => {
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
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
      <FloatingDocumentsButton isAdmin={userRole === "admin" || userRole === "leader"} />
    </div>
  );
};

export default Trainings;
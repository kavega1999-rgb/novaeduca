import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Folder, FolderOpen, BookOpen, ChevronRight, Clock, CheckCircle2, PlayCircle } from "lucide-react";

interface Training {
  id: string;
  title: string;
  description: string | null;
  year: number;
  status: string;
  duration_minutes: number | null;
  areas: { name: string } | null;
}

interface UserProgress {
  training_id: string;
  status: string;
  progress_percentage: number;
}

interface TrainingsByYear {
  [year: number]: Training[];
}

export const TrainingsFolders = () => {
  const navigate = useNavigate();
  const [trainingsByYear, setTrainingsByYear] = useState<TrainingsByYear>({});
  const [userProgress, setUserProgress] = useState<Map<string, UserProgress>>(new Map());
  const [openFolders, setOpenFolders] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchTrainings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch user's area
    const { data: profile } = await supabase
      .from("profiles")
      .select("area")
      .eq("id", user.id)
      .single();

    // Fetch trainings visible to user
    let query = supabase
      .from("trainings")
      .select(`
        id,
        title,
        description,
        year,
        status,
        duration_minutes,
        areas (name)
      `)
      .eq("status", "active")
      .order("year", { ascending: false })
      .order("published_at", { ascending: false });

    const { data: trainings } = await query;

    // Fetch user progress
    const { data: progress } = await supabase
      .from("user_progress")
      .select("training_id, status, progress_percentage")
      .eq("user_id", user.id);

    if (progress) {
      const progressMap = new Map<string, UserProgress>();
      progress.forEach(p => progressMap.set(p.training_id, p));
      setUserProgress(progressMap);
    }

    // Group by year
    if (trainings) {
      const grouped: TrainingsByYear = {};
      trainings.forEach(training => {
        if (!grouped[training.year]) {
          grouped[training.year] = [];
        }
        grouped[training.year].push(training);
      });
      setTrainingsByYear(grouped);

      // Open current year folder by default
      const currentYear = new Date().getFullYear();
      if (grouped[currentYear]) {
        setOpenFolders(new Set([currentYear]));
      }
    }

    setLoading(false);
  };

  const toggleFolder = (year: number) => {
    setOpenFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
      } else {
        newSet.add(year);
      }
      return newSet;
    });
  };

  const getProgressStatus = (trainingId: string) => {
    const progress = userProgress.get(trainingId);
    if (!progress) return { status: "not_started", percentage: 0 };
    return { status: progress.status, percentage: progress.progress_percentage };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Completado</Badge>;
      case "in_progress":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20"><PlayCircle className="w-3 h-3 mr-1" />En progreso</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const years = Object.keys(trainingsByYear).map(Number).sort((a, b) => b - a);

  if (years.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No hay capacitaciones disponibles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {years.map(year => {
        const isOpen = openFolders.has(year);
        const trainings = trainingsByYear[year];
        const completedCount = trainings.filter(t => getProgressStatus(t.id).status === "completed").length;

        return (
          <Collapsible key={year} open={isOpen} onOpenChange={() => toggleFolder(year)}>
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                        {isOpen ? (
                          <FolderOpen className="w-6 h-6 text-primary" />
                        ) : (
                          <Folder className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Capacitaciones {year}</h3>
                        <p className="text-sm text-muted-foreground">
                          {trainings.length} {trainings.length === 1 ? "capacitación" : "capacitaciones"} • {completedCount} completadas
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:block w-32">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Progreso</span>
                          <span>{Math.round((completedCount / trainings.length) * 100)}%</span>
                        </div>
                        <Progress value={(completedCount / trainings.length) * 100} className="h-2" />
                      </div>
                      <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="pl-6 mt-2 space-y-2">
              {trainings.map(training => {
                const { status, percentage } = getProgressStatus(training.id);
                
                return (
                  <Card 
                    key={training.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 hover:bg-muted/30"
                    onClick={() => navigate(`/training/${training.id}`)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-secondary/50 mt-0.5">
                            <BookOpen className="w-4 h-4 text-secondary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">{training.title}</h4>
                            {training.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{training.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {training.areas && (
                                <Badge variant="secondary" className="text-xs">{training.areas.name}</Badge>
                              )}
                              {training.duration_minutes && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {training.duration_minutes} min
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(status)}
                          {status === "in_progress" && (
                            <div className="w-20">
                              <Progress value={percentage} className="h-1.5" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
};

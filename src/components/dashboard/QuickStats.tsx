import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Award, Clock, TrendingUp } from "lucide-react";

interface QuickStatsProps {
  totalTrainings: number;
  completedTrainings: number;
  inProgress: number;
  averageProgress: number;
}

export const QuickStats = ({ totalTrainings, completedTrainings, inProgress, averageProgress }: QuickStatsProps) => {
  const stats = [
    {
      label: "Total Capacitaciones",
      value: totalTrainings,
      icon: BookOpen,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-600",
    },
    {
      label: "Completadas",
      value: completedTrainings,
      icon: Award,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-500/10",
      textColor: "text-green-600",
    },
    {
      label: "En Progreso",
      value: inProgress,
      icon: Clock,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-500/10",
      textColor: "text-orange-600",
    },
    {
      label: "Progreso Promedio",
      value: `${averageProgress}%`,
      icon: TrendingUp,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-500/10",
      textColor: "text-purple-600",
      showProgress: true,
      progressValue: averageProgress,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card 
          key={index} 
          className="relative overflow-hidden border-0 bg-gradient-to-br from-card to-muted/30"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-5 rounded-bl-full`} />
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.textColor}`}>{stat.value}</p>
                {stat.showProgress && (
                  <Progress value={stat.progressValue} className="h-1.5 mt-3 w-24" />
                )}
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.textColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

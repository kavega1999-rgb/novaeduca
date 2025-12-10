import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AdherenceReportCardProps {
  report: {
    id: string;
    training_title: string;
    training_id: string;
    pretest_score: number | null;
    postest_score: number | null;
    pretest_category: string | null;
    postest_category: string | null;
    improvement_percentage: number | null;
    conclusion: string | null;
    strategies: string | null;
    created_at: string;
    user_name?: string;
  };
  onExportPDF?: () => void;
  showUserName?: boolean;
}

const getScoreCategory = (score: number): string => {
  if (score >= 90) return 'Excelente';
  if (score >= 80) return 'Bueno';
  if (score >= 70) return 'Aceptable';
  return 'Inaceptable';
};

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'Excelente': return 'bg-green-100 text-green-700 border-green-300';
    case 'Bueno': return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'Aceptable': return 'bg-amber-100 text-amber-700 border-amber-300';
    default: return 'bg-red-100 text-red-700 border-red-300';
  }
};

const ScoreDisplay = ({ label, score, category }: { label: string; score: number | null; category: string | null }) => {
  const displayCategory = category || (score !== null ? getScoreCategory(score) : 'N/A');
  
  return (
    <div className="text-center p-4 rounded-lg bg-muted/30">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      {score !== null ? (
        <>
          <p className="text-2xl font-bold">{score.toFixed(1)}%</p>
          <Badge className={`mt-1 ${getCategoryColor(displayCategory)}`}>
            {displayCategory}
          </Badge>
        </>
      ) : (
        <p className="text-lg text-muted-foreground">Pendiente</p>
      )}
    </div>
  );
};

const AdherenceReportCard = ({ report, onExportPDF, showUserName = false }: AdherenceReportCardProps) => {
  const improvement = report.improvement_percentage;
  
  const ImprovementIcon = () => {
    if (improvement === null) return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (improvement > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (improvement < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getImprovementColor = () => {
    if (improvement === null) return 'text-muted-foreground';
    if (improvement > 0) return 'text-green-600';
    if (improvement < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{report.training_title}</CardTitle>
            {showUserName && report.user_name && (
              <p className="text-sm text-muted-foreground mt-1">{report.user_name}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(report.created_at), "d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
          {onExportPDF && (
            <Button variant="outline" size="sm" onClick={onExportPDF}>
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Score Comparison */}
        <div className="grid grid-cols-2 gap-4">
          <ScoreDisplay 
            label="Pretest" 
            score={report.pretest_score} 
            category={report.pretest_category} 
          />
          <ScoreDisplay 
            label="Postest" 
            score={report.postest_score} 
            category={report.postest_category} 
          />
        </div>

        {/* Improvement */}
        <div className="text-center p-4 rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground mb-1">Mejora</p>
          <div className={`flex items-center justify-center gap-2 ${getImprovementColor()}`}>
            <ImprovementIcon />
            <span className="text-xl font-bold">
              {improvement !== null ? `${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%` : 'N/A'}
            </span>
          </div>
        </div>

        <Separator />

        {/* Conclusion */}
        {report.conclusion && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-primary" />
              Conclusión
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {report.conclusion}
            </p>
          </div>
        )}

        {/* Strategies */}
        {report.strategies && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Estrategias Recomendadas
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {report.strategies}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdherenceReportCard;

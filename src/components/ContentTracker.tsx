import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Eye } from "lucide-react";
import { toast } from "sonner";

interface ContentTrackerProps {
  contentUrl: string;
  userProgressId: string;
  onContentViewed: () => void;
  contentViewedCompletely: boolean;
}

const ContentTracker = ({ contentUrl, userProgressId, onContentViewed, contentViewedCompletely }: ContentTrackerProps) => {
  const [isViewed, setIsViewed] = useState(contentViewedCompletely);
  const [viewingTime, setViewingTime] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start timer when component mounts
    if (!isViewed) {
      timerRef.current = setInterval(() => {
        setViewingTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isViewed]);

  useEffect(() => {
    // Mark as viewed after 30 seconds of viewing (minimum time to consider content viewed)
    const markAsViewed = async () => {
      if (viewingTime >= 30 && !isViewed) {
        const { error } = await supabase
          .from("user_progress")
          .update({ 
            content_viewed_completely: true,
            progress_percentage: 100
          })
          .eq("id", userProgressId);

        if (!error) {
          setIsViewed(true);
          onContentViewed();
          toast.success("Has completado la visualización del contenido. Ahora puedes realizar la evaluación.");
        }
      }
    };

    markAsViewed();
  }, [viewingTime, isViewed, userProgressId, onContentViewed]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {!isViewed && (
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            Tiempo de visualización: {formatTime(viewingTime)} - Debes ver el contenido completamente para habilitar la evaluación (mínimo 30 segundos)
          </AlertDescription>
        </Alert>
      )}
      
      {isViewed && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            ✓ Contenido visualizado completamente
          </AlertDescription>
        </Alert>
      )}

      <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden">
        <iframe
          ref={iframeRef}
          src={contentUrl}
          className="w-full h-full"
          title="Contenido de capacitación"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default ContentTracker;
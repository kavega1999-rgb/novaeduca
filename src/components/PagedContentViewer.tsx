import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import VideoContentViewer from "./VideoContentViewer";

interface PagedContentViewerProps {
  contentUrl: string;
  userProgressId?: string;
  onContentViewed?: () => void;
  contentViewedCompletely?: boolean;
  totalPages?: number;
  requiresEvaluation?: boolean;
}

// Helper to detect if URL is a video
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
  const lowercaseUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowercaseUrl.includes(ext));
};

// Helper to detect if URL is a PowerPoint/Office file (non-PDF)
const isOfficeUrl = (url: string): boolean => {
  const officeExtensions = ['.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx'];
  const lowercaseUrl = url.toLowerCase();
  return officeExtensions.some(ext => lowercaseUrl.includes(ext));
};

const PagedContentViewer = ({
  contentUrl,
  userProgressId,
  onContentViewed,
  contentViewedCompletely = false,
  totalPages = 10,
  requiresEvaluation = false,
}: PagedContentViewerProps) => {
  const isVideo = isVideoUrl(contentUrl);
  const isOffice = isOfficeUrl(contentUrl);

  const [currentPage, setCurrentPage] = useState(1);
  const [viewedPages, setViewedPages] = useState<Set<number>>(new Set([1]));
  const [allPagesViewed, setAllPagesViewed] = useState(contentViewedCompletely);

  useEffect(() => {
    setViewedPages(new Set([1]));
  }, []);

  useEffect(() => {
    if (viewedPages.size === totalPages && !allPagesViewed) {
      markContentAsViewed();
    }
  }, [viewedPages, totalPages, allPagesViewed]);

  // For office files viewed as a single page, auto-mark as viewed after mount
  useEffect(() => {
    if (isOffice && !allPagesViewed) {
      const timer = setTimeout(() => {
        markContentAsViewed();
      }, 5000); // Mark as viewed after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [isOffice]);

  const markContentAsViewed = async () => {
    if (!userProgressId) {
      setAllPagesViewed(true);
      return;
    }

    const { error } = await supabase
      .from("user_progress")
      .update({
        content_viewed_completely: true,
        progress_percentage: 100,
      })
      .eq("id", userProgressId);

    if (!error) {
      setAllPagesViewed(true);
      const message = requiresEvaluation
        ? "¡Has completado la visualización del contenido! Ahora puedes realizar la evaluación."
        : "¡Has completado la visualización del contenido!";
      toast.success(message);
      if (onContentViewed) {
        onContentViewed();
      }
    }
  };

  // If it's a video, render VideoContentViewer
  if (isVideo) {
    return (
      <VideoContentViewer
        contentUrl={contentUrl}
        userProgressId={userProgressId}
        onContentViewed={onContentViewed}
        contentViewedCompletely={contentViewedCompletely}
        requiresEvaluation={requiresEvaluation}
      />
    );
  }

  // If it's an Office file (PowerPoint, Word, Excel), use Google Docs Viewer
  if (isOffice) {
    const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(contentUrl)}&embedded=true`;

    return (
      <div className="space-y-4">
        {/* Completion status */}
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Progreso de visualización
            </span>
            <span className="text-sm font-bold">{allPagesViewed ? "100%" : "En progreso..."}</span>
          </div>
          <Progress value={allPagesViewed ? 100 : 50} className="h-3" />
          {allPagesViewed && (
            <div className="flex items-center gap-2 mt-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">¡Contenido completado!</span>
            </div>
          )}
        </div>

        {/* Office File Viewer via Google Docs */}
        <div className="bg-card border rounded-lg overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="w-full h-[750px] bg-muted relative">
            <iframe
              src={googleViewerUrl}
              className="w-full h-full border-0"
              title="Contenido de capacitación"
              style={{ display: 'block' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // PDF viewer with page navigation
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      setViewedPages(new Set([...viewedPages, nextPage]));
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    setViewedPages(new Set([...viewedPages, page]));
  };

  const progressPercentage = Math.round((viewedPages.size / totalPages) * 100);

  // Build PDF URL to show single page only
  const pdfUrl = `${contentUrl}#page=${currentPage}&pagemode=none&toolbar=0&navpanes=0&scrollbar=0&view=Fit`;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Progreso de visualización: {viewedPages.size} de {totalPages} páginas
          </span>
          <span className="text-sm font-bold">{progressPercentage}%</span>
        </div>
        <Progress value={progressPercentage} className="h-3" />
        {allPagesViewed && (
          <div className="flex items-center gap-2 mt-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">¡Contenido completado!</span>
          </div>
        )}
      </div>

      {/* Content Viewer - Single Page Mode */}
      <div className="bg-card border rounded-lg overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        {/* Navigation Controls - Top */}
        <div className="p-5 border-b bg-gradient-to-br from-card to-muted/20">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="min-w-[140px] font-semibold"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Anterior
            </Button>

            <div className="text-center px-6 py-2 bg-primary/5 rounded-lg border border-primary/20">
              <div className="text-xl font-bold text-primary">
                {currentPage} / {totalPages}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-medium">
                {viewedPages.has(currentPage) ? "✓ Página vista" : "Página nueva"}
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="min-w-[140px] font-semibold"
            >
              Siguiente
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="w-full h-[750px] bg-muted relative">
          <iframe
            key={currentPage}
            src={pdfUrl}
            className="w-full h-full border-0"
            title={`Contenido de capacitación - Página ${currentPage}`}
            style={{
              overflow: 'hidden',
              display: 'block'
            }}
          />
        </div>

        {/* Page Numbers Grid - Bottom */}
        <div className="p-5 border-t bg-card">
          <p className="text-sm font-medium text-muted-foreground mb-3 text-center">
            Selecciona una página:
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center max-w-4xl mx-auto">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              const isViewed = viewedPages.has(page);
              const isCurrent = currentPage === page;

              return (
                <Button
                  key={page}
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(page)}
                  className={`min-w-[48px] h-11 font-bold text-base ${
                    isViewed && !isCurrent
                      ? "bg-success/10 border-success/50 text-success hover:bg-success/20 hover:border-success"
                      : ""
                  } ${isCurrent ? "shadow-lg" : ""}`}
                >
                  {page}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagedContentViewer;

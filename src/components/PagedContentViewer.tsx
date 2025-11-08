import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface PagedContentViewerProps {
  contentUrl: string;
  userProgressId?: string;
  onContentViewed?: () => void;
  contentViewedCompletely?: boolean;
  totalPages?: number;
  requiresEvaluation?: boolean;
}

const PagedContentViewer = ({
  contentUrl,
  userProgressId,
  onContentViewed,
  contentViewedCompletely = false,
  totalPages = 10,
  requiresEvaluation = false,
}: PagedContentViewerProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewedPages, setViewedPages] = useState<Set<number>>(new Set([1]));
  const [allPagesViewed, setAllPagesViewed] = useState(contentViewedCompletely);

  useEffect(() => {
    // Mark first page as viewed on mount
    setViewedPages(new Set([1]));
  }, []);

  useEffect(() => {
    // Check if all pages have been viewed
    if (viewedPages.size === totalPages && !allPagesViewed) {
      markContentAsViewed();
    }
  }, [viewedPages, totalPages, allPagesViewed]);

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

  // Build PDF URL with page navigation and hide toolbar
  const pdfUrl = `${contentUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

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

      {/* Content Viewer */}
      <div className="bg-card border rounded-lg overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="w-full h-[600px] bg-muted">
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title="Contenido de capacitación"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Navigation Controls */}
        <div className="p-4 border-t bg-card">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Button
              variant="outline"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            <div className="text-center">
              <div className="text-sm font-medium">
                Página {currentPage} de {totalPages}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Page Numbers Grid */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => goToPage(page)}
                className={`min-w-[40px] h-9 ${
                  viewedPages.has(page) && currentPage !== page
                    ? "bg-secondary/20 border-secondary"
                    : ""
                }`}
              >
                {page}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagedContentViewer;

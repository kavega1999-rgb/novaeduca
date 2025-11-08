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

  // Build PDF URL to show single page - using page parameter with zoom to fit page width
  const pdfUrl = `${contentUrl}#page=${currentPage}&zoom=page-fit&toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=Fit`;

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
        <div className="w-full h-[700px] bg-muted flex items-center justify-center">
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Contenido de capacitación"
            style={{ overflow: 'hidden' }}
          />
        </div>

        {/* Navigation Controls */}
        <div className="p-4 border-t bg-card">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="min-w-[120px]"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Anterior
            </Button>

            <div className="text-center px-4">
              <div className="text-lg font-semibold text-primary">
                Página {currentPage} de {totalPages}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {viewedPages.has(currentPage) ? "Vista" : "Nueva"}
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="min-w-[120px]"
            >
              Siguiente
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Page Numbers Grid */}
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-3 text-center">Ir a página:</p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(page)}
                  className={`min-w-[44px] h-10 font-semibold ${
                    viewedPages.has(page) && currentPage !== page
                      ? "bg-success/10 border-success/50 text-success hover:bg-success/20"
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
    </div>
  );
};

export default PagedContentViewer;

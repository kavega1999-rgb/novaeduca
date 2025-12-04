import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search, Calendar, Eye, Download, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import PDFViewer from "./PDFViewer";
import DocumentForm from "./DocumentForm";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Document {
  id: string;
  title: string;
  category: string;
  published_at: string;
  summary: string | null;
  file_url: string;
  visible_to: string[];
  created_at: string;
}

const categories = ["Todos", "Norma", "Circular", "Resolución", "Manual", "Otro"];

const categoryColors: Record<string, string> = {
  Norma: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Circular: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Resolución: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Manual: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Otro: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

interface FloatingDocumentsButtonProps {
  isAdmin?: boolean;
}

const FloatingDocumentsButton = ({ isAdmin = false }: FloatingDocumentsButtonProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDocument, setEditDocument] = useState<Document | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("institutional_documents")
      .select("*")
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error fetching documents:", error);
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchDocuments();
    }
  }, [open]);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "Todos" || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleView = (doc: Document) => {
    setSelectedDocument(doc);
    setViewerOpen(true);
  };

  const handleEdit = (doc: Document) => {
    setEditDocument(doc);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (doc: Document) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    const urlParts = documentToDelete.file_url.split("/");
    const filePath = urlParts.slice(-2).join("/");

    await supabase.storage.from("institutional-documents").remove([filePath]);

    const { error } = await supabase
      .from("institutional_documents")
      .delete()
      .eq("id", documentToDelete.id);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el documento",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Documento eliminado",
        description: "El documento se ha eliminado correctamente",
      });
      fetchDocuments();
    }

    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  const handleSuccess = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setEditDocument(null);
    fetchDocuments();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
            size="icon"
          >
            <FileText className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center justify-between">
              <span>Documentos Institucionales</span>
              {isAdmin && (
                <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Filters */}
          <div className="space-y-3 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Documents List */}
          <ScrollArea className="h-[calc(100vh-220px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Cargando...</div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No se encontraron documentos</p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-medium text-sm text-foreground truncate">
                            {doc.title}
                          </h4>
                          <Badge className={`text-xs ${categoryColors[doc.category] || categoryColors.Otro}`}>
                            {doc.category}
                          </Badge>
                        </div>
                        {doc.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {doc.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(doc.published_at), "dd MMM yyyy", { locale: es })}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => handleView(doc)}>
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a href={doc.file_url} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3" />
                            </a>
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => handleEdit(doc)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteClick(doc)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* PDF Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-5xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title}</DialogTitle>
          </DialogHeader>
          {selectedDocument && <PDFViewer url={selectedDocument.file_url} />}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Documento</DialogTitle>
          </DialogHeader>
          <DocumentForm onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Documento</DialogTitle>
          </DialogHeader>
          {editDocument && (
            <DocumentForm document={editDocument} onSuccess={handleSuccess} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El documento "{documentToDelete?.title}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FloatingDocumentsButton;

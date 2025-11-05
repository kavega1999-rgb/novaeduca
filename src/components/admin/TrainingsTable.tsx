import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TrainingForm from "./TrainingForm";

interface Training {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  duration_minutes: number;
  areas: { name: string; color: string } | null;
}

interface TrainingsTableProps {
  onRefresh?: () => void;
}

const TrainingsTable = ({ onRefresh }: TrainingsTableProps) => {
  const { toast } = useToast();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchTrainings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("trainings")
      .select(`
        id,
        title,
        description,
        type,
        status,
        duration_minutes,
        areas:area_id (name, color)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las capacitaciones",
        variant: "destructive",
      });
    } else {
      setTrainings(data as any || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const { error } = await supabase
      .from("trainings")
      .delete()
      .eq("id", deletingId);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la capacitación",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Eliminado",
        description: "La capacitación ha sido eliminada",
      });
      fetchTrainings();
      onRefresh?.();
    }
    setDeletingId(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      active: "default",
      draft: "secondary",
      archived: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      capacitacion: "Capacitación",
      induccion: "Inducción",
      entrenamiento: "Entrenamiento",
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando capacitaciones...</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trainings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay capacitaciones registradas
                </TableCell>
              </TableRow>
            ) : (
              trainings.map((training) => (
                <TableRow key={training.id}>
                  <TableCell className="font-medium">{training.title}</TableCell>
                  <TableCell>{getTypeBadge(training.type)}</TableCell>
                  <TableCell>{training.areas?.name || "Sin área"}</TableCell>
                  <TableCell>{training.duration_minutes} min</TableCell>
                  <TableCell>{getStatusBadge(training.status)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingId(training.id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingId(training.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Capacitación</DialogTitle>
          </DialogHeader>
          {editingId && (
            <TrainingForm
              trainingId={editingId}
              onSuccess={() => {
                setEditingId(null);
                fetchTrainings();
                onRefresh?.();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la capacitación
              y todos los datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TrainingsTable;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Trash2, Search, Filter, ChevronLeft, ChevronRight, BookOpen, GraduationCap, Users2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TrainingForm from "./TrainingForm";
import { TrainingReminderButton } from "./TrainingReminderButton";
interface Training {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  duration_minutes: number;
  created_at: string;
  active_until: string | null;
  areas: { id: string; name: string; color: string } | null;
}

interface Area {
  id: string;
  name: string;
}

interface TrainingsTableProps {
  onRefresh?: () => void;
}

const ITEMS_PER_PAGE = 10;

const TrainingsTable = ({ onRefresh }: TrainingsTableProps) => {
  const { toast } = useToast();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [filteredTrainings, setFilteredTrainings] = useState<Training[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userAreaId, setUserAreaId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchUserRoleAndData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trainings, searchTerm, selectedArea, selectedStatus, selectedType, userRole, userAreaId]);

  const fetchUserRoleAndData = async () => {
    setIsLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r) => r.role === "admin");
    const isLeader = roles?.some((r) => r.role === "leader");
    
    setUserRole(isAdmin ? "admin" : isLeader ? "leader" : "user");

    // Get leader_area_id directly from profile (for leaders)
    if (isLeader && !isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("leader_area_id")
        .eq("id", user.id)
        .single();

      if (profile?.leader_area_id) {
        setUserAreaId(profile.leader_area_id);
      }
    }

    await fetchData();
  };

  const fetchData = async () => {
    // Fetch trainings
    const { data: trainingsData, error } = await supabase
      .from("trainings")
      .select(`
        id,
        title,
        description,
        type,
        status,
        duration_minutes,
        created_at,
        active_until,
        areas:area_id (id, name, color)
      `)
      .order("created_at", { ascending: false });

    // Fetch areas
    const { data: areasData } = await supabase
      .from("areas")
      .select("id, name")
      .order("name");

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las capacitaciones",
        variant: "destructive",
      });
    } else {
      setTrainings(trainingsData as any || []);
      setAreas(areasData || []);
    }
    setIsLoading(false);
  };

  const applyFilters = () => {
    let result = [...trainings];

    // For leaders (not admins), filter by their assigned area
    if (userRole === "leader" && userAreaId) {
      result = result.filter(t => t.areas?.id === userAreaId);
    }

    // Search filter
    if (searchTerm) {
      result = result.filter(t =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Area filter (only for admins, leaders already filtered)
    if (selectedArea !== "all" && userRole === "admin") {
      result = result.filter(t => t.areas?.id === selectedArea);
    }

    // Status filter
    if (selectedStatus !== "all") {
      result = result.filter(t => t.status === selectedStatus);
    }

    // Type filter
    if (selectedType !== "all") {
      result = result.filter(t => t.type === selectedType);
    }

    setFilteredTrainings(result);
    setCurrentPage(1);
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
      fetchData();
      onRefresh?.();
    }
    setDeletingId(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedArea("all");
    setSelectedStatus("all");
    setSelectedType("all");
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline"; className: string }> = {
      active: { label: "Activo", variant: "default", className: "bg-green-500/10 text-green-600 border-green-500/30" },
      draft: { label: "Borrador", variant: "secondary", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
      archived: { label: "Archivado", variant: "outline", className: "bg-muted text-muted-foreground" },
    };
    const { label, className } = config[status] || { label: status, className: "" };
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      capacitacion: BookOpen,
      induccion: GraduationCap,
      entrenamiento: Users2,
    };
    const Icon = icons[type] || BookOpen;
    return <Icon className="w-4 h-4" />;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      capacitacion: "Capacitación",
      induccion: "Inducción",
      entrenamiento: "Entrenamiento",
    };
    return (
      <Badge variant="outline" className="flex items-center gap-1.5">
        {getTypeIcon(type)}
        <span>{labels[type] || type}</span>
      </Badge>
    );
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredTrainings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTrainings = filteredTrainings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando capacitaciones...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="w-4 h-4" />
          Filtros
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Area filter - only for admins */}
          {userRole === "admin" && (
            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map(area => (
                  <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="archived">Archivado</SelectItem>
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="capacitacion">Capacitación</SelectItem>
              <SelectItem value="induccion">Inducción</SelectItem>
              <SelectItem value="entrenamiento">Entrenamiento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear filters */}
        {(searchTerm || selectedArea !== "all" || selectedStatus !== "all" || selectedType !== "all") && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {filteredTrainings.length} resultado(s) encontrado(s)
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Título</TableHead>
              <TableHead className="font-semibold">Tipo</TableHead>
              <TableHead className="font-semibold">Área</TableHead>
              <TableHead className="font-semibold">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Duración
                </div>
              </TableHead>
              <TableHead className="font-semibold">Estado</TableHead>
              <TableHead className="text-right font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTrainings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No se encontraron capacitaciones</p>
                  {(searchTerm || selectedArea !== "all" || selectedStatus !== "all" || selectedType !== "all") && (
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Limpiar filtros
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedTrainings.map((training) => (
                <TableRow key={training.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="font-medium text-foreground">{training.title}</div>
                    {training.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[300px]">
                        {training.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getTypeBadge(training.type)}</TableCell>
                  <TableCell>
                    <span className="text-sm">{training.areas?.name || "Sin área"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{training.duration_minutes || 0} min</span>
                  </TableCell>
                  <TableCell>{getStatusBadge(training.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrainingReminderButton
                        trainingId={training.id}
                        trainingTitle={training.title}
                        activeUntil={training.active_until}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                        onClick={() => setEditingId(training.id)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeletingId(training.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredTrainings.length)} de {filteredTrainings.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                if (totalPages <= 5) return true;
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 1) return true;
                return false;
              })
              .map((page, idx, arr) => (
                <div key={page} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== page - 1 && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                  <Button
                    variant={currentPage === page ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                </div>
              ))
            }

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
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
                fetchData();
                onRefresh?.();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrainingsTable;

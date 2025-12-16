import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Clock, Loader2, Search, Users, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TrainingReminderButtonProps {
  trainingId: string;
  trainingTitle: string;
  activeUntil?: string | null;
}

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  area: string | null;
}

export function TrainingReminderButton({ 
  trainingId, 
  trainingTitle,
  activeUntil 
}: TrainingReminderButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reminderType, setReminderType] = useState<"new_training" | "deadline_approaching">("new_training");
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const hasDeadline = activeUntil && new Date(activeUntil) > new Date();

  const loadPendingUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // Get all active users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, area")
        .eq("status", "active");

      if (profilesError) throw profilesError;

      // Get users who have completed the training
      const { data: completedProgress } = await supabase
        .from("user_progress")
        .select("user_id")
        .eq("training_id", trainingId)
        .eq("status", "completed");

      const completedUserIds = new Set(completedProgress?.map(p => p.user_id) || []);

      // Filter to pending users only
      const pending = profiles?.filter(p => !completedUserIds.has(p.id)) || [];

      // Get emails from auth (we'll use a workaround since we can't access auth.users directly)
      // For now, we'll fetch from the edge function
      const usersWithEmail: PendingUser[] = pending.map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: "", // Will be resolved on server
        area: p.area
      }));

      setPendingUsers(usersWithEmail);
      setSelectedUserIds(new Set(usersWithEmail.map(u => u.id)));
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const openDialog = (type: "new_training" | "deadline_approaching") => {
    setReminderType(type);
    setIsDialogOpen(true);
    loadPendingUsers();
  };

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const sendReminder = async () => {
    if (selectedUserIds.size === 0) {
      toast({
        title: "Sin destinatarios",
        description: "Selecciona al menos un usuario",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      const response = await supabase.functions.invoke("send-training-reminder", {
        body: {
          training_id: trainingId,
          reminder_type: reminderType,
          user_ids: Array.from(selectedUserIds),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Error al enviar recordatorios");
      }

      const result = response.data;
      
      toast({
        title: "Recordatorios procesados",
        description: result.message,
      });

      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Error sending reminder:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron enviar los recordatorios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = pendingUsers.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAreaLabel = (area: string | null) => {
    const labels: Record<string, string> = {
      medicos: "Médicos",
      asistencial: "Asistencial",
      administrativos: "Administrativos",
    };
    return area ? labels[area] || area : "Sin área";
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => openDialog("new_training")}
        className="gap-2"
      >
        <Bell className="h-4 w-4" />
        <span className="hidden sm:inline">Recordatorios</span>
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Enviar Recordatorio
            </DialogTitle>
            <DialogDescription>
              Selecciona los usuarios que recibirán el recordatorio para "{trainingTitle}"
            </DialogDescription>
          </DialogHeader>

          {/* Reminder Type Selection */}
          <div className="flex gap-2">
            <Button
              variant={reminderType === "new_training" ? "default" : "outline"}
              size="sm"
              onClick={() => setReminderType("new_training")}
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-2" />
              Nueva capacitación
            </Button>
            {hasDeadline && (
              <Button
                variant={reminderType === "deadline_approaching" ? "default" : "outline"}
                size="sm"
                onClick={() => setReminderType("deadline_approaching")}
                className="flex-1"
              >
                <Clock className="h-4 w-4 mr-2 text-orange-500" />
                Fecha límite
              </Button>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Para enviar correos a todos los usuarios, verifica tu dominio en{" "}
              <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                resend.com/domains
              </a>
            </AlertDescription>
          </Alert>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Select All / Count */}
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">Seleccionar todos</span>
            </div>
            <Badge variant="secondary">
              <Users className="h-3 w-3 mr-1" />
              {selectedUserIds.size} de {filteredUsers.length}
            </Badge>
          </div>

          {/* Users List */}
          <ScrollArea className="flex-1 min-h-[200px] max-h-[300px]">
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No se encontraron usuarios" : "Todos los usuarios han completado esta capacitación"}
              </div>
            ) : (
              <div className="space-y-1 pr-4">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleUser(user.id)}
                  >
                    <Checkbox
                      checked={selectedUserIds.has(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{getAreaLabel(user.area)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={sendReminder} disabled={isLoading || selectedUserIds.size === 0}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar ({selectedUserIds.size})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

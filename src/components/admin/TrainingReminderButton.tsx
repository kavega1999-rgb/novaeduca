import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Mail, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TrainingReminderButtonProps {
  trainingId: string;
  trainingTitle: string;
  activeUntil?: string | null;
}

export function TrainingReminderButton({ 
  trainingId, 
  trainingTitle,
  activeUntil 
}: TrainingReminderButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendReminder = async (reminderType: "new_training" | "deadline_approaching") => {
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
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Error al enviar recordatorios");
      }

      const result = response.data;
      
      toast({
        title: "Recordatorios enviados",
        description: result.message,
      });
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

  const hasDeadline = activeUntil && new Date(activeUntil) > new Date();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Recordatorios</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem 
          onClick={() => sendReminder("new_training")}
          className="cursor-pointer"
        >
          <Mail className="mr-2 h-4 w-4" />
          <span>Notificar nueva capacitación</span>
        </DropdownMenuItem>
        {hasDeadline && (
          <DropdownMenuItem 
            onClick={() => sendReminder("deadline_approaching")}
            className="cursor-pointer"
          >
            <Clock className="mr-2 h-4 w-4 text-orange-500" />
            <span>Recordar fecha límite</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

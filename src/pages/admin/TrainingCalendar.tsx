import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, CalendarDays, Eye, EyeOff } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

interface Training {
  id: string;
  title: string;
  active_from: string | null;
  active_until: string | null;
  status: string;
  type: string;
  calendar_visible: boolean | null;
  area_id: string;
  areas?: { name: string; color: string | null };
}

const typeColors: Record<string, string> = {
  capacitacion: "bg-blue-500/20 text-blue-700 border-blue-300",
  induccion: "bg-emerald-500/20 text-emerald-700 border-emerald-300",
  entrenamiento: "bg-amber-500/20 text-amber-700 border-amber-300",
};

const typeLabels: Record<string, string> = {
  capacitacion: "Capacitación",
  induccion: "Inducción",
  entrenamiento: "Entrenamiento",
};

const TrainingCalendar = () => {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);

  useEffect(() => {
    fetchTrainings();
  }, [selectedYear]);

  const fetchTrainings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trainings")
      .select("id, title, active_from, active_until, status, type, calendar_visible, area_id, areas(name, color)")
      .eq("year", selectedYear)
      .not("active_from", "is", null)
      .order("active_from");

    if (!error && data) {
      setTrainings(data as any);
    }
    setLoading(false);
  };

  const toggleCalendarVisibility = async (training: Training) => {
    const newValue = !training.calendar_visible;
    const { error } = await supabase
      .from("trainings")
      .update({ calendar_visible: newValue })
      .eq("id", training.id);

    if (!error) {
      setTrainings(prev => prev.map(t => t.id === training.id ? { ...t, calendar_visible: newValue } : t));
      toast({
        title: newValue ? "Visible para usuarios" : "Oculto para usuarios",
        description: `"${training.title}" ${newValue ? "ahora es visible" : "ya no es visible"} en el calendario de usuarios.`,
      });
    }
  };

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0=Sunday

  const trainingsForDay = useMemo(() => {
    const map: Record<string, Training[]> = {};
    for (const t of trainings) {
      if (!t.active_from) continue;
      const from = new Date(t.active_from);
      const to = t.active_until ? new Date(t.active_until) : from;
      for (const day of daysInMonth) {
        if (day >= new Date(from.toDateString()) && day <= new Date(to.toDateString())) {
          const key = format(day, "yyyy-MM-dd");
          if (!map[key]) map[key] = [];
          map[key].push(t);
        }
      }
    }
    return map;
  }, [trainings, daysInMonth]);

  const dayTrainings = selectedDay ? (trainingsForDay[format(selectedDay, "yyyy-MM-dd")] || []) : [];

  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-primary" />
          Calendario de Capacitaciones
        </h1>
        <p className="text-muted-foreground mt-2">
          Visualiza y planifica las capacitaciones del año. Haz clic en un día para ver detalles.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-lg min-w-[160px] text-center capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
          Hoy
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-3">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {weekDays.map(d => (
                <div key={d} className="bg-muted-foreground/10 py-2 text-center text-xs font-semibold text-muted-foreground">
                  {d}
                </div>
              ))}
              {/* Empty cells for days before month start */}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-background min-h-[80px]" />
              ))}
              {daysInMonth.map(day => {
                const key = format(day, "yyyy-MM-dd");
                const dayItems = trainingsForDay[key] || [];
                const selected = selectedDay && isSameDay(day, selectedDay);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "bg-background min-h-[80px] p-1 text-left transition-colors hover:bg-accent/50 relative",
                      isToday(day) && "ring-2 ring-primary ring-inset",
                      selected && "bg-accent"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium",
                      isToday(day) && "text-primary font-bold"
                    )}>
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayItems.slice(0, 3).map(t => (
                        <div
                          key={t.id}
                          className={cn("text-[10px] leading-tight px-1 py-0.5 rounded truncate border", typeColors[t.type] || "bg-muted")}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{dayItems.length - 3} más</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {selectedDay ? format(selectedDay, "d 'de' MMMM, yyyy", { locale: es }) : "Selecciona un día"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedDay && (
                <p className="text-sm text-muted-foreground">Haz clic en un día del calendario para ver las capacitaciones programadas.</p>
              )}
              {selectedDay && dayTrainings.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay capacitaciones programadas para este día.</p>
              )}
              {dayTrainings.map(t => (
                <div key={t.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{t.title}</p>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", typeColors[t.type])}>
                      {typeLabels[t.type] || t.type}
                    </Badge>
                  </div>
                  {t.areas && (
                    <p className="text-xs text-muted-foreground">Área: {(t.areas as any).name}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant={t.status === "active" ? "default" : "secondary"} className="text-[10px]">
                      {t.status === "active" ? "Activo" : t.status === "draft" ? "Borrador" : "Archivado"}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCalendarVisibility(t);
                          }}
                        >
                          {t.calendar_visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t.calendar_visible ? "Visible para usuarios – clic para ocultar" : "Oculto para usuarios – clic para mostrar"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Leyenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(typeLabels).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded border", typeColors[key])} />
                  <span className="text-xs">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2">
                <Eye className="h-3 w-3 text-primary" />
                <span className="text-xs">Visible para usuarios</span>
              </div>
              <div className="flex items-center gap-2">
                <EyeOff className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs">Oculto para usuarios</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upcoming trainings list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Próximas Capacitaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {trainings
              .filter(t => t.active_from && new Date(t.active_from) >= new Date())
              .slice(0, 10)
              .map(t => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-8 rounded-full", t.type === "capacitacion" ? "bg-blue-500" : t.type === "induccion" ? "bg-emerald-500" : "bg-amber-500")} />
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.active_from!), "d MMM yyyy", { locale: es })}
                        {t.active_until && ` – ${format(new Date(t.active_until), "d MMM yyyy", { locale: es })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", typeColors[t.type])}>
                      {typeLabels[t.type]}
                    </Badge>
                    <Switch
                      checked={!!t.calendar_visible}
                      onCheckedChange={() => toggleCalendarVisibility(t)}
                    />
                  </div>
                </div>
              ))}
            {trainings.filter(t => t.active_from && new Date(t.active_from) >= new Date()).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay capacitaciones próximas con fecha de inicio definida.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingCalendar;

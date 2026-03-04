import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
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
  is_finished: boolean | null;
  areas?: { name: string; color: string | null };
}

const typeLabels: Record<string, string> = {
  capacitacion: "Capacitación",
  induccion: "Inducción",
  entrenamiento: "Entrenamiento",
};

const statusConfig = (t: Training) => {
  if (t.is_finished) return { label: "Finalizada", dotClass: "bg-red-500", badgeClass: "bg-red-500/15 text-red-700 border-red-200" };
  if (t.status === "active") return { label: "Activa", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-200" };
  if (t.status === "draft") return { label: "Borrador", dotClass: "bg-amber-500", badgeClass: "bg-amber-500/15 text-amber-700 border-amber-200" };
  return { label: "Archivada", dotClass: "bg-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-muted" };
};

const TrainingCalendar = () => {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);

  useEffect(() => {
    fetchTrainings();
  }, [selectedYear]);

  const fetchTrainings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trainings")
      .select("id, title, active_from, active_until, status, type, calendar_visible, area_id, is_finished, areas(name, color)")
      .eq("year", selectedYear)
      .not("active_from", "is", null)
      .order("active_from");

    if (!error && data) {
      setTrainings(data as any);
    }
    setLoading(false);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  // Map: date key -> trainings whose active_from falls on that day
  const trainingsForDay = useMemo(() => {
    const map: Record<string, Training[]> = {};
    for (const t of trainings) {
      if (!t.active_from) continue;
      const fromDate = new Date(t.active_from);
      const key = format(fromDate, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [trainings]);

  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <CalendarDays className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          Calendario de Capacitaciones
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Visualiza las fechas de inicio de cada capacitación. Haz clic en una para ver más detalles.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-base md:text-lg min-w-[150px] text-center capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
          Hoy
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span className="text-muted-foreground">Activa</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span className="text-muted-foreground">Finalizada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span className="text-muted-foreground">Borrador</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2 md:p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando...</div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {weekDays.map(d => (
                <div key={d} className="bg-muted py-2 text-center text-xs font-semibold text-muted-foreground">
                  {d}
                </div>
              ))}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-background min-h-[70px] md:min-h-[90px]" />
              ))}
              {daysInMonth.map(day => {
                const key = format(day, "yyyy-MM-dd");
                const dayItems = trainingsForDay[key] || [];
                const hasTrainings = dayItems.length > 0;

                return (
                  <div
                    key={key}
                    className={cn(
                      "bg-background min-h-[70px] md:min-h-[90px] p-1 md:p-1.5 relative transition-colors",
                      isToday(day) && "ring-2 ring-primary ring-inset",
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium",
                      isToday(day) && "text-primary font-bold"
                    )}>
                      {format(day, "d")}
                    </span>
                    {hasTrainings && (
                      <div className="mt-0.5 space-y-0.5">
                        {dayItems.map(t => {
                          const sc = statusConfig(t);
                          const areaColor = (t.areas as any)?.color || "#6366f1";
                          return (
                            <button
                              key={t.id}
                              onClick={() => setSelectedTraining(t)}
                              className="w-full text-left group"
                            >
                              <div
                                className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] md:text-[11px] leading-tight truncate hover:opacity-80 transition-opacity border"
                                style={{
                                  backgroundColor: `${areaColor}15`,
                                  borderColor: `${areaColor}40`,
                                  color: areaColor,
                                }}
                              >
                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sc.dotClass)} />
                                <span className="truncate font-medium">{t.title}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Próximas Capacitaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {trainings
              .filter(t => t.active_from && new Date(t.active_from) >= new Date())
              .slice(0, 8)
              .map(t => {
                const sc = statusConfig(t);
                const areaColor = (t.areas as any)?.color || "#6366f1";
                const areaName = (t.areas as any)?.name || "—";
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTraining(t)}
                    className="flex items-center justify-between py-3 w-full text-left hover:bg-accent/50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn("w-2.5 h-8 rounded-full shrink-0", sc.dotClass)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.active_from!), "d MMM yyyy", { locale: es })}
                          {" · "}
                          <span style={{ color: areaColor }}>{areaName}</span>
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0 ml-2", sc.badgeClass)}>
                      {sc.label}
                    </Badge>
                  </button>
                );
              })}
            {trainings.filter(t => t.active_from && new Date(t.active_from) >= new Date()).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay capacitaciones próximas.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Training Detail Dialog */}
      <Dialog open={!!selectedTraining} onOpenChange={(open) => !open && setSelectedTraining(null)}>
        {selectedTraining && (() => {
          const t = selectedTraining;
          const sc = statusConfig(t);
          const areaColor = (t.areas as any)?.color || "#6366f1";
          const areaName = (t.areas as any)?.name || "—";

          return (
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <span className={cn("w-3 h-3 rounded-full shrink-0", sc.dotClass)} />
                  {t.title}
                </DialogTitle>
                <DialogDescription>Detalles de la capacitación</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Fecha de inicio</p>
                    <p className="font-medium">
                      {t.active_from ? format(new Date(t.active_from), "d 'de' MMMM, yyyy", { locale: es }) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Fecha de fin</p>
                    <p className="font-medium">
                      {t.active_until ? format(new Date(t.active_until), "d 'de' MMMM, yyyy", { locale: es }) : "Sin definir"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Área</p>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{ backgroundColor: `${areaColor}15`, borderColor: `${areaColor}40`, color: areaColor }}
                    >
                      {areaName}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Tipo</p>
                    <p className="font-medium">{typeLabels[t.type] || t.type}</p>
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground text-xs mb-1">Estado</p>
                  <Badge variant="outline" className={cn("text-xs", sc.badgeClass)}>
                    <span className={cn("w-2 h-2 rounded-full mr-1.5 inline-block", sc.dotClass)} />
                    {sc.label}
                  </Badge>
                </div>

                <Button
                  className="w-full mt-2"
                  onClick={() => navigate(`/training/${t.id}`)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ir a la capacitación
                </Button>
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
};

export default TrainingCalendar;

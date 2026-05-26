import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink, User, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

// Parse date string without timezone shift (extracts YYYY-MM-DD and creates local date)
const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.substring(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

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

type UserStatus = "sin_iniciar" | "en_proceso" | "aprobada" | "no_aprobada";

interface UserTraining extends Training {
  user_status: UserStatus;
  best_score: number | null;
  visible_to_all?: boolean | null;
}

interface ProfileLite {
  id: string;
  full_name: string;
  area: string | null;
  position: string | null;
}

const typeLabels: Record<string, string> = {
  capacitacion: "Capacitación",
  induccion: "Inducción",
  entrenamiento: "Entrenamiento",
  socializacion: "Socialización",
};

const statusConfig = (t: Training) => {
  if (t.is_finished) return { label: "Finalizada", dotClass: "bg-red-500", badgeClass: "bg-red-500/15 text-red-700 border-red-200" };
  if (t.active_until) {
    const untilDate = parseLocalDate(t.active_until);
    const today = new Date(new Date().toDateString());
    if (untilDate < today) return { label: "Finalizada", dotClass: "bg-red-500", badgeClass: "bg-red-500/15 text-red-700 border-red-200" };
  }
  if (t.status === "active") return { label: "Activa", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-200" };
  if (t.status === "draft") return { label: "Borrador", dotClass: "bg-amber-500", badgeClass: "bg-amber-500/15 text-amber-700 border-amber-200" };
  return { label: "Archivada", dotClass: "bg-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-muted" };
};

const userStatusConfig: Record<UserStatus, { label: string; dotClass: string; badgeClass: string }> = {
  sin_iniciar: { label: "Sin iniciar", dotClass: "bg-slate-400", badgeClass: "bg-slate-500/15 text-slate-700 border-slate-200" },
  en_proceso: { label: "En Proceso", dotClass: "bg-amber-500", badgeClass: "bg-amber-500/15 text-amber-700 border-amber-200" },
  aprobada: { label: "Aprobada", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-200" },
  no_aprobada: { label: "No aprobada", dotClass: "bg-red-500", badgeClass: "bg-red-500/15 text-red-700 border-red-200" },
};

const TrainingCalendar = () => {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);

  // Per-user view state
  const [tab, setTab] = useState<"general" | "user">("general");
  const [users, setUsers] = useState<ProfileLite[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userTrainings, setUserTrainings] = useState<UserTraining[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [selectedUserTraining, setSelectedUserTraining] = useState<UserTraining | null>(null);

  useEffect(() => {
    fetchTrainings();
  }, [selectedYear]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, area, position")
        .eq("status", "active")
        .order("full_name");
      if (data) setUsers(data as any);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (tab === "user" && selectedUserId) fetchUserTrainings();
  }, [tab, selectedUserId, selectedYear]);

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

  const fetchUserTrainings = async () => {
    setUserLoading(true);
    const userId = selectedUserId;

    const [{ data: profile }, { data: assignments }] = await Promise.all([
      supabase.from("profiles").select("area").eq("id", userId).single(),
      supabase.from("training_assignments").select("training_id").eq("user_id", userId),
    ]);

    const assignedIds = assignments?.map(a => a.training_id) || [];
    const userArea = (profile as any)?.area as string | null;

    let areaTrainingIds: string[] = [];
    if (userArea) {
      const { data: areaTargets } = await supabase
        .from("training_target_areas")
        .select("training_id")
        .eq("target_area", userArea as any);
      areaTrainingIds = areaTargets?.map(a => a.training_id) || [];
    }

    const { data: trainingsData } = await supabase
      .from("trainings")
      .select("id, title, active_from, active_until, status, type, calendar_visible, area_id, is_finished, visible_to_all, areas(name, color)")
      .eq("year", selectedYear)
      .not("active_from", "is", null)
      .order("active_from");

    const allRelevantIds = new Set([...assignedIds, ...areaTrainingIds]);
    const eligible = (trainingsData || []).filter((t: any) => t.visible_to_all || allRelevantIds.has(t.id));
    const trainingIds = eligible.map((t: any) => t.id);

    // Fetch progress + evaluation attempts for those trainings
    const [{ data: progress }, { data: evals }] = await Promise.all([
      supabase.from("user_progress").select("training_id, status").eq("user_id", userId).in("training_id", trainingIds.length ? trainingIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("evaluations").select("id, training_id, passing_score").in("training_id", trainingIds.length ? trainingIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const evalIds = (evals || []).map((e: any) => e.id);
    const evalToTraining = new Map<string, string>();
    const passingByTraining = new Map<string, number>();
    (evals || []).forEach((e: any) => {
      evalToTraining.set(e.id, e.training_id);
      passingByTraining.set(e.training_id, e.passing_score ?? 70);
    });

    let attempts: any[] = [];
    if (evalIds.length > 0) {
      const { data: att } = await supabase
        .from("evaluation_attempts")
        .select("evaluation_id, score, status, passed")
        .eq("user_id", userId)
        .in("evaluation_id", evalIds);
      attempts = att || [];
    }

    // Best score per training
    const bestByTraining = new Map<string, number>();
    const anyCompletedByTraining = new Map<string, boolean>();
    attempts.forEach((a: any) => {
      const tid = evalToTraining.get(a.evaluation_id);
      if (!tid) return;
      if (a.status === "completed" && typeof a.score === "number") {
        const prev = bestByTraining.get(tid) ?? -1;
        if (a.score > prev) bestByTraining.set(tid, a.score);
        anyCompletedByTraining.set(tid, true);
      }
    });

    const progressByTraining = new Map<string, string>();
    (progress || []).forEach((p: any) => progressByTraining.set(p.training_id, p.status));

    const result: UserTraining[] = eligible.map((t: any) => {
      const best = bestByTraining.get(t.id) ?? null;
      const passing = passingByTraining.get(t.id) ?? 70;
      const completed = anyCompletedByTraining.get(t.id);
      const prog = progressByTraining.get(t.id);

      let user_status: UserStatus = "sin_iniciar";
      if (completed) {
        user_status = (best ?? 0) >= passing ? "aprobada" : "no_aprobada";
      } else if (prog === "in_progress" || prog === "completed") {
        user_status = "en_proceso";
      } else if (prog) {
        user_status = "en_proceso";
      }

      return { ...(t as Training), user_status, best_score: best };
    });

    setUserTrainings(result);
    setUserLoading(false);
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
      // Extract date portion to avoid timezone shift
      const key = t.active_from.substring(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [trainings]);

  const userTrainingsForDay = useMemo(() => {
    const map: Record<string, UserTraining[]> = {};
    for (const t of userTrainings) {
      if (!t.active_from) continue;
      const key = t.active_from.substring(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [userTrainings]);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId) || null, [users, selectedUserId]);

  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <CalendarDays className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          Calendario de Capacitaciones
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Visualiza las fechas de inicio de cada capacitación o consulta el calendario individual de un usuario.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="general">
            <CalendarDays className="h-4 w-4 mr-2" /> General
          </TabsTrigger>
          <TabsTrigger value="user">
            <User className="h-4 w-4 mr-2" /> Por usuario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
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
              .filter(t => t.active_from && parseLocalDate(t.active_from) >= new Date(new Date().toDateString()))
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
                          {format(parseLocalDate(t.active_from!), "d MMM yyyy", { locale: es })}
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
            {trainings.filter(t => t.active_from && parseLocalDate(t.active_from) >= new Date(new Date().toDateString())).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay capacitaciones próximas.</p>
            )}
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="user" className="space-y-6 mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[260px] justify-between">
                  <span className="flex items-center gap-2 truncate">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedUser?.full_name || "Seleccionar usuario..."}</span>
                  </span>
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nombre..." />
                  <CommandList>
                    <CommandEmpty>Sin resultados.</CommandEmpty>
                    <CommandGroup>
                      <ScrollArea className="h-[280px]">
                        {users.map(u => (
                          <CommandItem
                            key={u.id}
                            value={u.full_name}
                            onSelect={() => { setSelectedUserId(u.id); setUserPickerOpen(false); }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{u.full_name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {u.position || "—"}{u.area ? ` · ${u.area}` : ""}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </ScrollArea>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
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

            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Hoy</Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {(Object.keys(userStatusConfig) as UserStatus[]).map(k => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={cn("w-2.5 h-2.5 rounded-full inline-block", userStatusConfig[k].dotClass)} />
                <span className="text-muted-foreground">{userStatusConfig[k].label}</span>
              </div>
            ))}
          </div>

          {!selectedUserId ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground text-sm">
                Selecciona un usuario para ver su calendario de capacitaciones asignadas.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-2 md:p-4">
                  {userLoading ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando...</div>
                  ) : (
                    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                      {weekDays.map(d => (
                        <div key={d} className="bg-muted py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
                      ))}
                      {Array.from({ length: startDayOfWeek }).map((_, i) => (
                        <div key={`uempty-${i}`} className="bg-background min-h-[70px] md:min-h-[90px]" />
                      ))}
                      {daysInMonth.map(day => {
                        const key = format(day, "yyyy-MM-dd");
                        const dayItems = userTrainingsForDay[key] || [];
                        return (
                          <div
                            key={`u-${key}`}
                            className={cn(
                              "bg-background min-h-[70px] md:min-h-[90px] p-1 md:p-1.5 relative transition-colors",
                              isToday(day) && "ring-2 ring-primary ring-inset",
                            )}
                          >
                            <span className={cn("text-xs font-medium", isToday(day) && "text-primary font-bold")}>
                              {format(day, "d")}
                            </span>
                            {dayItems.length > 0 && (
                              <div className="mt-0.5 space-y-0.5">
                                {dayItems.map(t => {
                                  const sc = userStatusConfig[t.user_status];
                                  const areaColor = (t.areas as any)?.color || "#6366f1";
                                  return (
                                    <button
                                      key={t.id}
                                      onClick={() => setSelectedUserTraining(t)}
                                      className="w-full text-left"
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Capacitaciones de {selectedUser?.full_name} ({selectedYear})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {userTrainings.length === 0 && !userLoading && (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Este usuario no tiene capacitaciones asignadas en {selectedYear}.
                      </p>
                    )}
                    {userTrainings.map(t => {
                      const sc = userStatusConfig[t.user_status];
                      const areaColor = (t.areas as any)?.color || "#6366f1";
                      const areaName = (t.areas as any)?.name || "—";
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedUserTraining(t)}
                          className="flex items-center justify-between py-3 w-full text-left hover:bg-accent/50 -mx-2 px-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={cn("w-2.5 h-8 rounded-full shrink-0", sc.dotClass)} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{t.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {t.active_from ? format(parseLocalDate(t.active_from), "d MMM yyyy", { locale: es }) : "Sin fecha"}
                                {" · "}
                                <span style={{ color: areaColor }}>{areaName}</span>
                                {t.best_score !== null && (
                                  <> · <span className="font-medium">{Math.round(t.best_score)}%</span></>
                                )}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] shrink-0 ml-2", sc.badgeClass)}>
                            {sc.label}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

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
                      {t.active_from ? format(parseLocalDate(t.active_from), "d 'de' MMMM, yyyy", { locale: es }) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Fecha de fin</p>
                    <p className="font-medium">
                      {t.active_until ? format(parseLocalDate(t.active_until), "d 'de' MMMM, yyyy", { locale: es }) : "Sin definir"}
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

      {/* User Training Detail Dialog */}
      <Dialog open={!!selectedUserTraining} onOpenChange={(open) => !open && setSelectedUserTraining(null)}>
        {selectedUserTraining && (() => {
          const t = selectedUserTraining;
          const sc = userStatusConfig[t.user_status];
          const areaColor = (t.areas as any)?.color || "#6366f1";
          const areaName = (t.areas as any)?.name || "—";
          return (
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <span className={cn("w-3 h-3 rounded-full shrink-0", sc.dotClass)} />
                  {t.title}
                </DialogTitle>
                <DialogDescription>{selectedUser?.full_name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Inicio</p>
                    <p className="font-medium">
                      {t.active_from ? format(parseLocalDate(t.active_from), "d 'de' MMMM, yyyy", { locale: es }) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Fin</p>
                    <p className="font-medium">
                      {t.active_until ? format(parseLocalDate(t.active_until), "d 'de' MMMM, yyyy", { locale: es }) : "Sin definir"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Área</p>
                    <Badge variant="outline" className="text-xs" style={{ backgroundColor: `${areaColor}15`, borderColor: `${areaColor}40`, color: areaColor }}>
                      {areaName}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Tipo</p>
                    <p className="font-medium">{typeLabels[t.type] || t.type}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Estado del usuario</p>
                    <Badge variant="outline" className={cn("text-xs", sc.badgeClass)}>
                      <span className={cn("w-2 h-2 rounded-full mr-1.5 inline-block", sc.dotClass)} />
                      {sc.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Mejor puntaje</p>
                    <p className="font-medium">{t.best_score !== null ? `${Math.round(t.best_score)}%` : "—"}</p>
                  </div>
                </div>
                <Button className="w-full mt-2" onClick={() => navigate(`/training/${t.id}`)}>
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

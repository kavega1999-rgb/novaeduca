import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Download, Search, TrendingUp, TrendingDown, Minus, Users, BookOpen, BarChart3, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import AdherenceReportCard from "@/components/adherence/AdherenceReportCard";
import { getScoreCategory, getCategoryColor } from "@/lib/adherence-utils";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AdherenceReport {
  id: string;
  user_id: string;
  training_id: string;
  pretest_score: number | null;
  postest_score: number | null;
  pretest_category: string | null;
  postest_category: string | null;
  improvement_percentage: number | null;
  conclusion: string | null;
  strategies: string | null;
  created_at: string;
  training_title?: string;
  user_name?: string;
  area_name?: string;
}

interface Training {
  id: string;
  title: string;
  area_id: string;
  target_user_count: number | null;
  is_finished: boolean | null;
  active_from: string | null;
  active_until: string | null;
}

interface TargetArea {
  training_id: string;
  target_area: string;
}

interface Area {
  id: string;
  name: string;
}

const CHART_COLORS = {
  excellent: '#22c55e',
  good: '#3b82f6',
  acceptable: '#f59e0b',
  unacceptable: '#ef4444',
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
};

const AdherenceTabulation = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<AdherenceReport[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTraining, setSelectedTraining] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    checkAccessAndLoadData();
  }, []);

  const checkAccessAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .in("role", ["admin", "leader"]);

    if (!roles || roles.length === 0) {
      navigate("/dashboard");
      return;
    }

    await loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsRes, trainingsRes, areasRes, profilesRes] = await Promise.all([
        supabase
          .from("adherence_reports")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("trainings").select("id, title, area_id, target_user_count, is_finished, active_from, active_until"),
        supabase.from("areas").select("*"),
        supabase.from("profiles").select("id, full_name, area"),
      ]);

      if (reportsRes.data) {
        // Enrich reports with training and user names
        const enrichedReports = reportsRes.data.map((report: any) => {
          const training = trainingsRes.data?.find((t: Training) => t.id === report.training_id);
          const profile = profilesRes.data?.find((p: any) => p.id === report.user_id);
          const area = training ? areasRes.data?.find((a: Area) => a.id === training.area_id) : null;
          
          return {
            ...report,
            training_title: training?.title || 'Capacitación eliminada',
            user_name: profile?.full_name || 'Usuario',
            area_name: area?.name || 'Sin área',
          };
        });
        setReports(enrichedReports);
      }

      if (trainingsRes.data) setTrainings(trainingsRes.data);
      if (areasRes.data) setAreas(areasRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar los datos");
    }
    setLoading(false);
  };

  // Filter reports
  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.training_title?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTraining = selectedTraining === "all" || report.training_id === selectedTraining;
    
    const training = trainings.find(t => t.id === report.training_id);
    const matchesArea = selectedArea === "all" || training?.area_id === selectedArea;
    
    const matchesUser = selectedUser === "all" || report.user_id === selectedUser;
    
    const reportDate = new Date(report.created_at);
    const matchesDateFrom = !dateFrom || reportDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || reportDate <= new Date(dateTo + 'T23:59:59');

    return matchesSearch && matchesTraining && matchesArea && matchesUser && matchesDateFrom && matchesDateTo;
  });

  // Calculate statistics
  const stats = {
    totalReports: filteredReports.length,
    avgPretest: filteredReports.reduce((sum, r) => sum + (r.pretest_score || 0), 0) / (filteredReports.length || 1),
    avgPostest: filteredReports.reduce((sum, r) => sum + (r.postest_score || 0), 0) / (filteredReports.length || 1),
    avgImprovement: filteredReports.reduce((sum, r) => sum + (r.improvement_percentage || 0), 0) / (filteredReports.length || 1),
    categoryDistribution: {
      excellent: filteredReports.filter(r => r.postest_category === 'Excelente').length,
      good: filteredReports.filter(r => r.postest_category === 'Bueno').length,
      acceptable: filteredReports.filter(r => r.postest_category === 'Aceptable').length,
      unacceptable: filteredReports.filter(r => r.postest_category === 'Inaceptable').length,
    }
  };

  const pieChartData = [
    { name: 'Excelente', value: stats.categoryDistribution.excellent, color: CHART_COLORS.excellent },
    { name: 'Bueno', value: stats.categoryDistribution.good, color: CHART_COLORS.good },
    { name: 'Aceptable', value: stats.categoryDistribution.acceptable, color: CHART_COLORS.acceptable },
    { name: 'Inaceptable', value: stats.categoryDistribution.unacceptable, color: CHART_COLORS.unacceptable },
  ].filter(d => d.value > 0);

  // Group reports by training for bar chart
  const trainingStats = trainings.map(training => {
    const trainingReports = filteredReports.filter(r => r.training_id === training.id);
    if (trainingReports.length === 0) return null;
    
    return {
      name: training.title.length > 20 ? training.title.substring(0, 20) + '...' : training.title,
      fullName: training.title,
      pretest: trainingReports.reduce((sum, r) => sum + (r.pretest_score || 0), 0) / trainingReports.length,
      postest: trainingReports.reduce((sum, r) => sum + (r.postest_score || 0), 0) / trainingReports.length,
      count: trainingReports.length,
    };
  }).filter(Boolean);

  const exportCSV = () => {
    const headers = ['Fecha', 'Usuario', 'Capacitación', 'Área', 'Pretest (%)', 'Categoría Pretest', 'Postest (%)', 'Categoría Postest', 'Mejora (%)', 'Conclusión'];
    const rows = filteredReports.map(r => [
      format(new Date(r.created_at), 'dd/MM/yyyy'),
      r.user_name,
      r.training_title,
      r.area_name,
      r.pretest_score?.toFixed(1) || 'N/A',
      r.pretest_category || 'N/A',
      r.postest_score?.toFixed(1) || 'N/A',
      r.postest_category || 'N/A',
      r.improvement_percentage?.toFixed(1) || 'N/A',
      r.conclusion?.replace(/"/g, '""') || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tabulacion_adherencia_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success("Archivo CSV exportado");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tabulación de Adherencia</h1>
          <p className="text-muted-foreground">Comparación Pretest vs Postest por usuario y capacitación</p>
        </div>
        <Button onClick={exportCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Reportes</p>
                    <p className="text-2xl font-bold">{stats.totalReports}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <BarChart3 className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Promedio Pretest</p>
                    <p className="text-2xl font-bold">{stats.avgPretest.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <BookOpen className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Promedio Postest</p>
                    <p className="text-2xl font-bold">{stats.avgPostest.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${stats.avgImprovement >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {stats.avgImprovement >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Mejora Promedio</p>
                    <p className={`text-2xl font-bold ${stats.avgImprovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.avgImprovement >= 0 ? '+' : ''}{stats.avgImprovement.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger>
                    <SelectValue placeholder="Área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las áreas</SelectItem>
                    {areas.map(area => (
                      <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedTraining} onValueChange={setSelectedTraining}>
                  <SelectTrigger>
                    <SelectValue placeholder="Capacitación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {trainings.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="Desde"
                />

                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="Hasta"
                />
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Categoría (Postest)</CardTitle>
              </CardHeader>
              <CardContent>
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No hay datos para mostrar
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comparación Pretest vs Postest por Capacitación</CardTitle>
              </CardHeader>
              <CardContent>
                {trainingStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={trainingStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end" 
                        height={80}
                        fontSize={12}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name === 'pretest' ? 'Pretest' : 'Postest']}
                        labelFormatter={(label) => trainingStats.find(t => t?.name === label)?.fullName || label}
                      />
                      <Legend />
                      <Bar dataKey="pretest" name="Pretest" fill={CHART_COLORS.acceptable} />
                      <Bar dataKey="postest" name="Postest" fill={CHART_COLORS.excellent} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No hay datos para mostrar
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabs for different views */}
          <Tabs defaultValue="table" className="space-y-4">
            <TabsList>
              <TabsTrigger value="table">Tabla Detallada</TabsTrigger>
              <TabsTrigger value="cards">Vista por Tarjetas</TabsTrigger>
            </TabsList>

            <TabsContent value="table">
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Capacitación</TableHead>
                        <TableHead>Área</TableHead>
                        <TableHead className="text-center">Pretest</TableHead>
                        <TableHead className="text-center">Postest</TableHead>
                        <TableHead className="text-center">Mejora</TableHead>
                        <TableHead className="text-center">Categoría Final</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No se encontraron reportes de adherencia
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredReports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell>
                              {format(new Date(report.created_at), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="font-medium">{report.user_name}</TableCell>
                            <TableCell>{report.training_title}</TableCell>
                            <TableCell>{report.area_name}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className="font-medium">{report.pretest_score?.toFixed(1) || 'N/A'}%</span>
                                {report.pretest_category && (
                                  <Badge variant="outline" className={`mt-1 text-xs ${getCategoryColor(report.pretest_category)}`}>
                                    {report.pretest_category}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className="font-medium">{report.postest_score?.toFixed(1) || 'N/A'}%</span>
                                {report.postest_category && (
                                  <Badge variant="outline" className={`mt-1 text-xs ${getCategoryColor(report.postest_category)}`}>
                                    {report.postest_category}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={`flex items-center justify-center gap-1 ${
                                (report.improvement_percentage || 0) > 0 
                                  ? 'text-green-600' 
                                  : (report.improvement_percentage || 0) < 0 
                                    ? 'text-red-600' 
                                    : 'text-muted-foreground'
                              }`}>
                                {(report.improvement_percentage || 0) > 0 ? (
                                  <TrendingUp className="w-4 h-4" />
                                ) : (report.improvement_percentage || 0) < 0 ? (
                                  <TrendingDown className="w-4 h-4" />
                                ) : (
                                  <Minus className="w-4 h-4" />
                                )}
                                <span className="font-medium">
                                  {(report.improvement_percentage || 0) > 0 ? '+' : ''}
                                  {report.improvement_percentage?.toFixed(1) || '0'}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={getCategoryColor(report.postest_category || 'Inaceptable')}>
                                {report.postest_category || 'N/A'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cards">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReports.length === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No se encontraron reportes de adherencia
                    </CardContent>
                  </Card>
                ) : (
                  filteredReports.map((report) => (
                    <AdherenceReportCard
                      key={report.id}
                      report={{
                        ...report,
                        training_title: report.training_title || 'Capacitación',
                      }}
                      showUserName
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
    </div>
  );
};

export default AdherenceTabulation;

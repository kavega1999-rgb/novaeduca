import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Search, Filter, Shield } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AccessLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string;
  user_role: string | null;
  event_type: string;
  event_timestamp: string;
  ip_address: string | null;
  country: string | null;
  region: string | null;
  user_agent: string | null;
  device_type: string | null;
  status: string;
  details: string | null;
}

const AccessLogs = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AccessLog[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdmin = roles?.some(r => r.role === "admin");
      
      if (!isAdmin) {
        navigate("/dashboard");
        return;
      }

      setUserRole(roles?.[0]?.role || "user");
      await fetchLogs();
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("access_logs")
      .select("*")
      .order("event_timestamp", { ascending: false });

    if (error) {
      console.error("Error fetching logs:", error);
      return;
    }

    setLogs(data || []);
    setFilteredLogs(data || []);
  };

  useEffect(() => {
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.user_email.toLowerCase().includes(term) ||
        log.user_name?.toLowerCase().includes(term)
      );
    }

    // Event type filter
    if (eventFilter !== "all") {
      filtered = filtered.filter(log => log.event_type === eventFilter);
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter(log => log.user_role === roleFilter);
    }

    // Date filters
    if (dateFrom) {
      filtered = filtered.filter(log => 
        new Date(log.event_timestamp) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      filtered = filtered.filter(log => 
        new Date(log.event_timestamp) <= new Date(dateTo + "T23:59:59")
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, eventFilter, roleFilter, dateFrom, dateTo]);

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "registro":
        return <Badge className="bg-green-500 hover:bg-green-600">Registro</Badge>;
      case "login":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Login</Badge>;
      case "logout":
        return <Badge className="bg-orange-500 hover:bg-orange-600">Logout</Badge>;
      default:
        return <Badge variant="secondary">{eventType}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    return status === "exitoso" 
      ? <Badge variant="outline" className="border-green-500 text-green-500">Exitoso</Badge>
      : <Badge variant="outline" className="border-red-500 text-red-500">Fallido</Badge>;
  };

  const exportToCSV = () => {
    const headers = [
      "Fecha/Hora",
      "Usuario",
      "Email",
      "Rol",
      "Evento",
      "Estado",
      "IP",
      "País",
      "Región",
      "Dispositivo",
      "Detalles"
    ];

    const rows = filteredLogs.map(log => [
      format(new Date(log.event_timestamp), "dd/MM/yyyy HH:mm:ss"),
      log.user_name || "-",
      log.user_email,
      log.user_role || "-",
      log.event_type,
      log.status,
      log.ip_address || "-",
      log.country || "-",
      log.region || "-",
      log.device_type || "-",
      log.details || "-"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `registro-accesos-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="text-2xl">Registro de Accesos</CardTitle>
                  <CardDescription>
                    Auditoría completa de accesos al sistema
                  </CardDescription>
                </div>
              </div>
              <Button onClick={exportToCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email o nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los eventos</SelectItem>
                  <SelectItem value="registro">Registro</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="user">User</SelectItem>
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

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{filteredLogs.length}</div>
                  <div className="text-sm text-muted-foreground">Total registros</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-500">
                    {filteredLogs.filter(l => l.event_type === "registro").length}
                  </div>
                  <div className="text-sm text-muted-foreground">Registros</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-500">
                    {filteredLogs.filter(l => l.event_type === "login").length}
                  </div>
                  <div className="text-sm text-muted-foreground">Logins</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-orange-500">
                    {filteredLogs.filter(l => l.event_type === "logout").length}
                  </div>
                  <div className="text-sm text-muted-foreground">Logouts</div>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No se encontraron registros
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.event_timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>{log.user_name || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{log.user_email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.user_role || "-"}</Badge>
                        </TableCell>
                        <TableCell>{getEventBadge(log.event_type)}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="font-mono text-sm">{log.ip_address || "-"}</TableCell>
                        <TableCell>
                          {log.country ? `${log.country}${log.region ? `, ${log.region}` : ""}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{log.device_type || "-"}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{log.details || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AccessLogs;

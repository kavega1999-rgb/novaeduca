import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Award, FileText, Search, Filter, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface Training {
  id: string;
  title: string;
  year: number;
  area_id: string;
}

interface Certificate {
  id: string;
  user_id: string;
  training_id: string;
  certificate_type: string;
  file_url: string;
  issued_at: string;
  user_name?: string;
  user_area?: string | null;
  user_position?: string | null;
  training_title?: string;
}

interface Area {
  id: string;
  name: string;
}

const CertificatesAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedTraining, setSelectedTraining] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const years = [...new Set(trainings.map(t => t.year))].sort((a, b) => b - a);

  // Filter trainings by year and area
  const filteredTrainings = trainings.filter(t => {
    const matchesYear = selectedYear === "all" || t.year === parseInt(selectedYear);
    const matchesArea = selectedArea === "all" || t.area_id === selectedArea;
    return matchesYear && matchesArea;
  });

  const trainingIdsInArea = selectedArea === "all" 
    ? trainings.map(t => t.id)
    : trainings.filter(t => t.area_id === selectedArea).map(t => t.id);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAccess = roles?.some(r => r.role === "admin" || r.role === "leader");

      if (!hasAccess) {
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos para acceder a esta página",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      fetchData();
    };

    checkAccess();
  }, [navigate, toast]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [trainingsRes, certificatesRes, profilesRes, areasRes] = await Promise.all([
        supabase.from("trainings").select("id, title, year, area_id").eq("status", "active").order("year", { ascending: false }),
        supabase.from("certificates").select("*").order("issued_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, area, position"),
        supabase.from("areas").select("id, name").order("name"),
      ]);

      setTrainings(trainingsRes.data || []);
      setAreas(areasRes.data || []);

      // Map certificates with user and training data
      const certs = (certificatesRes.data || []).map(cert => {
        const profile = profilesRes.data?.find(p => p.id === cert.user_id);
        const training = trainingsRes.data?.find(t => t.id === cert.training_id);
        return {
          ...cert,
          user_name: profile?.full_name || "N/A",
          user_area: profile?.area,
          user_position: profile?.position,
          training_title: training?.title || "N/A",
        };
      });

      setCertificates(certs);

      // Set default year
      if (trainingsRes.data && trainingsRes.data.length > 0) {
        const currentYear = new Date().getFullYear();
        const hasCurrentYear = trainingsRes.data.some(t => t.year === currentYear);
        if (hasCurrentYear) {
          setSelectedYear(currentYear.toString());
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter certificates
  const filteredCertificates = certificates.filter(c => {
    const matchesTraining = selectedTraining === "all" || c.training_id === selectedTraining;
    const matchesArea = selectedArea === "all" || trainingIdsInArea.includes(c.training_id);
    const matchesYear = selectedYear === "all" || filteredTrainings.some(t => t.id === c.training_id);
    const matchesSearch = searchTerm === "" || 
      c.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.training_title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesTraining && matchesArea && matchesYear && matchesSearch;
  });

  const getAreaLabel = (area: string | null) => {
    const labels: Record<string, string> = {
      medicos: "Médicos",
      asistencial: "Asistencial",
      administrativos: "Administrativos",
    };
    return area ? labels[area] || area : "N/A";
  };

  const downloadCertificate = (fileUrl: string, userName: string, certType: string) => {
    window.open(fileUrl, "_blank");
    toast({
      title: "Descargando",
      description: `Descargando ${certType === "certificate" ? "certificado" : "constancia"} de ${userName}`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const handleRegenerateCertificates = async () => {
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-certificates');
      if (error) throw error;
      toast({
        title: "Certificados regenerados",
        description: `Se regeneraron ${data.regenerated} de ${data.total} certificados${data.failed > 0 ? ` (${data.failed} fallidos)` : ''}`,
      });
      fetchData();
    } catch (error) {
      console.error("Regeneration error:", error);
      toast({
        title: "Error",
        description: "No se pudieron regenerar los certificados",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Certificados</h1>
          <p className="text-muted-foreground text-sm">Descarga certificados y constancias por capacitación</p>
        </div>
        <Button
          onClick={handleRegenerateCertificates}
          disabled={isRegenerating}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
          {isRegenerating ? 'Regenerando...' : 'Regenerar Certificados'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[hsl(152,55%,42%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <Award className="h-8 w-8 text-green-200" />
            <div>
              <p className="text-green-100 text-xs">Total Certificados</p>
              <p className="text-2xl font-bold text-white">
                {certificates.filter(c => c.certificate_type === "certificate").length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,70%,45%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-200" />
            <div>
              <p className="text-blue-100 text-xs">Total Constancias</p>
              <p className="text-2xl font-bold text-white">
                {certificates.filter(c => c.certificate_type === "constancia").length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(210,60%,40%)] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <Download className="h-8 w-8 text-blue-200" />
            <div>
              <p className="text-blue-100 text-xs">Documentos Filtrados</p>
              <p className="text-2xl font-bold text-white">{filteredCertificates.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Área
              </Label>
              <Select value={selectedArea} onValueChange={(value) => {
                setSelectedArea(value);
                setSelectedTraining("all");
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas las áreas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  {areas.map(area => (
                    <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Buscar usuario</Label>
              <Input 
                placeholder="Nombre del usuario..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Año</Label>
              <Select value={selectedYear} onValueChange={(value) => {
                setSelectedYear(value);
                setSelectedTraining("all");
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los años</SelectItem>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Capacitación</Label>
              <Select value={selectedTraining} onValueChange={setSelectedTraining}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas las capacitaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las capacitaciones</SelectItem>
                  {filteredTrainings.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title} ({t.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
            Certificados y Constancias ({filteredCertificates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Capacitación</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center">Fecha Emisión</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCertificates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay certificados con los filtros seleccionados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCertificates.map(cert => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-medium">{cert.user_name}</TableCell>
                      <TableCell>{getAreaLabel(cert.user_area || null)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{cert.training_title}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          cert.certificate_type === "certificate" 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}>
                          {cert.certificate_type === "certificate" ? (
                            <><Award className="h-3 w-3" /> Certificado</>
                          ) : (
                            <><FileText className="h-3 w-3" /> Constancia</>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {format(new Date(cert.issued_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadCertificate(
                            cert.file_url, 
                            cert.user_name || "usuario", 
                            cert.certificate_type
                          )}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Descargar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CertificatesAdmin;

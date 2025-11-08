import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Download, FileText, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Training {
  id: string;
  title: string;
  type: string;
  areas: { name: string } | null;
}

interface UserProgress {
  id: string;
  user_id: string;
  status: string;
  progress_percentage: number;
  completed_at: string | null;
  profiles: {
    full_name: string;
    area: string | null;
    position: string | null;
  };
  certificates: Array<{
    id: string;
    certificate_type: string;
    file_url: string;
  }>;
}

const TrainingReports = () => {
  const { toast } = useToast();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<string | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTrainings();
  }, []);

  useEffect(() => {
    if (selectedTraining) {
      fetchUserProgress();
    }
  }, [selectedTraining]);

  const fetchTrainings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("trainings")
      .select(`
        id,
        title,
        type,
        areas:area_id (name)
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las capacitaciones",
        variant: "destructive",
      });
    } else {
      setTrainings(data as any || []);
      if (data && data.length > 0) {
        setSelectedTraining(data[0].id);
      }
    }
    setIsLoading(false);
  };

  const fetchUserProgress = async () => {
    if (!selectedTraining) return;

    const { data, error } = await supabase
      .from("user_progress")
      .select(`
        id,
        user_id,
        status,
        progress_percentage,
        completed_at,
        profiles!inner (
          full_name,
          area,
          position
        ),
        certificates (
          id,
          certificate_type,
          file_url
        )
      `)
      .eq("training_id", selectedTraining)
      .order("completed_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error fetching user progress:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el progreso de usuarios",
        variant: "destructive",
      });
      setUserProgress([]);
    } else {
      setUserProgress(data as any || []);
    }
  };

  const downloadAttendance = () => {
    if (!selectedTraining || userProgress.length === 0) return;

    const training = trainings.find(t => t.id === selectedTraining);
    const csvContent = [
      ["Nombre", "Área", "Posición", "Estado", "Progreso", "Fecha Completado"].join(","),
      ...userProgress.map(up => [
        up.profiles.full_name,
        up.profiles.area || "N/A",
        up.profiles.position || "N/A",
        up.status === "completed" ? "Completado" : up.status === "in_progress" ? "En progreso" : "Pendiente",
        `${up.progress_percentage}%`,
        up.completed_at ? new Date(up.completed_at).toLocaleDateString() : "N/A"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `asistencia_${training?.title}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Descargado",
      description: "La asistencia ha sido descargada exitosamente",
    });
  };

  const downloadCertificate = (fileUrl: string, userName: string, certType: string) => {
    window.open(fileUrl, "_blank");
    toast({
      title: "Descargando",
      description: `Descargando ${certType === "certificate" ? "certificado" : "constancia"} de ${userName}`,
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      completed: { label: "Completado", variant: "default" },
      in_progress: { label: "En progreso", variant: "secondary" },
      pending: { label: "Pendiente", variant: "outline" },
    };
    const { label, variant } = config[status] || { label: status, variant: "outline" };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getAreaLabel = (area: string | null) => {
    const labels: Record<string, string> = {
      medicos: "Médicos",
      asistencial: "Asistencial",
      administrativos: "Administrativos",
    };
    return area ? labels[area] || area : "N/A";
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando reportes...</div>;
  }

  if (trainings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No hay capacitaciones activas para mostrar reportes</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <Select value={selectedTraining || ""} onValueChange={setSelectedTraining}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar capacitación" />
            </SelectTrigger>
            <SelectContent>
              {trainings.map((training) => (
                <SelectItem key={training.id} value={training.id}>
                  {training.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={downloadAttendance} disabled={userProgress.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Descargar Asistencia
        </Button>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Participantes ({userProgress.length})
            </h3>
            <div className="text-sm text-muted-foreground">
              Completados: {userProgress.filter(up => up.status === "completed").length}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Posición</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Fecha Completado</TableHead>
                  <TableHead className="text-right">Certificados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userProgress.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay usuarios inscritos en esta capacitación
                    </TableCell>
                  </TableRow>
                ) : (
                  userProgress.map((up) => (
                    <TableRow key={up.id}>
                      <TableCell className="font-medium">{up.profiles.full_name}</TableCell>
                      <TableCell>{getAreaLabel(up.profiles.area)}</TableCell>
                      <TableCell>{up.profiles.position || "N/A"}</TableCell>
                      <TableCell>{getStatusBadge(up.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-secondary rounded-full h-2 max-w-[100px]">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${up.progress_percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{up.progress_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {up.completed_at
                          ? new Date(up.completed_at).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {up.certificates.map((cert) => (
                            <Button
                              key={cert.id}
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                downloadCertificate(cert.file_url, up.profiles.full_name, cert.certificate_type)
                              }
                              title={cert.certificate_type === "certificate" ? "Descargar certificado" : "Descargar constancia"}
                            >
                              {cert.certificate_type === "certificate" ? (
                                <Award className="w-4 h-4" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </Button>
                          ))}
                          {up.certificates.length === 0 && up.status === "completed" && (
                            <span className="text-xs text-muted-foreground">Sin documentos</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TrainingReports;

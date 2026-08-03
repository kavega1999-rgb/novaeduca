import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Download, FileText, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getCertificateSignedUrl } from "@/lib/storage-utils";

interface Certificate {
  id: string;
  certificate_type: string;
  issued_at: string;
  file_url: string;
  training_id: string;
  trainings?: {
    title: string;
    type: string;
  };
}

export const CertificatesList = () => {
  const { toast } = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("certificates")
        .select(`
          *,
          trainings (
            title,
            type
          )
        `)
        .eq("user_id", session.user.id)
        .order("issued_at", { ascending: false });

      if (error) throw error;

      setCertificates(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los certificados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (certificate: Certificate) => {
    try {
      // Fetch the PDF and download it directly to avoid CORS issues
      const signedUrl = await getCertificateSignedUrl(certificate.file_url);
      const response = await fetch(signedUrl);
      
      if (!response.ok) {
        throw new Error('No se pudo obtener el archivo');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificado-${certificate.trainings?.title || 'documento'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Certificado descargado",
        description: "El archivo se ha descargado correctamente",
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Error al descargar",
        description: "Si el problema persiste, intenta desde otro navegador o desactiva extensiones de bloqueo",
        variant: "destructive",
      });
    }
  };

  const getCertificateIcon = (type: string) => {
    return type === "certificate" ? <Award className="w-5 h-5" /> : <FileText className="w-5 h-5" />;
  };

  const getCertificateLabel = (type: string) => {
    return type === "certificate" ? "Certificado" : "Constancia";
  };

  if (loading) {
    return (
      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader>
          <CardTitle>Mis Certificados</CardTitle>
          <CardDescription>Cargando certificados...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (certificates.length === 0) {
    return (
      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader>
          <CardTitle>Mis Certificados</CardTitle>
          <CardDescription>Descarga tus certificados y constancias de capacitación</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aún no tienes certificados disponibles</p>
            <p className="text-sm mt-2">Completa capacitaciones para obtener certificados</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={{ boxShadow: "var(--shadow-card)" }}>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg md:text-xl">Mis Certificados</CardTitle>
        <CardDescription className="text-sm">
          Descarga tus certificados y constancias de capacitación ({certificates.length})
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        <div className="space-y-3">
          {certificates.map((certificate) => (
            <div
              key={certificate.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors gap-3"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {getCertificateIcon(certificate.certificate_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-1">
                    <h4 className="font-semibold text-foreground text-sm md:text-base line-clamp-2 md:truncate">
                      {certificate.trainings?.title || "Capacitación"}
                    </h4>
                    <Badge variant="secondary" className="flex-shrink-0 w-fit text-xs">
                      {getCertificateLabel(certificate.certificate_type)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">
                      Emitido el {format(new Date(certificate.issued_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(certificate)}
                className="flex-shrink-0 w-full md:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

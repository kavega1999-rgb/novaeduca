import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Download, FileText, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
      // Open the file URL in a new tab to download
      window.open(certificate.file_url, '_blank');
      
      toast({
        title: "Descargando certificado",
        description: "El archivo se está descargando",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo descargar el certificado",
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
      <CardHeader>
        <CardTitle>Mis Certificados</CardTitle>
        <CardDescription>
          Descarga tus certificados y constancias de capacitación ({certificates.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {certificates.map((certificate) => (
            <div
              key={certificate.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {getCertificateIcon(certificate.certificate_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground truncate">
                      {certificate.trainings?.title || "Capacitación"}
                    </h4>
                    <Badge variant="secondary" className="flex-shrink-0">
                      {getCertificateLabel(certificate.certificate_type)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>
                      Emitido el {format(new Date(certificate.issued_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(certificate)}
                className="flex-shrink-0 ml-4"
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

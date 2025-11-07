import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Award, Users, TrendingUp, ArrowRight } from "lucide-react";
import novasaludLogo from "@/assets/novasalud-logo.jpg";
import heroImage from "@/assets/medical-team-hero.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        navigate("/dashboard");
      } else {
        setChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse">
          <img src={novasaludLogo} alt="Novasalud" className="h-20 w-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-[600px] overflow-hidden">
        <img 
          src={heroImage} 
          alt="Equipo médico Novasalud" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 to-primary/80">
          <div className="container mx-auto px-4 h-full flex flex-col justify-center items-center text-center">
            <img src={novasaludLogo} alt="Novasalud Caribe IPS" className="h-24 w-auto mb-8" />
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Plataforma de Capacitación
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl">
              Desarrollo profesional continuo para nuestro equipo de salud
            </p>
            <div className="flex gap-4">
              <Button 
                size="lg" 
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                onClick={() => navigate("/auth")}
              >
                Iniciar Sesión
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            ¿Por qué capacitarte con nosotros?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Una plataforma diseñada específicamente para el desarrollo profesional en el sector salud
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader>
              <BookOpen className="w-12 h-12 text-primary mb-4" />
              <CardTitle>Contenido de Calidad</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Materiales desarrollados por expertos en salud con experiencia en el sector
              </CardDescription>
            </CardContent>
          </Card>

          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader>
              <Award className="w-12 h-12 text-secondary mb-4" />
              <CardTitle>Certificaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Obtén certificados oficiales que validan tu formación continua
              </CardDescription>
            </CardContent>
          </Card>

          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader>
              <Users className="w-12 h-12 text-accent mb-4" />
              <CardTitle>Aprendizaje Flexible</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Estudia a tu ritmo, desde cualquier lugar y en cualquier momento
              </CardDescription>
            </CardContent>
          </Card>

          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader>
              <TrendingUp className="w-12 h-12 text-primary mb-4" />
              <CardTitle>Seguimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Monitorea tu progreso y mantén un registro de tus logros
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary/5 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            ¿Listo para comenzar tu capacitación?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Accede a la plataforma y comienza a desarrollar tus habilidades profesionales
          </p>
          <Button 
            size="lg"
            onClick={() => navigate("/auth")}
          >
            Ingresar a la Plataforma
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 Novasalud Caribe IPS. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

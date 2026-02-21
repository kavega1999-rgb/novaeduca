import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, Users, BarChart3, Award, Settings, ClipboardCheck, 
  ArrowRight, ArrowLeft, CheckCircle2, Sparkles 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const userSteps: TutorialStep[] = [
  {
    icon: <Sparkles className="w-10 h-10 text-secondary" />,
    title: "¡Bienvenido a NovaEduca!",
    description: "Esta es tu plataforma de capacitación profesional. Aquí podrás acceder a entrenamientos, evaluaciones y certificaciones diseñados para tu crecimiento.",
  },
  {
    icon: <BookOpen className="w-10 h-10 text-primary" />,
    title: "Capacitaciones",
    description: "Explora las capacitaciones disponibles en tu área. Cada una incluye contenido interactivo que puedes revisar a tu ritmo.",
  },
  {
    icon: <ClipboardCheck className="w-10 h-10 text-primary" />,
    title: "Evaluaciones",
    description: "Algunas capacitaciones incluyen pre-test y post-test para medir tu aprendizaje. ¡Prepárate bien y demuestra lo aprendido!",
  },
  {
    icon: <Award className="w-10 h-10 text-secondary" />,
    title: "Certificados",
    description: "Al completar exitosamente una capacitación y su evaluación, recibirás un certificado digital que podrás descargar desde tu perfil.",
  },
];

const leaderSteps: TutorialStep[] = [
  {
    icon: <Sparkles className="w-10 h-10 text-secondary" />,
    title: "¡Bienvenido, Líder!",
    description: "Como líder de área, tienes acceso a herramientas avanzadas para gestionar capacitaciones y hacer seguimiento del progreso de tu equipo.",
  },
  {
    icon: <BookOpen className="w-10 h-10 text-primary" />,
    title: "Gestión de Capacitaciones",
    description: "Puedes crear, editar y publicar capacitaciones para tu equipo desde el panel de administración. Define contenido, evaluaciones y fechas.",
  },
  {
    icon: <Users className="w-10 h-10 text-primary" />,
    title: "Seguimiento de Equipo",
    description: "Revisa el progreso de los miembros de tu área, sus resultados en evaluaciones y tasas de completamiento.",
  },
  {
    icon: <BarChart3 className="w-10 h-10 text-primary" />,
    title: "Reportes",
    description: "Accede a reportes detallados de adherencia y desempeño. Genera informes para tomar decisiones informadas.",
  },
  {
    icon: <Award className="w-10 h-10 text-secondary" />,
    title: "Certificados",
    description: "Gestiona y visualiza los certificados emitidos a los miembros de tu equipo.",
  },
];

const adminSteps: TutorialStep[] = [
  {
    icon: <Sparkles className="w-10 h-10 text-secondary" />,
    title: "¡Bienvenido, Administrador!",
    description: "Tienes acceso total a la plataforma NovaEduca. Desde aquí puedes gestionar todas las capacitaciones, usuarios y reportes de la organización.",
  },
  {
    icon: <Settings className="w-10 h-10 text-primary" />,
    title: "Panel de Administración",
    description: "Tu panel lateral te da acceso rápido a todas las herramientas: capacitaciones, usuarios, reportes, certificados y más.",
  },
  {
    icon: <BookOpen className="w-10 h-10 text-primary" />,
    title: "Capacitaciones",
    description: "Crea y gestiona capacitaciones para todas las áreas. Define contenido PDF o video, evaluaciones, pre-tests y fechas de activación.",
  },
  {
    icon: <Users className="w-10 h-10 text-primary" />,
    title: "Gestión de Usuarios",
    description: "Administra los usuarios de la plataforma, asigna roles (admin, líder, usuario) y gestiona la base de empleados autorizados.",
  },
  {
    icon: <BarChart3 className="w-10 h-10 text-primary" />,
    title: "Reportes y Adherencia",
    description: "Accede a reportes completos de asistencia, evaluaciones y adherencia. Exporta datos y genera informes para auditorías.",
  },
  {
    icon: <Award className="w-10 h-10 text-secondary" />,
    title: "¡Estás listo!",
    description: "Explora la plataforma y comienza a gestionar las capacitaciones de tu organización. Si necesitas ayuda, usa el chat flotante de preguntas frecuentes.",
  },
];

interface OnboardingTutorialProps {
  isOpen: boolean;
  onComplete: () => void;
  userRole: string;
  userId: string;
}

const OnboardingTutorial = ({ isOpen, onComplete, userRole, userId }: OnboardingTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = userRole === "admin" ? adminSteps : userRole === "leader" ? leaderSteps : userSteps;
  const totalSteps = steps.length;
  const step = steps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;

  const handleComplete = async () => {
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);
    } catch (e) {
      console.error("Error updating onboarding status:", e);
    }
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 [&>button]:hidden" style={{ boxShadow: "var(--shadow-hover)" }}>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted w-full">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="px-6 pt-6 pb-8 flex flex-col items-center text-center">
          {/* Step indicator */}
          <span className="text-xs text-muted-foreground mb-4">
            {currentStep + 1} de {totalSteps}
          </span>

          {/* Icon */}
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            {step.icon}
          </div>

          {/* Content */}
          <h2 className="text-xl font-bold text-foreground mb-3">{step.title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">{step.description}</p>

          {/* Step dots */}
          <div className="flex gap-1.5 my-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentStep ? "w-6 bg-primary" : i < currentStep ? "w-2 bg-primary/40" : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-3 w-full max-w-xs">
            {currentStep > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(s => s - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Atrás
              </Button>
            )}
            {isLastStep ? (
              <Button className="flex-1" onClick={handleComplete}>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                ¡Comenzar!
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => setCurrentStep(s => s + 1)}>
                Siguiente
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>

          {/* Skip */}
          {!isLastStep && (
            <button
              onClick={handleComplete}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Omitir tutorial
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingTutorial;

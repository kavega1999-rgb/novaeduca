import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

const userSteps: TourStep[] = [
  {
    target: "nav-bar",
    title: "Barra de Navegación",
    description: "Desde aquí puedes acceder a tu perfil, tus capacitaciones y cerrar sesión.",
    position: "bottom",
  },
  {
    target: "hero-section",
    title: "Tu Centro de Aprendizaje",
    description: "Esta es tu plataforma de capacitación profesional. Aquí encontrarás todo lo necesario para tu desarrollo.",
    position: "bottom",
  },
  {
    target: "stats-section",
    title: "Tu Progreso",
    description: "Aquí puedes ver tus estadísticas: capacitaciones totales, completadas, en progreso y tu avance promedio.",
    position: "bottom",
  },
  {
    target: "certificates-section",
    title: "Tus Certificados",
    description: "Al completar capacitaciones y evaluaciones exitosamente, tus certificados aparecerán aquí para descargar.",
    position: "top",
  },
  {
    target: "areas-section",
    title: "Áreas de Capacitación",
    description: "Explora las diferentes áreas de capacitación disponibles. Haz clic en cualquiera para ver sus entrenamientos.",
    position: "top",
  },
];

const leaderSteps: TourStep[] = [
  {
    target: "nav-bar",
    title: "Navegación Principal",
    description: "Accede rápidamente a tu perfil, capacitaciones y opciones de sesión.",
    position: "bottom",
  },
  {
    target: "admin-sidebar",
    title: "Panel de Administración",
    description: "Como líder, tienes acceso a este menú lateral con herramientas de gestión: capacitaciones, analítica, usuarios y más.",
    position: "right",
  },
  {
    target: "stats-section",
    title: "Estadísticas Generales",
    description: "Revisa el progreso general de las capacitaciones, completadas y en curso.",
    position: "bottom",
  },
  {
    target: "certificates-section",
    title: "Certificados",
    description: "Gestiona y visualiza los certificados emitidos a los miembros de tu equipo.",
    position: "top",
  },
  {
    target: "areas-section",
    title: "Áreas de Capacitación",
    description: "Accede a las capacitaciones de cada área y haz seguimiento del progreso de tu equipo.",
    position: "top",
  },
];

const adminSteps: TourStep[] = [
  {
    target: "nav-bar",
    title: "Navegación Principal",
    description: "Accede a tu perfil, capacitaciones y gestiona tu sesión desde aquí.",
    position: "bottom",
  },
  {
    target: "admin-sidebar",
    title: "Panel de Administración",
    description: "Tu menú completo de gestión: capacitaciones, analítica (progreso, adherencia, tabulación, asistencia), usuarios, certificados y auditoría.",
    position: "right",
  },
  {
    target: "hero-section",
    title: "Panel Principal",
    description: "Vista general de tu plataforma. Desde aquí puedes monitorear el estado general de NovaEduca.",
    position: "bottom",
  },
  {
    target: "stats-section",
    title: "Métricas Clave",
    description: "Visualiza el total de capacitaciones, completadas, en progreso y el promedio de avance de toda la organización.",
    position: "bottom",
  },
  {
    target: "certificates-section",
    title: "Certificados Emitidos",
    description: "Revisa y gestiona todos los certificados y constancias generados por la plataforma.",
    position: "top",
  },
  {
    target: "areas-section",
    title: "Áreas de Capacitación",
    description: "Administra las capacitaciones por área. Crea nuevos entrenamientos, evaluaciones y configura fechas de activación.",
    position: "top",
  },
];

interface OnboardingTutorialProps {
  isOpen: boolean;
  onComplete: () => void;
  userRole: string;
  userId: string;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 12;

const OnboardingTutorial = ({ isOpen, onComplete, userRole, userId }: OnboardingTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [ready, setReady] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps = userRole === "admin" ? adminSteps : userRole === "leader" ? leaderSteps : userSteps;
  const totalSteps = steps.length;
  const step = steps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;

  const updateSpotlight = useCallback(() => {
    if (!isOpen || !step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setSpotlight(null);
      setReady(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    const s: SpotlightRect = {
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    };
    setSpotlight(s);

    // Scroll element into view
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Calculate tooltip position after a tick
    requestAnimationFrame(() => {
      const pos = step.position || "bottom";
      const tooltip: React.CSSProperties = { position: "fixed" };
      const tooltipWidth = 340;
      const tooltipHeight = 180;

      if (pos === "bottom") {
        tooltip.top = s.top + s.height + 16;
        tooltip.left = Math.max(16, Math.min(s.left + s.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));
      } else if (pos === "top") {
        tooltip.top = s.top - tooltipHeight - 16;
        tooltip.left = Math.max(16, Math.min(s.left + s.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));
      } else if (pos === "right") {
        tooltip.top = Math.max(16, s.top + s.height / 2 - tooltipHeight / 2);
        tooltip.left = s.left + s.width + 16;
      } else if (pos === "left") {
        tooltip.top = Math.max(16, s.top + s.height / 2 - tooltipHeight / 2);
        tooltip.left = s.left - tooltipWidth - 16;
      }

      // Clamp vertical
      if ((tooltip.top as number) < 16) tooltip.top = 16;
      if ((tooltip.top as number) + tooltipHeight > window.innerHeight - 16) {
        tooltip.top = window.innerHeight - tooltipHeight - 16;
      }

      setTooltipStyle(tooltip);
      setReady(true);
    });
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    setReady(false);
    const timer = setTimeout(updateSpotlight, 300);
    window.addEventListener("resize", updateSpotlight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateSpotlight);
    };
  }, [isOpen, currentStep, updateSpotlight]);

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

  if (!isOpen) return null;

  const overlayClipPath = spotlight
    ? `polygon(
        0% 0%, 0% 100%, 
        ${spotlight.left}px 100%, 
        ${spotlight.left}px ${spotlight.top}px, 
        ${spotlight.left + spotlight.width}px ${spotlight.top}px, 
        ${spotlight.left + spotlight.width}px ${spotlight.top + spotlight.height}px, 
        ${spotlight.left}px ${spotlight.top + spotlight.height}px, 
        ${spotlight.left}px 100%, 
        100% 100%, 100% 0%
      )`
    : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "auto" }}>
      {/* Dark overlay with hole */}
      <div
        className="fixed inset-0 bg-foreground/70 transition-all duration-500"
        style={{ clipPath: overlayClipPath }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Spotlight border glow */}
      {spotlight && (
        <div
          className="fixed rounded-xl border-2 border-primary shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all duration-500 pointer-events-none"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      {/* Tooltip card */}
      {ready && (
        <div
          ref={tooltipRef}
          className="fixed z-[10000] w-[340px] bg-card border border-border rounded-xl p-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          style={{ ...tooltipStyle, boxShadow: "var(--shadow-hover)" }}
        >
          {/* Close button */}
          <button
            onClick={handleComplete}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Step count */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>

          {/* Content */}
          <h3 className="text-base font-bold text-foreground mb-2">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.description}</p>

          {/* Progress dots */}
          <div className="flex gap-1 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep ? "w-5 bg-primary" : i < currentStep ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(s => s - 1)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Atrás
              </Button>
            )}
            <div className="flex-1" />
            {isLastStep ? (
              <Button size="sm" onClick={handleComplete}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                ¡Entendido!
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCurrentStep(s => s + 1)}>
                Siguiente
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default OnboardingTutorial;

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

const FAQ = () => {
  const faqs = [
    {
      question: "¿Cómo accedo a mis capacitaciones asignadas?",
      answer: "Puedes ver todas tus capacitaciones asignadas en la sección 'Capacitaciones' del menú principal. Allí encontrarás las capacitaciones activas organizadas por áreas."
    },
    {
      question: "¿Cómo sé si completé una capacitación correctamente?",
      answer: "Para completar una capacitación, debes ver todo el contenido hasta el final. El sistema rastrea tu progreso automáticamente. Si la capacitación requiere evaluación, también deberás aprobarla con el puntaje mínimo requerido."
    },
    {
      question: "¿Qué pasa si no apruebo una evaluación?",
      answer: "Puedes realizar múltiples intentos según lo configure el administrador. Cada capacitación tiene un número máximo de intentos permitidos. Si no apruebas, podrás revisar el contenido nuevamente antes de volver a intentarlo."
    },
    {
      question: "¿Cómo descargo mi certificado o constancia?",
      answer: "Una vez completada la capacitación y aprobada la evaluación (si aplica), tu certificado o constancia se generará automáticamente. Puedes descargarlo desde tu Dashboard en la sección 'Mis Certificados'."
    },
    {
      question: "¿Cuánto tiempo tengo para completar una capacitación?",
      answer: "El tiempo de duración de cada capacitación está indicado en los detalles de la misma. Sin embargo, puedes completarla a tu propio ritmo. El sistema guarda tu progreso automáticamente."
    },
    {
      question: "¿Qué hago si el contenido no se carga?",
      answer: "Si experimentas problemas al cargar el contenido, verifica tu conexión a internet. Si el problema persiste, intenta refrescar la página o contacta al administrador del sistema."
    },
    {
      question: "¿Puedo ver el contenido en mi dispositivo móvil?",
      answer: "Sí, la plataforma está optimizada para funcionar en computadoras, tablets y dispositivos móviles. Puedes acceder desde cualquier navegador moderno."
    },
    {
      question: "¿Cómo actualizo mi perfil?",
      answer: "Puedes actualizar tu información de perfil haciendo clic en el ícono de usuario en la parte superior derecha y seleccionando 'Perfil'."
    }
  ];

  return (
    <Card style={{ boxShadow: "var(--shadow-card)" }}>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-6 h-6 text-primary" />
          <CardTitle className="text-2xl">Preguntas Frecuentes</CardTitle>
        </div>
        <CardDescription>
          Encuentra respuestas a las preguntas más comunes sobre la plataforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default FAQ;
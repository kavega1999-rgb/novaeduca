import { useState, useRef, useEffect } from "react";
import { MessageCircleQuestion, Send, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
}

const faqs = [
  {
    question: "¿Cómo accedo a mis capacitaciones asignadas?",
    answer: "Puedes ver todas tus capacitaciones asignadas en la sección 'Capacitaciones' del menú principal. Allí encontrarás las capacitaciones activas organizadas por áreas.",
    keywords: ["capacitaciones", "acceder", "asignadas", "ver", "encontrar"]
  },
  {
    question: "¿Cómo sé si completé una capacitación correctamente?",
    answer: "Para completar una capacitación, debes ver todo el contenido hasta el final. El sistema rastrea tu progreso automáticamente. Si la capacitación requiere evaluación, también deberás aprobarla con el puntaje mínimo requerido.",
    keywords: ["completar", "completé", "correctamente", "progreso", "terminar"]
  },
  {
    question: "¿Qué pasa si no apruebo una evaluación?",
    answer: "Puedes realizar múltiples intentos según lo configure el administrador. Cada capacitación tiene un número máximo de intentos permitidos. Si no apruebas, podrás revisar el contenido nuevamente antes de volver a intentarlo.",
    keywords: ["apruebo", "evaluación", "intentos", "reprobar", "fallar", "examen"]
  },
  {
    question: "¿Cómo descargo mi certificado o constancia?",
    answer: "Una vez completada la capacitación y aprobada la evaluación (si aplica), tu certificado o constancia se generará automáticamente. Puedes descargarlo desde tu Dashboard en la sección 'Mis Certificados'.",
    keywords: ["certificado", "constancia", "descargar", "obtener", "diploma"]
  },
  {
    question: "¿Cuánto tiempo tengo para completar una capacitación?",
    answer: "El tiempo de duración de cada capacitación está indicado en los detalles de la misma. Sin embargo, puedes completarla a tu propio ritmo. El sistema guarda tu progreso automáticamente.",
    keywords: ["tiempo", "duración", "plazo", "límite", "completar"]
  },
  {
    question: "¿Qué hago si el contenido no se carga?",
    answer: "Si experimentas problemas al cargar el contenido, verifica tu conexión a internet. Si el problema persiste, intenta refrescar la página o contacta al administrador del sistema.",
    keywords: ["carga", "problema", "error", "contenido", "funciona"]
  },
  {
    question: "¿Puedo ver el contenido en mi dispositivo móvil?",
    answer: "Sí, la plataforma está optimizada para funcionar en computadoras, tablets y dispositivos móviles. Puedes acceder desde cualquier navegador moderno.",
    keywords: ["móvil", "celular", "tablet", "dispositivo", "teléfono"]
  },
  {
    question: "¿Cómo actualizo mi perfil?",
    answer: "Puedes actualizar tu información de perfil haciendo clic en el ícono de usuario en la parte superior derecha y seleccionando 'Perfil'.",
    keywords: ["perfil", "actualizar", "cambiar", "datos", "información"]
  }
];

const FloatingFAQChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "bot",
      content: "¡Hola! 👋 Soy tu asistente de ayuda. ¿En qué puedo ayudarte hoy? Puedes escribir tu pregunta o seleccionar una de las preguntas frecuentes."
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const findAnswer = (query: string): string => {
    const queryLower = query.toLowerCase();
    
    // Try to match by keywords
    for (const faq of faqs) {
      const hasKeyword = faq.keywords.some(keyword => 
        queryLower.includes(keyword.toLowerCase())
      );
      if (hasKeyword) {
        return faq.answer;
      }
    }
    
    // Try to match by question similarity
    for (const faq of faqs) {
      const questionWords = faq.question.toLowerCase().split(" ");
      const matchCount = questionWords.filter(word => 
        queryLower.includes(word) && word.length > 3
      ).length;
      if (matchCount >= 2) {
        return faq.answer;
      }
    }
    
    return "No encontré una respuesta específica para tu pregunta. Te sugiero revisar las preguntas frecuentes o contactar al administrador del sistema para más ayuda.";
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setShowSuggestions(false);
    
    // Simulate typing delay
    setTimeout(() => {
      const answer = findAnswer(inputValue);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: answer
      };
      setMessages(prev => [...prev, botMessage]);
    }, 500);
  };

  const handleQuestionClick = (question: string, answer: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: question
    };
    
    setMessages(prev => [...prev, userMessage]);
    setShowSuggestions(false);
    
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: answer
      };
      setMessages(prev => [...prev, botMessage]);
    }, 300);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-24 z-40 h-14 w-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "transition-all duration-300 hover:scale-110",
          isOpen && "hidden"
        )}
      >
        <MessageCircleQuestion className="h-6 w-6" />
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-background border rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px] max-h-[calc(100vh-6rem)]">
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary-foreground/20 p-2 rounded-full">
                  <MessageCircleQuestion className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Asistente de Ayuda</h3>
                  <p className="text-xs opacity-80">Preguntas Frecuentes</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.type === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                        message.type === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                
                {/* Suggestions */}
                {showSuggestions && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground font-medium">Preguntas frecuentes:</p>
                    <div className="flex flex-wrap gap-2">
                      {faqs.slice(0, 4).map((faq, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuestionClick(faq.question, faq.answer)}
                          className="text-xs bg-secondary/50 hover:bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full transition-colors text-left"
                        >
                          {faq.question.slice(0, 35)}...
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowSuggestions(false)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Ver todas las preguntas <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
                
                {!showSuggestions && messages.length > 1 && (
                  <button
                    onClick={() => setShowSuggestions(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Ver preguntas sugeridas
                  </button>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t bg-background">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe tu pregunta..."
                  className="flex-1 rounded-full"
                />
                <Button
                  onClick={handleSend}
                  size="icon"
                  className="rounded-full shrink-0"
                  disabled={!inputValue.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingFAQChat;

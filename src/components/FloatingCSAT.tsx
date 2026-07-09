import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FACES = [
  { score: 1, emoji: "😞", label: "Muy insatisfecho" },
  { score: 2, emoji: "🙁", label: "Insatisfecho" },
  { score: 3, emoji: "😐", label: "Neutral" },
  { score: 4, emoji: "🙂", label: "Satisfecho" },
  { score: 5, emoji: "😄", label: "Muy satisfecho" },
];

const SNOOZE_KEY = "csat_snooze_until";
const SNOOZE_DAYS = 7;

interface Props {
  context?: string;
  contextId?: string;
  contextLabel?: string;
}

export default function FloatingCSAT({ context = "general", contextId, contextLabel }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const until = localStorage.getItem(SNOOZE_KEY);
    if (until && Number(until) > Date.now()) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  }, []);

  const snooze = () => {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, String(until));
    setHidden(true);
    setOpen(false);
  };

  const submit = async () => {
    if (!score) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("satisfaction_feedback").insert({
      user_id: user.id,
      score,
      comment: comment.trim() || null,
      context,
      context_id: contextId ?? null,
      context_label: contextLabel ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "¡Gracias!", description: "Tu opinión nos ayuda a mejorar." });
    setScore(null);
    setComment("");
    snooze();
  };

  if (hidden) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" className="rounded-full shadow-lg gap-2 h-10 px-4">
            <Smile className="h-4 w-4" />
            ¿Cómo vamos?
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-80">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-semibold text-sm">Tu opinión importa</p>
              <p className="text-xs text-muted-foreground">¿Qué tan satisfecho estás con la plataforma?</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1" onClick={snooze} title="No mostrar por 7 días">
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex justify-between gap-1 my-3">
            {FACES.map(f => (
              <button
                key={f.score}
                type="button"
                onClick={() => setScore(f.score)}
                title={f.label}
                className={`text-2xl transition rounded-md p-1.5 hover:bg-muted ${score === f.score ? "bg-primary/15 scale-110" : ""}`}
              >
                {f.emoji}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Comentario (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="text-sm min-h-[60px]"
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="flex-1" onClick={submit} disabled={!score || saving}>
              {saving ? "Enviando..." : "Enviar"}
            </Button>
            <Button size="sm" variant="outline" onClick={snooze}>Más tarde</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
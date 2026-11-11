import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { prepareAuthorizedEmployee } from "@/lib/authorized-employee";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AddEmployeeDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (saving) return;
    setOpen(next);
    setErrorMessage("");
    if (!next) { setName(""); setDocument(""); }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage("");
    try {
      const employee = prepareAuthorizedEmployee(name, document);
      const { error } = await supabase.from("authorized_employees").insert(employee);
      if (error) {
        if (error.code === "23505") throw new Error("Este número de documento ya está autorizado para registrarse.");
        if (error.code === "42501") throw new Error("Solo los administradores pueden agregar empleados.");
        throw new Error("No se pudo agregar el empleado. Inténtalo nuevamente.");
      }
      toast({ title: "Empleado agregado", description: `${employee.full_name} ya puede registrarse con su documento.` });
      setOpen(false);
      setName("");
      setDocument("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo agregar el empleado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 shrink-0"><UserPlus className="h-4 w-4" />Agregar empleado</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar empleado</DialogTitle>
          <DialogDescription>Autorizar registro de un nuevo empleado.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee-name">Nombre completo</Label>
            <Input id="employee-name" value={name} onChange={e => setName(e.target.value)} required disabled={saving} autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-document">Número de documento</Label>
            <Input id="employee-document" value={document} onChange={e => setDocument(e.target.value)} required disabled={saving} autoComplete="off" />
          </div>
          {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving || !name.trim() || !document.trim()}>{saving ? "Guardando..." : "Guardar empleado"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
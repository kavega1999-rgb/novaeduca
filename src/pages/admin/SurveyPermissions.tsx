import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PERMISSIONS = [
  { key: "create", label: "Crear encuestas" },
  { key: "edit", label: "Editar encuestas" },
  { key: "delete", label: "Eliminar encuestas" },
  { key: "publish", label: "Publicar encuestas" },
  { key: "close", label: "Cerrar encuestas" },
  { key: "view_responses", label: "Ver respuestas" },
  { key: "export", label: "Exportar información" },
  { key: "view_dashboard", label: "Consultar dashboards" },
  { key: "manage_templates", label: "Administrar plantillas" },
  { key: "manage_own_area", label: "Administrar solo su área" },
  { key: "manage_all", label: "Administrar todo (global)" },
] as const;

type PermKey = typeof PERMISSIONS[number]["key"];

interface Profile { id: string; full_name: string; position: string | null; }
interface Area { id: string; name: string; }
interface Perm { id: string; user_id: string; permission: PermKey; scope_area_id: string | null; }

export default function SurveyPermissions() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [scopeArea, setScopeArea] = useState<string>("__global__");
  const [pending, setPending] = useState<Set<PermKey>>(new Set());

  const load = async () => {
    const [p, a, up] = await Promise.all([
      supabase.from("profiles").select("id,full_name,position").order("full_name"),
      supabase.from("areas").select("id,name").order("name"),
      supabase.from("survey_user_permissions").select("id,user_id,permission,scope_area_id"),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setAreas((a.data ?? []) as Area[]);
    setPerms((up.data ?? []) as Perm[]);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => profiles.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase())),
    [profiles, search]
  );

  const userPerms = useMemo(
    () => perms.filter((p) => p.user_id === selectedUser),
    [perms, selectedUser]
  );

  const hasPerm = (key: PermKey) => {
    const area = scopeArea === "__global__" ? null : scopeArea;
    return userPerms.some((p) => p.permission === key && p.scope_area_id === area);
  };

  const togglePerm = async (key: PermKey, next: boolean) => {
    if (!selectedUser) return;
    setPending((s) => new Set(s).add(key));
    const area = scopeArea === "__global__" ? null : scopeArea;
    try {
      if (next) {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("survey_user_permissions").insert({
          user_id: selectedUser,
          permission: key,
          scope_area_id: area,
          granted_by: userData.user?.id ?? null,
        });
        if (error) throw error;
      } else {
        const target = userPerms.find((p) => p.permission === key && p.scope_area_id === area);
        if (target) {
          const { error } = await supabase.from("survey_user_permissions").delete().eq("id", target.id);
          if (error) throw error;
        }
      }
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPending((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  const revokeAll = async () => {
    if (!selectedUser) return;
    const { error } = await supabase.from("survey_user_permissions").delete().eq("user_id", selectedUser);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Permisos revocados" });
      await load();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Shield className="w-7 h-7 text-primary" />
          Permisos del módulo de Encuestas
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Asigna a cada líder los permisos que puede ejercer en el módulo.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Usuarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar usuario…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y">
              {filtered.map((p) => {
                const count = perms.filter((x) => x.user_id === p.id).length;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedUser(p.id)}
                    className={`w-full text-left py-2 px-2 rounded hover:bg-muted flex items-center justify-between ${selectedUser === p.id ? "bg-muted" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.full_name}</p>
                      {p.position && <p className="text-xs text-muted-foreground truncate">{p.position}</p>}
                    </div>
                    {count > 0 && <Badge variant="secondary">{count}</Badge>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Permisos asignados</CardTitle>
            <CardDescription>
              Selecciona el ámbito (global o por área) y marca los permisos correspondientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedUser ? (
              <p className="text-sm text-muted-foreground">Selecciona un usuario para asignar permisos.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Ámbito:</span>
                  <Select value={scopeArea} onValueChange={setScopeArea}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__global__">Global (todas las áreas)</SelectItem>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  {PERMISSIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={hasPerm(perm.key)}
                        disabled={pending.has(perm.key)}
                        onCheckedChange={(v) => togglePerm(perm.key, !!v)}
                      />
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button variant="destructive" size="sm" onClick={revokeAll}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Revocar todos los permisos
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
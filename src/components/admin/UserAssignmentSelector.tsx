import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  full_name: string;
  area: string | null;
  position: string | null;
  status: string;
}

interface UserAssignmentSelectorProps {
  selectedUserIds: string[];
  onSelectionChange: (userIds: string[]) => void;
  trainingId?: string;
}

const areaLabels: Record<string, string> = {
  medicos: "Médicos",
  asistencial: "Asistencial",
  administrativos: "Administrativos",
};

const UserAssignmentSelector = ({ selectedUserIds, onSelectionChange, trainingId }: UserAssignmentSelectorProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (trainingId) fetchExistingAssignments();
  }, [trainingId]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, area, position, status")
      .eq("status", "active")
      .order("full_name");
    if (data) setProfiles(data as Profile[]);
    setLoading(false);
  };

  const fetchExistingAssignments = async () => {
    if (!trainingId) return;
    const { data } = await supabase
      .from("training_assignments")
      .select("user_id")
      .eq("training_id", trainingId);
    if (data) {
      onSelectionChange(data.map(a => a.user_id));
    }
  };

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = p.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.position?.toLowerCase().includes(search.toLowerCase()));
      const matchesArea = filterArea === "all" || p.area === filterArea;
      return matchesSearch && matchesArea;
    });
  }, [profiles, search, filterArea]);

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onSelectionChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onSelectionChange([...selectedUserIds, userId]);
    }
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredProfiles.map(p => p.id);
    const merged = [...new Set([...selectedUserIds, ...filteredIds])];
    onSelectionChange(merged);
  };

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredProfiles.map(p => p.id));
    onSelectionChange(selectedUserIds.filter(id => !filteredIds.has(id)));
  };

  const selectByArea = (area: string) => {
    const areaIds = profiles.filter(p => p.area === area).map(p => p.id);
    const merged = [...new Set([...selectedUserIds, ...areaIds])];
    onSelectionChange(merged);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando usuarios...</p>;
  }

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Asignar Usuarios
        </Label>
        <Badge variant="secondary">
          <UserCheck className="h-3 w-3 mr-1" />
          {selectedUserIds.length} seleccionados
        </Badge>
      </div>

      {/* Quick area selection */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Seleccionar por área:</span>
        {Object.entries(areaLabels).map(([key, label]) => (
          <Button key={key} variant="outline" size="sm" className="text-xs h-7" onClick={() => selectByArea(key)}>
            {label}
          </Button>
        ))}
      </div>

      {/* Search & filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o cargo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <select
          value={filterArea}
          onChange={e => setFilterArea(e.target.value)}
          className="border rounded-md px-2 text-sm bg-background"
        >
          <option value="all">Todas las áreas</option>
          {Object.entries(areaLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAllFiltered}>
          Seleccionar todos ({filteredProfiles.length})
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAllFiltered}>
          Deseleccionar todos
        </Button>
      </div>

      {/* User list */}
      <ScrollArea className="h-[250px] border rounded-md">
        <div className="divide-y">
          {filteredProfiles.map(p => (
            <label
              key={p.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors",
                selectedUserIds.includes(p.id) && "bg-primary/5"
              )}
            >
              <Checkbox
                checked={selectedUserIds.includes(p.id)}
                onCheckedChange={() => toggleUser(p.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.position || "Sin cargo"}</p>
              </div>
              {p.area && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {areaLabels[p.area] || p.area}
                </Badge>
              )}
            </label>
          ))}
          {filteredProfiles.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">No se encontraron usuarios.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default UserAssignmentSelector;

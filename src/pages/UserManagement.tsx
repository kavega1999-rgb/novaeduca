import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Shield, UserCog, MapPin, FolderOpen } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type UserArea = Database["public"]["Enums"]["user_area"];

interface TrainingArea {
  id: string;
  name: string;
}

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  area: UserArea | null;
  position: string | null;
  status: string;
  role: AppRole;
  leader_area_id: string | null;
  leader_area_name: string | null;
}

const roleLabels: Record<AppRole, string> = {
  admin: "Administrador",
  leader: "Líder",
  user: "Usuario",
};

const roleBadgeVariants: Record<AppRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  leader: "secondary",
  user: "outline",
};

const areaLabels: Record<UserArea, string> = {
  medicos: "Médicos",
  asistencial: "Asistencial",
  administrativos: "Administrativos",
};

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [trainingAreas, setTrainingAreas] = useState<TrainingArea[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingAreaUserId, setUpdatingAreaUserId] = useState<string | null>(null);
  const [updatingLeaderAreaUserId, setUpdatingLeaderAreaUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAccessAndFetchUsers();
  }, []);

  useEffect(() => {
    const filtered = users.filter(
      (user) =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const checkAccessAndFetchUsers = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r) => r.role === "admin");

    if (!isAdmin) {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores pueden gestionar usuarios",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    await fetchUsers();
  };

  const fetchUsers = async () => {
    setIsLoading(true);

    // Fetch training areas
    const { data: areasData } = await supabase
      .from("areas")
      .select("id, name")
      .order("name");
    
    setTrainingAreas(areasData || []);

    // Fetch profiles with their roles and leader_area
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(`
        id, 
        full_name, 
        area, 
        position, 
        status,
        leader_area_id,
        areas:leader_area_id (id, name)
      `)
      .order("full_name");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Fetch all user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
    }

    // Create a map of user_id to role
    const roleMap = new Map<string, AppRole>();
    userRoles?.forEach((ur) => {
      const currentRole = roleMap.get(ur.user_id);
      if (!currentRole || 
          (ur.role === "admin") || 
          (ur.role === "leader" && currentRole === "user")) {
        roleMap.set(ur.user_id, ur.role);
      }
    });

    // We need to get emails from access_logs as a fallback
    const { data: accessLogs } = await supabase
      .from("access_logs")
      .select("user_id, user_email")
      .not("user_id", "is", null);

    const emailMap = new Map<string, string>();
    accessLogs?.forEach((log) => {
      if (log.user_id && log.user_email) {
        emailMap.set(log.user_id, log.user_email);
      }
    });

    // Build users with roles
    const usersWithRoles: UserWithRole[] = profiles.map((profile: any) => ({
      id: profile.id,
      full_name: profile.full_name,
      email: emailMap.get(profile.id) || "Sin email registrado",
      area: profile.area,
      position: profile.position,
      status: profile.status,
      role: roleMap.get(profile.id) || "user",
      leader_area_id: profile.leader_area_id,
      leader_area_name: profile.areas?.name || null,
    }));

    setUsers(usersWithRoles);
    setFilteredUsers(usersWithRoles);
    setIsLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdatingUserId(userId);

    try {
      // First, delete existing roles for this user
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Then insert the new role
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });

      if (insertError) throw insertError;

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );

      toast({
        title: "Rol actualizado",
        description: `El rol ha sido cambiado a ${roleLabels[newRole]}`,
      });
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol",
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAreaChange = async (userId: string, newArea: UserArea | "none") => {
    setUpdatingAreaUserId(userId);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ area: newArea === "none" ? null : newArea })
        .eq("id", userId);

      if (error) throw error;

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, area: newArea === "none" ? null : newArea } : user
        )
      );

      toast({
        title: "Área actualizada",
        description: newArea === "none" 
          ? "Se ha removido el área del usuario"
          : `El área ha sido cambiada a ${areaLabels[newArea]}`,
      });
    } catch (error) {
      console.error("Error updating area:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el área",
        variant: "destructive",
      });
    } finally {
      setUpdatingAreaUserId(null);
    }
  };

  const handleLeaderAreaChange = async (userId: string, newAreaId: string) => {
    setUpdatingLeaderAreaUserId(userId);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ leader_area_id: newAreaId === "none" ? null : newAreaId })
        .eq("id", userId);

      if (error) throw error;

      const areaName = trainingAreas.find(a => a.id === newAreaId)?.name || null;

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { 
            ...user, 
            leader_area_id: newAreaId === "none" ? null : newAreaId,
            leader_area_name: areaName
          } : user
        )
      );

      toast({
        title: "Área de capacitación actualizada",
        description: newAreaId === "none" 
          ? "Se ha removido el área de capacitación del líder"
          : `El área de capacitación ha sido asignada a ${areaName}`,
      });
    } catch (error) {
      console.error("Error updating leader area:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el área de capacitación",
        variant: "destructive",
      });
    } finally {
      setUpdatingLeaderAreaUserId(null);
    }
  };

  const getAreaLabel = (area: UserArea | null) => {
    return area ? areaLabels[area] : "Sin área";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando usuarios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <UserCog className="h-8 w-8 text-primary" />
          Gestión de Usuarios
        </h1>
        <p className="text-muted-foreground mt-2">
          Administra los roles y permisos de los usuarios del sistema
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Usuarios</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{users.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Administradores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {users.filter((u) => u.role === "admin").length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Líderes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-secondary" />
              <span className="text-2xl font-bold">
                {users.filter((u) => u.role === "leader").length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios Registrados</CardTitle>
          <CardDescription>
            Selecciona un rol para cambiar los permisos de cada usuario
          </CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Área Usuario</TableHead>
                  <TableHead>Área de Capacitación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          {user.position && (
                            <div className="text-sm text-muted-foreground">
                              {user.position}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.area || "none"}
                          onValueChange={(value) =>
                            handleAreaChange(user.id, value as UserArea | "none")
                          }
                          disabled={updatingAreaUserId === user.id}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3" />
                                {getAreaLabel(user.area)}
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin área</SelectItem>
                            <SelectItem value="medicos">Médicos</SelectItem>
                            <SelectItem value="asistencial">Asistencial</SelectItem>
                            <SelectItem value="administrativos">Administrativos</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {user.role === "leader" ? (
                          <Select
                            value={user.leader_area_id || "none"}
                            onValueChange={(value) =>
                              handleLeaderAreaChange(user.id, value)
                            }
                            disabled={updatingLeaderAreaUserId === user.id}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue>
                                <div className="flex items-center gap-2">
                                  <FolderOpen className="h-3 w-3" />
                                  {user.leader_area_name || "Sin asignar"}
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin asignar</SelectItem>
                              {trainingAreas.map(area => (
                                <SelectItem key={area.id} value={area.id}>
                                  {area.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === "active" ? "default" : "secondary"}
                        >
                          {user.status === "active" ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value: AppRole) =>
                            handleRoleChange(user.id, value)
                          }
                          disabled={updatingUserId === user.id}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue>
                              <Badge variant={roleBadgeVariants[user.role]}>
                                {roleLabels[user.role]}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Administrador
                              </div>
                            </SelectItem>
                            <SelectItem value="leader">
                              <div className="flex items-center gap-2">
                                <UserCog className="h-4 w-4" />
                                Líder
                              </div>
                            </SelectItem>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Usuario
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Users, Shield, UserCog, MapPin, FolderOpen, KeyRound, Pencil, Eye, EyeOff, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
  leader_area_ids: string[];
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

  // Password reset dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Position edit dialog
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState("");
  const [savingPosition, setSavingPosition] = useState(false);

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

    const { data: areasData } = await supabase
      .from("areas")
      .select("id, name")
      .order("name");
    
    setTrainingAreas(areasData || []);

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

    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
    }

    const roleMap = new Map<string, AppRole>();
    userRoles?.forEach((ur) => {
      const currentRole = roleMap.get(ur.user_id);
      if (!currentRole || 
          (ur.role === "admin") || 
          (ur.role === "leader" && currentRole === "user")) {
        roleMap.set(ur.user_id, ur.role);
      }
    });

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
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });
      if (insertError) throw insertError;

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
      toast({ title: "Error", description: "No se pudo actualizar el rol", variant: "destructive" });
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
      toast({ title: "Error", description: "No se pudo actualizar el área", variant: "destructive" });
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
      toast({ title: "Error", description: "No se pudo actualizar el área de capacitación", variant: "destructive" });
    } finally {
      setUpdatingLeaderAreaUserId(null);
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }

    setResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("admin-update-user", {
        body: { userId: selectedUser.id, newPassword, action: "reset_password" },
      });

      if (response.error) throw new Error(response.error.message);

      toast({
        title: "Contraseña actualizada",
        description: `La contraseña de ${selectedUser.full_name} ha sido cambiada exitosamente`,
      });
      setPasswordDialogOpen(false);
      setNewPassword("");
      setShowPassword(false);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({ title: "Error", description: error.message || "No se pudo cambiar la contraseña", variant: "destructive" });
    } finally {
      setResettingPassword(false);
    }
  };

  const handlePositionSave = async () => {
    if (!selectedUser) return;
    setSavingPosition(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ position: editingPosition || null })
        .eq("id", selectedUser.id);
      if (error) throw error;

      setUsers((prev) =>
        prev.map((user) =>
          user.id === selectedUser.id ? { ...user, position: editingPosition || null } : user
        )
      );

      toast({
        title: "Cargo actualizado",
        description: `El cargo de ${selectedUser.full_name} ha sido actualizado`,
      });
      setPositionDialogOpen(false);
    } catch (error) {
      console.error("Error updating position:", error);
      toast({ title: "Error", description: "No se pudo actualizar el cargo", variant: "destructive" });
    } finally {
      setSavingPosition(false);
    }
  };

  const openPasswordDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setNewPassword("");
    setShowPassword(false);
    setPasswordDialogOpen(true);
  };

  const openPositionDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setEditingPosition(user.position || "");
    setPositionDialogOpen(true);
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
          Administra los roles, áreas, cargos y contraseñas de los usuarios
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
            Gestiona roles, áreas, cargos y contraseñas de cada usuario
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
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Área Usuario</TableHead>
                  <TableHead>Área de Capacitación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">{user.full_name}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{user.position || "Sin cargo"}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openPositionDialog(user)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
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
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPasswordDialog(user)}
                          className="gap-1"
                        >
                          <KeyRound className="h-3 w-3" />
                          Contraseña
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Cambiar la contraseña de <strong>{selectedUser?.full_name}</strong> ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePasswordReset} disabled={resettingPassword || newPassword.length < 6}>
              {resettingPassword ? "Guardando..." : "Cambiar Contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Edit Dialog */}
      <Dialog open={positionDialogOpen} onOpenChange={setPositionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cargo</DialogTitle>
            <DialogDescription>
              Editar el cargo de <strong>{selectedUser?.full_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="position">Cargo</Label>
              <Input
                id="position"
                value={editingPosition}
                onChange={(e) => setEditingPosition(e.target.value)}
                placeholder="Ej: Enfermera, Médico General, Coordinador..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPositionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePositionSave} disabled={savingPosition}>
              {savingPosition ? "Guardando..." : "Guardar Cargo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;

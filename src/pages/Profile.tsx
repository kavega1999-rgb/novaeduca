import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import FloatingDocumentsButton from "@/components/documents/FloatingDocumentsButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Briefcase, Building2, Save, Award, BookOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [profile, setProfile] = useState<{
    full_name: string;
    position: string;
    area: "medicos" | "asistencial" | "administrativos" | "";
    email: string;
  }>({
    full_name: "",
    position: "",
    area: "",
    email: "",
  });
  const [stats, setStats] = useState({
    totalCompleted: 0,
    totalInProgress: 0,
    averageScore: 0,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileData) {
        setUserRole(profileData.role);
        setProfile({
          full_name: profileData.full_name || "",
          position: profileData.position || "",
          area: profileData.area || "",
          email: session.user.email || "",
        });
      }

      // Fetch user statistics
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", session.user.id);

      if (progressData) {
        const completed = progressData.filter(p => p.status === "completed").length;
        const inProgress = progressData.filter(p => p.status === "in_progress").length;
        
        setStats({
          totalCompleted: completed,
          totalInProgress: inProgress,
          averageScore: 0, // Will be calculated when evaluations are implemented
        });
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          position: profile.position,
          area: profile.area || null,
        })
        .eq("id", session.user.id);

      if (error) throw error;

      toast({
        title: "Perfil actualizado",
        description: "Tus datos han sido guardados exitosamente.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation userRole={userRole} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Cargando perfil...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Mi Perfil</h1>

        <div className="grid gap-6">
          {/* Profile Information */}
          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Información Personal</CardTitle>
                  <CardDescription>Actualiza tus datos de perfil</CardDescription>
                </div>
                <Badge className="capitalize">{userRole}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullname">
                  <User className="w-4 h-4 inline mr-2" />
                  Nombre completo
                </Label>
                <Input
                  id="fullname"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Juan Pérez"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">
                  <Briefcase className="w-4 h-4 inline mr-2" />
                  Cargo
                </Label>
                <Input
                  id="position"
                  value={profile.position}
                  onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                  placeholder="Médico General"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="area">
                  <Building2 className="w-4 h-4 inline mr-2" />
                  Área
                </Label>
                <Select 
                  value={profile.area} 
                  onValueChange={(value) => setProfile({ ...profile, area: value as "medicos" | "asistencial" | "administrativos" })}
                >
                  <SelectTrigger id="area">
                    <SelectValue placeholder="Selecciona tu área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medicos">Médicos</SelectItem>
                    <SelectItem value="asistencial">Asistencial</SelectItem>
                    <SelectItem value="administrativos">Administrativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader>
              <CardTitle>Estadísticas de Aprendizaje</CardTitle>
              <CardDescription>Tu progreso en la plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                      <Award className="w-6 h-6 text-secondary-foreground" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.totalCompleted}</div>
                      <div className="text-sm text-muted-foreground">Capacitaciones completadas</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-accent-foreground" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.totalInProgress}</div>
                      <div className="text-sm text-muted-foreground">En progreso</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <FloatingDocumentsButton isAdmin={userRole === "admin"} />
    </div>
  );
};

export default Profile;

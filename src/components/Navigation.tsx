import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Home, BookOpen, User, LogOut, Settings, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { logAccess } from "@/hooks/useAccessLog";
import novasaludLogo from "@/assets/novasalud-logo-color.png";

interface NavigationProps {
  userRole?: string;
}

const Navigation = ({ userRole }: NavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || "");
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setUserName(profile.full_name);
        }
      }
    };

    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    // Log logout before signing out (while we still have user context)
    await logAccess({
      userId: userId,
      userName: userName,
      userEmail: userEmail,
      userRole: userRole,
      eventType: 'logout',
      status: 'exitoso'
    });

    await supabase.auth.signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión exitosamente.",
    });
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="border-b bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
              <img 
                src={novasaludLogo} 
                alt="Novasalud Caribe IPS" 
                className="h-12 w-auto object-contain"
              />
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Button
                variant={isActive("/dashboard") ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate("/dashboard")}
              >
                <Home className="w-4 h-4 mr-2" />
                Inicio
              </Button>
              <Button
                variant={isActive("/trainings") ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate("/trainings")}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Capacitaciones
              </Button>
              <Button
                variant={isActive("/documents") ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate("/documents")}
              >
                <FileText className="w-4 h-4 mr-2" />
                Documentos
              </Button>
              {(userRole === "admin" || userRole === "leader") && (
                <Button
                  variant={isActive("/admin") ? "default" : "ghost"}
                  size="sm"
                  onClick={() => navigate("/admin")}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Administración
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <div className="text-sm font-medium text-foreground">{userName}</div>
              <div className="text-xs text-muted-foreground capitalize">{userRole}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
            >
              <User className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

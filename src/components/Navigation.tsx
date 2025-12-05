import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Home, BookOpen, User, LogOut, Settings, Menu, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { logAccess } from "@/hooks/useAccessLog";
import novasaludLogo from "@/assets/novasalud-logo-color.png";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="border-b bg-card sticky top-0 z-50" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          <div className="flex items-center gap-4 md:gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
              <img 
                src={novasaludLogo} 
                alt="Novasalud Caribe IPS" 
                className="h-10 md:h-12 w-auto object-contain"
              />
            </div>

            {/* Desktop Navigation */}
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

          {/* Desktop User Info */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
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

          {/* Mobile Menu */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
            >
              <User className="w-5 h-5" />
            </Button>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <div className="flex flex-col h-full">
                  {/* User Info */}
                  <div className="p-4 border-b bg-muted/30">
                    <div className="text-base font-medium text-foreground">{userName}</div>
                    <div className="text-sm text-muted-foreground capitalize">{userRole}</div>
                  </div>

                  {/* Navigation Links */}
                  <div className="flex-1 py-4">
                    <div className="space-y-1 px-2">
                      <Button
                        variant={isActive("/dashboard") ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => handleNavigate("/dashboard")}
                      >
                        <Home className="w-5 h-5 mr-3" />
                        Inicio
                      </Button>
                      <Button
                        variant={isActive("/trainings") ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => handleNavigate("/trainings")}
                      >
                        <BookOpen className="w-5 h-5 mr-3" />
                        Capacitaciones
                      </Button>
                      {(userRole === "admin" || userRole === "leader") && (
                        <Button
                          variant={isActive("/admin") ? "secondary" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => handleNavigate("/dashboard/trainings")}
                        >
                          <Settings className="w-5 h-5 mr-3" />
                          Administración
                        </Button>
                      )}
                      <Button
                        variant={isActive("/profile") ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => handleNavigate("/profile")}
                      >
                        <User className="w-5 h-5 mr-3" />
                        Mi Perfil
                      </Button>
                    </div>
                  </div>

                  {/* Logout */}
                  <div className="p-4 border-t">
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-5 h-5 mr-2" />
                      Cerrar Sesión
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

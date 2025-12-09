import { useState, useCallback } from "react";
import { LayoutDashboard, BarChart3, BookOpen, Shield, UserCog, ChevronDown, TrendingUp, ClipboardCheck, FileSpreadsheet, Award, Home, PanelLeftClose, PanelLeft } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import novasaludLogo from "@/assets/novasalud-logo-color.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "Panel Principal", url: "/dashboard", icon: LayoutDashboard },
  { title: "Gestionar Capacitaciones", url: "/dashboard/trainings", icon: BookOpen },
];

const analyticsItems = [
  { title: "Capacitaciones y Progreso", url: "/dashboard/reports", icon: TrendingUp },
  { title: "Adherencia de Evaluaciones", url: "/dashboard/adherence", icon: ClipboardCheck },
  { title: "Asistencia y Registros", url: "/dashboard/attendance", icon: FileSpreadsheet },
];

const managementItems = [
  { title: "Gestión de Usuarios", url: "/dashboard/users", icon: UserCog },
  { title: "Gestión de Certificados", url: "/dashboard/certificates", icon: Award },
];

const auditItems = [
  { title: "Registro de Accesos", url: "/access-logs", icon: Shield },
];

export function AdminSidebar() {
  const { open, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isAnalyticsActive = analyticsItems.some(item => isActive(item.url));
  
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsActive);
  const [isHovering, setIsHovering] = useState(false);
  const [isPinned, setIsPinned] = useState(true);

  const handleMouseEnter = useCallback(() => {
    if (!isPinned && !isMobile) {
      setIsHovering(true);
      setOpen(true);
    }
  }, [isPinned, isMobile, setOpen]);

  const handleMouseLeave = useCallback(() => {
    if (!isPinned && !isMobile) {
      setIsHovering(false);
      setOpen(false);
    }
  }, [isPinned, isMobile, setOpen]);

  const togglePin = useCallback(() => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    if (!newPinned) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [isPinned, setOpen]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Sidebar collapsible="icon" className="border-r border-border/50">
        {/* Header with Logo and Toggle */}
        <SidebarHeader className="border-b border-border/30 px-3 py-4">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-3 group flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/20 group-hover:to-primary/10 transition-all shadow-sm">
                <img 
                  src={novasaludLogo} 
                  alt="Novasalud" 
                  className="w-7 h-7 object-contain"
                />
              </div>
              {open && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-foreground tracking-tight truncate">Novasalud</span>
                  <span className="text-xs text-muted-foreground truncate">Panel Administrativo</span>
                </div>
              )}
            </Link>
            {open && (
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePin}
                className="h-8 w-8 shrink-0 hover:bg-accent"
                title={isPinned ? "Desanclar panel" : "Anclar panel"}
              >
                {isPinned ? (
                  <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          {/* Main Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider px-3 mb-2">
              Navegación
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {mainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-accent/50"
                        activeClassName="bg-primary text-primary-foreground font-medium shadow-md hover:bg-primary/90"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="my-3 bg-border/30" />

          {/* Analytics & Compliance */}
          <SidebarGroup>
            <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen} className="group/collapsible">
              <SidebarMenuItem className="list-none">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton 
                    tooltip="Analítica y Cumplimiento"
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full cursor-pointer hover:bg-accent/50",
                      isAnalyticsActive && "bg-accent text-accent-foreground"
                    )}
                  >
                    <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
                    <span className="flex-1 text-left font-medium truncate">Analítica</span>
                    <ChevronDown className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-300 text-muted-foreground",
                      analyticsOpen && "rotate-180"
                    )} />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
              </SidebarMenuItem>
              <CollapsibleContent className="mt-1 space-y-1">
                {analyticsItems.map((item) => (
                  <SidebarMenuItem key={item.title} className="list-none">
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-3 px-3 py-2 ml-2 rounded-lg transition-all text-sm hover:bg-accent/50 border-l-2 border-transparent"
                        activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary hover:bg-primary/15"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>

          <Separator className="my-3 bg-border/30" />

          {/* Management */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider px-3 mb-2">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {managementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-accent/50"
                        activeClassName="bg-primary text-primary-foreground font-medium shadow-md hover:bg-primary/90"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="my-3 bg-border/30" />

          {/* Audit Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider px-3 mb-2">
              Auditoría
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {auditItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-accent/50"
                        activeClassName="bg-primary text-primary-foreground font-medium shadow-md hover:bg-primary/90"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="border-t border-border/30 p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Ir al inicio">
                <Link
                  to="/"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                >
                  <Home className="h-5 w-5 shrink-0" />
                  <span className="truncate">Ir al inicio</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </div>
  );
}

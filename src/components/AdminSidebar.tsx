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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [isPinned, setIsPinned] = useState(true);

  const handleMouseEnter = useCallback(() => {
    if (!isPinned && !isMobile) {
      setOpen(true);
    }
  }, [isPinned, isMobile, setOpen]);

  const handleMouseLeave = useCallback(() => {
    if (!isPinned && !isMobile) {
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
      className="h-full"
    >
      <Sidebar 
        collapsible="icon" 
        className={cn(
          "border-r border-border/40 bg-sidebar transition-all duration-300 ease-in-out",
          "shadow-lg"
        )}
      >
        {/* Header with Logo and Toggle */}
        <SidebarHeader className="border-b border-border/20 px-4 py-5 bg-gradient-to-b from-sidebar to-sidebar/95">
          <div className="flex items-center justify-between gap-3">
            <Link to="/dashboard" className="flex items-center gap-3 group flex-1 min-w-0">
              <div className={cn(
                "rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center shrink-0 transition-all duration-300",
                "group-hover:from-primary/30 group-hover:via-primary/15 shadow-md",
                open ? "w-11 h-11" : "w-9 h-9"
              )}>
                <img 
                  src={novasaludLogo} 
                  alt="Novasalud" 
                  className={cn(
                    "object-contain transition-all duration-300",
                    open ? "w-7 h-7" : "w-6 h-6"
                  )}
                />
              </div>
              <div className={cn(
                "flex flex-col min-w-0 transition-all duration-300 overflow-hidden",
                open ? "opacity-100 max-w-[150px]" : "opacity-0 max-w-0"
              )}>
                <span className="font-bold text-foreground tracking-tight truncate text-sm">Novasalud</span>
                <span className="text-[10px] text-muted-foreground truncate">Panel Administrativo</span>
              </div>
            </Link>
            <div className={cn(
              "transition-all duration-300 overflow-hidden",
              open ? "opacity-100 max-w-[40px]" : "opacity-0 max-w-0"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePin}
                    className="h-8 w-8 shrink-0 hover:bg-accent/80 transition-colors"
                  >
                    {isPinned ? (
                      <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <PanelLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isPinned ? "Colapsar panel" : "Fijar panel abierto"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 py-4">
          {/* Main Navigation */}
          <SidebarGroup className="space-y-1">
            <SidebarGroupLabel className={cn(
              "text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-3 mb-3 transition-all duration-300",
              !open && "opacity-0"
            )}>
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
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                          "hover:bg-accent/60 hover:shadow-sm",
                          "group/item"
                        )}
                        activeClassName="bg-primary text-primary-foreground font-semibold shadow-lg hover:bg-primary/90 hover:shadow-lg"
                      >
                        <item.icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover/item:scale-110" />
                        <span className={cn(
                          "truncate transition-all duration-300",
                          open ? "opacity-100" : "opacity-0"
                        )}>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="my-4 bg-border/20" />

          {/* Analytics & Compliance */}
          <SidebarGroup>
            <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen} className="group/collapsible">
              <SidebarMenuItem className="list-none">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton 
                    tooltip="Analítica y Cumplimiento"
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full cursor-pointer",
                      "hover:bg-accent/60 hover:shadow-sm",
                      isAnalyticsActive && "bg-accent/80 text-accent-foreground shadow-sm"
                    )}
                  >
                    <BarChart3 className="h-5 w-5 shrink-0 text-primary transition-transform duration-200 hover:scale-110" />
                    <span className={cn(
                      "flex-1 text-left font-medium truncate transition-all duration-300",
                      open ? "opacity-100" : "opacity-0"
                    )}>Analítica</span>
                    <ChevronDown className={cn(
                      "h-4 w-4 shrink-0 transition-all duration-300 text-muted-foreground",
                      analyticsOpen && "rotate-180",
                      !open && "opacity-0"
                    )} />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
              </SidebarMenuItem>
              <CollapsibleContent className={cn(
                "mt-1.5 space-y-1 overflow-hidden transition-all duration-300",
                open ? "ml-2 pl-2 border-l-2 border-primary/20" : ""
              )}>
                {analyticsItems.map((item) => (
                  <SidebarMenuItem key={item.title} className="list-none">
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                          "hover:bg-accent/50 hover:shadow-sm",
                          "group/subitem"
                        )}
                        activeClassName="bg-primary/15 text-primary font-semibold hover:bg-primary/20"
                      >
                        <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover/subitem:scale-110" />
                        <span className={cn(
                          "truncate transition-all duration-300",
                          open ? "opacity-100" : "opacity-0"
                        )}>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>

          <Separator className="my-4 bg-border/20" />

          {/* Management */}
          <SidebarGroup className="space-y-1">
            <SidebarGroupLabel className={cn(
              "text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-3 mb-3 transition-all duration-300",
              !open && "opacity-0"
            )}>
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
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                          "hover:bg-accent/60 hover:shadow-sm",
                          "group/item"
                        )}
                        activeClassName="bg-primary text-primary-foreground font-semibold shadow-lg hover:bg-primary/90"
                      >
                        <item.icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover/item:scale-110" />
                        <span className={cn(
                          "truncate transition-all duration-300",
                          open ? "opacity-100" : "opacity-0"
                        )}>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="my-4 bg-border/20" />

          {/* Audit Section */}
          <SidebarGroup className="space-y-1">
            <SidebarGroupLabel className={cn(
              "text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-3 mb-3 transition-all duration-300",
              !open && "opacity-0"
            )}>
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
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                          "hover:bg-accent/60 hover:shadow-sm",
                          "group/item"
                        )}
                        activeClassName="bg-primary text-primary-foreground font-semibold shadow-lg hover:bg-primary/90"
                      >
                        <item.icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover/item:scale-110" />
                        <span className={cn(
                          "truncate transition-all duration-300",
                          open ? "opacity-100" : "opacity-0"
                        )}>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="border-t border-border/20 p-3 bg-gradient-to-t from-muted/30 to-transparent">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Ir al inicio">
                <Link
                  to="/"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                    "hover:bg-accent/60 text-muted-foreground hover:text-foreground",
                    "group/item"
                  )}
                >
                  <Home className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover/item:scale-110" />
                  <span className={cn(
                    "truncate transition-all duration-300",
                    open ? "opacity-100" : "opacity-0"
                  )}>Ir al inicio</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </div>
  );
}

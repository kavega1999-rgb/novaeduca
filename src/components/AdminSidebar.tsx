import { useState } from "react";
import { LayoutDashboard, BarChart3, BookOpen, FolderOpen, Shield, UserCog, ChevronDown, TrendingUp, ClipboardCheck, FileSpreadsheet, Award } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  { title: "Documentos Institucionales", url: "/documents", icon: FolderOpen },
];

const auditItems = [
  { title: "Registro de Accesos", url: "/access-logs", icon: Shield },
];

export function AdminSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isAnalyticsActive = analyticsItems.some(item => isActive(item.url));
  
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsActive);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {/* Main Items */}
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Analytics & Compliance - Collapsible */}
              <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      tooltip="Analítica y Cumplimiento"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all w-full cursor-pointer",
                        isAnalyticsActive && "bg-sidebar-accent/50"
                      )}
                    >
                      <BarChart3 className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-left">Analítica y Cumplimiento</span>
                      <ChevronDown className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        analyticsOpen && "rotate-180"
                      )} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent className="pl-4">
                  {analyticsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          end
                          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {/* Management Items */}
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Audit Section - Separate */}
        <SidebarGroup>
          <SidebarGroupLabel>Auditoría</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {auditItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

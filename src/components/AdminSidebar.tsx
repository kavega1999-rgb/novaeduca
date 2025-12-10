import { useState, useCallback } from "react";
import { LayoutDashboard, BarChart3, BookOpen, Shield, UserCog, ChevronRight, TrendingUp, ClipboardCheck, FileSpreadsheet, Award, Home, Menu } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

const menuItems = [
  { 
    title: "Panel Principal", 
    icon: LayoutDashboard,
    url: "/dashboard",
    children: [] 
  },
  { 
    title: "Capacitaciones", 
    icon: BookOpen,
    children: [
      { title: "Gestionar", url: "/dashboard/trainings" },
    ]
  },
  { 
    title: "Analítica", 
    icon: BarChart3,
    children: [
      { title: "Progreso", url: "/dashboard/reports" },
      { title: "Adherencia", url: "/dashboard/adherence" },
      { title: "Asistencia", url: "/dashboard/attendance" },
    ]
  },
  { 
    title: "Administración", 
    icon: UserCog,
    children: [
      { title: "Usuarios", url: "/dashboard/users" },
      { title: "Certificados", url: "/dashboard/certificates" },
    ]
  },
  { 
    title: "Auditoría", 
    icon: Shield,
    children: [
      { title: "Registro de Accesos", url: "/access-logs" },
    ]
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isOpen, setIsOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState<string[]>(["Analítica"]);

  const isActive = (path: string) => currentPath === path;
  const isMenuActive = (item: typeof menuItems[0]) => {
    if (item.url) return isActive(item.url);
    return item.children.some(child => isActive(child.url));
  };

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const handleMouseEnter = useCallback(() => {
    if (!isOpen) setIsOpen(true);
  }, [isOpen]);

  const handleMouseLeave = useCallback(() => {
    // Keep open by default
  }, []);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "sticky top-0 h-screen flex flex-col transition-all duration-300 ease-in-out shrink-0",
        "bg-primary text-white",
        isOpen ? "w-64" : "w-16"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <Link to="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <span className={cn(
            "font-bold text-lg whitespace-nowrap transition-all duration-300",
            isOpen ? "opacity-100" : "opacity-0 w-0"
          )}>
            Panel Admin
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 shrink-0"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {menuItems.map((item) => {
            const hasChildren = item.children.length > 0;
            const menuIsOpen = openMenus.includes(item.title);
            const active = isMenuActive(item);

            if (!hasChildren && item.url) {
              return (
                <li key={item.title}>
                  <NavLink
                    to={item.url}
                    end
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      "text-white/70 hover:text-white hover:bg-white/10",
                      isActive(item.url) && "bg-white/15 text-white"
                    )}
                    activeClassName="bg-white/15 text-white"
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className={cn(
                      "whitespace-nowrap transition-all duration-300",
                      isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                    )}>
                      {item.title}
                    </span>
                  </NavLink>
                </li>
              );
            }

            return (
              <li key={item.title}>
                <Collapsible open={menuIsOpen && isOpen} onOpenChange={() => toggleMenu(item.title)}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full",
                        "text-white/70 hover:text-white hover:bg-white/10",
                        active && "text-white"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className={cn(
                        "flex-1 text-left whitespace-nowrap transition-all duration-300",
                        isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                      )}>
                        {item.title}
                      </span>
                      <ChevronRight className={cn(
                        "h-4 w-4 shrink-0 transition-all duration-300",
                        menuIsOpen && "rotate-90",
                        !isOpen && "opacity-0"
                      )} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <ul className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.url}>
                          <NavLink
                            to={child.url}
                            end
                            className={cn(
                              "flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200",
                              "text-white/60 hover:text-white hover:bg-white/10"
                            )}
                            activeClassName="bg-white/15 text-white"
                          >
                            <span className={cn(
                              "whitespace-nowrap transition-all duration-300",
                              isOpen ? "opacity-100" : "opacity-0"
                            )}>
                              {child.title}
                            </span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        <Link
          to="/"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
            "text-white/70 hover:text-white hover:bg-white/10"
          )}
        >
          <Home className="h-5 w-5 shrink-0" />
          <span className={cn(
            "whitespace-nowrap transition-all duration-300",
            isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
          )}>
            Ir al inicio
          </span>
        </Link>
      </div>
    </div>
  );
}

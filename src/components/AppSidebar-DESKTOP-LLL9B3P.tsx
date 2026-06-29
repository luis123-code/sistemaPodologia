import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  BarChart3,
  Footprints,
  MapPinned,
  Stethoscope,
  Package,
  Receipt,
  FileText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type MenuItem = { title: string; url: string; icon: typeof LayoutDashboard };

const navGroups: { label: string; items: MenuItem[] }[] = [
  {
    label: "General",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "Domicilio",
    items: [
      { title: "Pacientes", url: "/pacientes", icon: Users },
      { title: "Visitas agendadas", url: "/citas", icon: CalendarDays },
      { title: "Historial médico", url: "/historial", icon: ClipboardList },
      { title: "Ruta del día", url: "/ruta-dia", icon: MapPinned },
      { title: "Servicios y tarifas", url: "/servicios", icon: Stethoscope },
    ],
  },
  {
    label: "Gestión",
    items: [
      { title: "Inventario", url: "/inventario", icon: Package },
      { title: "Facturación", url: "/facturacion", icon: Receipt },
      { title: "Reportes", url: "/reportes", icon: BarChart3 },
    ],
  },
  {
    label: "Documentación",
    items: [{ title: "Plantillas", url: "/documentacion", icon: FileText }],
  },
];

function linkIsActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/";
  return pathname === url;
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const location = useLocation();

  const closeMobileNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border bg-gradient-to-br from-primary/5 to-transparent py-4",
          collapsed ? "px-2" : "px-4 py-5",
        )}
      >
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/20">
            <Footprints className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">FootCare</h1>
              <p className="text-xs text-muted-foreground">Podología a domicilio</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4 gap-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-2",
                collapsed && "sr-only",
              )}
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = linkIsActive(location.pathname, item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          onClick={closeMobileNav}
                          title={collapsed ? item.title : undefined}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-primary/15"
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

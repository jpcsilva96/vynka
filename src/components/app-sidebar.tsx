import { Link, useRouterState } from "@tanstack/react-router";
import {
  ShoppingCart,
  ClipboardList,
  Package,
  Globe,
  Users,
  History,
  Wallet,
  BarChart3,
  UserCog,
  Settings,
  LayoutDashboard,
  Compass,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { VynkaLogo } from "@/components/vynka-logo";

const primary = [
  { title: "Vender", url: "/admin/vender", icon: ShoppingCart },
  { title: "Pedidos", url: "/admin/pedidos", icon: ClipboardList },
  { title: "Produtos", url: "/admin/produtos", icon: Package },
  { title: "Catálogo Online", url: "/admin/minha-loja", icon: Globe },
  { title: "Clientes", url: "/admin/clientes", icon: Users },
  { title: "Histórico", url: "/admin/historico", icon: History },
  { title: "Finanças", url: "/admin/financas", icon: Wallet },
  { title: "Estatísticas", url: "/admin/estatisticas", icon: BarChart3 },
  { title: "Usuários", url: "/admin/usuarios", icon: UserCog },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
];

const workspace = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Configuração inicial", url: "/admin/onboarding", icon: Compass },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) =>
    path === "/admin" ? currentPath === "/admin" : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="h-16 justify-center px-5">
        <Link to="/admin" className="flex items-center">
          <VynkaLogo variant="dark" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
            Operação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="h-10 rounded-md text-white/70 hover:bg-white/5 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white data-[active=true]:font-medium"
                  >
                    <Link to={item.url}>
                      <item.icon strokeWidth={1.5} className="h-4 w-4" />
                      <span className="text-[13px]">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
            Loja
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspace.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="h-10 rounded-md text-white/70 hover:bg-white/5 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white data-[active=true]:font-medium"
                  >
                    <Link to={item.url}>
                      <item.icon strokeWidth={1.5} className="h-4 w-4" />
                      <span className="text-[13px]">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-medium text-white">
            AL
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-[13px] text-white">Ana Lima</div>
            <div className="truncate text-[11px] text-white/40">Minha loja</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

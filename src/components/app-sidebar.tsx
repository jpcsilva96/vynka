import { Link, useRouterState } from "@tanstack/react-router";
import {
  ShoppingCart,
  ClipboardList,
  Package,
  Users,
  History,
  Wallet,
  BarChart3,
  UserCog,
  Settings,
  LayoutDashboard,
  LayoutTemplate,
  Tags,
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
import { UserAvatar, UserMenu, useCurrentUserIdentity } from "@/components/user-menu";

const primary = [
  { title: "Vender", url: "/admin/vender", icon: ShoppingCart },
  { title: "Pedidos", url: "/admin/pedidos", icon: ClipboardList },
  { title: "Produtos", url: "/admin/produtos", icon: Package },
  { title: "Categorias", url: "/admin/categorias", icon: Tags },
  { title: "Clientes", url: "/admin/clientes", icon: Users },
  { title: "Histórico", url: "/admin/historico", icon: History },
  { title: "Finanças", url: "/admin/financas", icon: Wallet },
  { title: "Estatísticas", url: "/admin/estatisticas", icon: BarChart3 },
  { title: "Usuários", url: "/admin/usuarios", icon: UserCog },
  { title: "Loja e Catálogo", url: "/admin/configuracoes", icon: Settings },
  { title: "Editor de Layout", url: "/admin/editor-layout", icon: LayoutTemplate },
];

const workspace = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { name, storeName } = useCurrentUserIdentity();
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
        <UserMenu align="start" side="top">
          <button
            type="button"
            aria-label="Menu do usuário"
            className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-white/5"
          >
            <UserAvatar className="bg-white/10 text-white" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-[13px] text-white">{name}</div>
              <div className="truncate text-[11px] text-white/40">{storeName}</div>
            </div>
          </button>
        </UserMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

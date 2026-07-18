import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  BarChart3, Store, Users, Package, CreditCard, Settings, LogOut, Loader2,
} from "lucide-react";
import { useStoreContext } from "@/lib/store-context";
import { VynkaLogo } from "@/components/vynka-logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/master")({
  component: MasterLayout,
});

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/master", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/master/lojas", label: "Lojas", icon: Store },
  { to: "/master/usuarios", label: "Usuários", icon: Users },
  { to: "/master/planos", label: "Planos", icon: Package },
  { to: "/master/assinaturas", label: "Assinaturas", icon: CreditCard },
  { to: "/master/configuracoes", label: "Configurações", icon: Settings },
];

function MasterLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginRoute = pathname === "/master/login";

  if (isLoginRoute) return <Outlet />;

  return (
    <MasterGuard>
      <div className="flex min-h-svh w-full bg-background text-foreground">
        <MasterSidebar />
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </MasterGuard>
  );
}

function MasterGuard({ children }: { children: ReactNode }) {
  const { loading, user, isPlatformAdmin } = useStoreContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/master/login", replace: true });
    else if (!isPlatformAdmin) navigate({ to: "/", replace: true });
  }, [loading, user, isPlatformAdmin, navigate]);

  if (loading || !user || !isPlatformAdmin) {
    return (
      <div className="grid min-h-svh w-full place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }
  return <>{children}</>;
}

function MasterSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, user } = useStoreContext();

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-ink text-white/90">
      <div className="border-b border-white/10 px-5 py-6">
        <VynkaLogo className="text-[18px] text-white" />
        <div className="mt-1 text-[10px] uppercase tracking-[0.28em] text-white/50">
          Painel VYNKA
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors",
                active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-3 py-4">
        <div className="mb-2 truncate px-3 text-[11px] text-white/50">{user?.email}</div>
        <button
          type="button"
          onClick={async () => { await signOut(); window.location.href = "/master/login"; }}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          Sair
        </button>
      </div>
    </aside>
  );
}

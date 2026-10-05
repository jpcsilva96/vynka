import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MasterStoreBar } from "@/components/master-store-bar";
import { StoreProvider, useStoreContext } from "@/lib/store-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-light tracking-tight text-foreground">404</h1>
        <h2 className="mt-4 text-[15px] font-medium text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-graphite"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-[15px] font-medium tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Algo deu errado. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-graphite"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            Ir ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VYNKA — Plataforma de catálogos de vendas" },
      {
        name: "description",
        content:
          "VYNKA é a plataforma SaaS para criar seu catálogo digital e vender pelo site ou WhatsApp em minutos.",
      },
      { name: "author", content: "VYNKA" },
      { property: "og:title", content: "VYNKA — Plataforma de catálogos de vendas" },
      {
        property: "og:description",
        content:
          "VYNKA é a plataforma SaaS para criar seu catálogo digital e vender pelo site ou WhatsApp em minutos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "VYNKA — Plataforma de catálogos de vendas" },
      {
        name: "twitter:description",
        content:
          "VYNKA é a plataforma SaaS para criar seu catálogo digital e vender pelo site ou WhatsApp em minutos.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/504bb0b1-8c0c-47d2-9cc0-c4ca019202fe/id-preview-62a326ff--4efbd71c-8ed7-406a-b231-bc22ad703d8d.lovable.app-1784342808819.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/504bb0b1-8c0c-47d2-9cc0-c4ca019202fe/id-preview-62a326ff--4efbd71c-8ed7-406a-b231-bc22ad703d8d.lovable.app-1784342808819.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Dancing+Script:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=Lato:wght@300;400;700&family=Libre+Baskerville:wght@400;700&family=Merriweather:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&family=Nunito:wght@300;400;500;600;700&family=Open+Sans:wght@300;400;500;600;700&family=Oswald:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Poppins:wght@300;400;500;600;700&family=Raleway:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent as any,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <RouteSwitch />
      </StoreProvider>
    </QueryClientProvider>
  );
}

function RouteSwitch() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLayoutEditor = pathname === "/admin/editor-layout";

  if (!isAdmin) {
    return <Outlet />;
  }

  return (
    <LojistaGuard>
      <SidebarProvider>
        <div className="flex min-h-svh w-full bg-background">
          {!isLayoutEditor && <AppSidebar />}
          <Outlet />
        </div>
        {!isLayoutEditor && <MasterStoreBar />}
      </SidebarProvider>
    </LojistaGuard>
  );
}

// Loja suspensa ou arquivada: o dono sai do painel mesmo com sessão já aberta. Master continua.
const OPEN_STORE_STATUSES = ["trial", "active"];
const STORE_STATUS_CHECK_MS = 60_000;

function LojistaGuard({ children }: { children: ReactNode }) {
  const { loading, user, memberships, currentStore, isPlatformAdmin, signOut } = useStoreContext();
  const navigate = useNavigate();
  const blocked =
    !isPlatformAdmin && !!currentStore && !OPEN_STORE_STATUSES.includes(currentStore.status);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
    } else if (memberships.length === 0) {
      if (isPlatformAdmin) {
        navigate({ to: "/master/lojas", replace: true });
      } else {
        navigate({ to: "/login", search: { reason: "no-store" }, replace: true });
      }
    } else if (blocked) {
      void signOut().then(() =>
        navigate({ to: "/login", search: { reason: "suspended" }, replace: true }),
      );
    }
  }, [loading, user, memberships, isPlatformAdmin, blocked, signOut, navigate]);

  // Com o painel aberto, confere o status da loja a cada minuto e ao voltar para a aba.
  const storeId = currentStore?.id;
  useEffect(() => {
    if (isPlatformAdmin || !storeId) return;
    let active = true;
    const check = async () => {
      const { data } = await supabase
        .from("stores")
        .select("status")
        .eq("id", storeId)
        .maybeSingle();
      if (!active || !data || OPEN_STORE_STATUSES.includes(data.status)) return;
      await signOut();
      navigate({ to: "/login", search: { reason: "suspended" }, replace: true });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const timer = setInterval(() => void check(), STORE_STATUS_CHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isPlatformAdmin, storeId, signOut, navigate]);

  if (loading || !user || memberships.length === 0 || blocked) {
    return (
      <div className="grid min-h-svh w-full place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }
  return <>{children}</>;
}

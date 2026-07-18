import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useStoreContext } from "@/lib/store-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VYNKA — Plataforma de catálogos de vendas" },
      {
        name: "description",
        content:
          "VYNKA é a plataforma SaaS para criar seu catálogo digital e vender pelo site ou WhatsApp em minutos.",
      },
    ],
  }),
  component: RootRedirect,
});

function RootRedirect() {
  const { loading, user, memberships, isPlatformAdmin } = useStoreContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (isPlatformAdmin) {
      navigate({ to: "/master", replace: true });
      return;
    }
    if (user && memberships.length > 0) {
      navigate({ to: "/admin", replace: true });
      return;
    }
    navigate({ to: "/login", replace: true });
  }, [loading, user, memberships, isPlatformAdmin, navigate]);

  return (
    <div className="grid min-h-svh w-full place-items-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
    </div>
  );
}

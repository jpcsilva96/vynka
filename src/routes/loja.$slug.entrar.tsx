import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CustomerAuthForm } from "@/components/loja/customer-auth-form";
import { useStorefront } from "@/lib/storefront-context";

// Página de entrar (links diretos e páginas da conta sem login). Na loja, o "Entrar" do cabeçalho
// abre o mesmo formulário numa janela, sem sair da página.
export const Route = createFileRoute("/loja/$slug/entrar")({
  component: CustomerLoginPage,
});

function CustomerLoginPage() {
  const store = useStorefront();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-16">
      <Link
        to="/loja/$slug"
        params={{ slug: store.slug }}
        className="text-[12px] uppercase tracking-[0.16em] text-neutral-500 hover:text-black"
      >
        Voltar para loja
      </Link>
      <div className="mt-8 border border-black/10 bg-white p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
          {store.name}
        </div>
        <div className="mt-2">
          <CustomerAuthForm
            onDone={() => navigate({ to: "/loja/$slug/minha-conta", params: { slug: store.slug } })}
          />
        </div>
      </div>
    </div>
  );
}

import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { MASTER_ACTIVE_STORE_KEY } from "@/lib/master-store-access";
import { useStoreContext } from "@/lib/store-context";

// Master dentro do painel de uma loja: selo fixo dizendo em qual loja está, com volta para a
// lista de lojas do painel Master (sai da loja escolhida).
export function MasterStoreBar() {
  const { isPlatformAdmin, currentStore } = useStoreContext();
  if (!isPlatformAdmin || !currentStore) return null;

  const backToStores = () => {
    try {
      window.localStorage.removeItem(MASTER_ACTIVE_STORE_KEY);
    } catch {
      // sem localStorage: a volta ainda funciona, só a loja escolhida não é esquecida
    }
    window.location.assign("/master/lojas");
  };

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-border bg-foreground py-2 pl-4 pr-2 text-background shadow-lg"
    >
      <ShieldCheck className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
      <span className="min-w-0 truncate text-[12px]">
        Master na loja <strong className="font-semibold">{currentStore.name}</strong>
      </span>
      <a
        href={`/loja/${currentStore.slug}`}
        target="_blank"
        rel="noreferrer"
        className="hidden shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] opacity-80 hover:opacity-100 sm:inline-flex"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Ver loja
      </a>
      <button
        type="button"
        onClick={backToStores}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:opacity-90"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para as lojas
      </button>
    </div>
  );
}

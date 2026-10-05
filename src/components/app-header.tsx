import { Bell, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserAvatar, UserMenu } from "@/components/user-menu";

interface AppHeaderProps {
  title: string;
  description?: string;
}

export function AppHeader({ title, description }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-6 md:px-10">
        <SidebarTrigger className="-ml-1 h-8 w-8 text-muted-foreground hover:text-foreground" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-medium text-foreground">{title}</h1>
          {description ? (
            <p className="truncate text-[12px] text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className="hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-muted-foreground md:flex md:w-72">
          <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Pesquisar</span>
          <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] tracking-wide">
            ⌘K
          </span>
        </div>

        <button
          aria-label="Notificações"
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <UserMenu>
          <button type="button" aria-label="Menu do usuário" className="rounded-full">
            <UserAvatar className="bg-foreground text-background" />
          </button>
        </UserMenu>
      </div>
    </header>
  );
}

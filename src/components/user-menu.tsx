import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";

/** Nome de quem está logado: perfil > metadados do convite > e-mail. */
export function useCurrentUserIdentity() {
  const { user, profile, currentStore } = useStoreContext();
  const metaName =
    typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const name = profile?.full_name?.trim() || metaName.trim() || user?.email || "";
  const parts = name
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  const initials =
    ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() ||
    "?";
  return {
    name,
    email: user?.email ?? "",
    initials,
    avatarUrl: profile?.avatar_url ?? null,
    storeName: currentStore?.name ?? "",
  };
}

export function UserAvatar({ className }: { className?: string }) {
  const { initials, avatarUrl, name } = useCurrentUserIdentity();
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-[11px] font-medium",
        className,
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

/** Menu do usuário logado: identifica quem está no painel, leva ao perfil e sai. */
export function UserMenu({
  children,
  align = "end",
  side = "bottom",
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  const { signOut } = useStoreContext();
  const { name, email } = useCurrentUserIdentity();
  const navigate = useNavigate();

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-[13px] font-medium">{name}</div>
          {email && email !== name && (
            <div className="truncate text-[11px] text-muted-foreground">{email}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/admin/perfil" className="cursor-pointer">
            <UserRound className="h-4 w-4" strokeWidth={1.5} /> Editar perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onSignOut()} className="cursor-pointer">
          <LogOut className="h-4 w-4" strokeWidth={1.5} /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

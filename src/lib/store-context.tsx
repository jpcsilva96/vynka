import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_ACTIVE_STORE_KEY } from "@/lib/master-store-access";

export type MemberRole = "owner" | "admin" | "seller";
export type StoreStatus = "trial" | "active" | "suspended" | "cancelled";
export type OnboardingStatus = "not_started" | "in_progress" | "completed";
export type PublicationStatus = "draft" | "published" | "unpublished" | "suspended";

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  logo_url: string | null;
  plan_id: string | null;
  onboarding_status: OnboardingStatus;
  onboarding_current_step: number;
  publication_status: PublicationStatus;
  published_at: string | null;
}

export interface Membership {
  id: string;
  store_id: string;
  role: MemberRole;
  active: boolean;
  store: StoreSummary;
}

interface Ctx {
  loading: boolean;
  user: User | null;
  memberships: Membership[];
  currentStore: StoreSummary | null;
  currentRole: MemberRole | null;
  isPlatformAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<Ctx | null>(null);

const STORE_COLUMNS =
  "id,name,slug,status,logo_url,plan_id,onboarding_status,onboarding_current_step,publication_status,published_at";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isPlatformAdmin, setPlatformAdmin] = useState(false);

  const load = useCallback(async (u: User | null) => {
    setUser(u);
    if (!u) {
      setMemberships([]);
      setPlatformAdmin(false);
      setLoading(false);
      return;
    }
    try {
      const [{ data: mem }, { data: plat }] = await Promise.all([
        supabase
          .from("store_members")
          .select(`id, store_id, role, active, store:stores(${STORE_COLUMNS})`)
          .eq("user_id", u.id)
          .eq("active", true),
        supabase
          .from("platform_users")
          .select("role, active")
          .eq("user_id", u.id)
          .eq("active", true)
          .maybeSingle(),
      ]);
      const userMemberships = ((mem ?? []) as unknown as Membership[]).filter((m) => m.store);
      const platformAdmin = !!plat;
      let nextMemberships = userMemberships;

      if (platformAdmin && typeof window !== "undefined") {
        const activeStoreId = window.localStorage.getItem(MASTER_ACTIVE_STORE_KEY);
        const alreadyLinked = activeStoreId
          ? userMemberships.some((m) => m.store_id === activeStoreId)
          : false;

        if (activeStoreId && !alreadyLinked) {
          const { data: selectedStore } = await supabase
            .from("stores")
            .select(STORE_COLUMNS)
            .eq("id", activeStoreId)
            .maybeSingle();

          if (selectedStore) {
            nextMemberships = [
              {
                id: `master:${activeStoreId}`,
                store_id: activeStoreId,
                role: "owner",
                active: true,
                store: selectedStore as StoreSummary,
              },
              ...userMemberships,
            ];
          } else {
            window.localStorage.removeItem(MASTER_ACTIVE_STORE_KEY);
          }
        }
      }

      setMemberships(nextMemberships);
      setPlatformAdmin(platformAdmin);
    } catch (e) {
      console.error("[StoreProvider] load failed", e);
      setMemberships([]);
      setPlatformAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    supabase.auth
      .getUser()
      .then(({ data }) => load(data.user))
      .catch((error) => {
        console.error("[StoreProvider] auth lookup failed", error);
        load(null);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load(session?.user ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const currentStore = memberships[0]?.store ?? null;
  const currentRole = memberships[0]?.role ?? null;

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(MASTER_ACTIVE_STORE_KEY);
    }
    setUser(null);
    setMemberships([]);
    setPlatformAdmin(false);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    await load(data.user);
  };

  return (
    <StoreContext.Provider
      value={{
        loading,
        user,
        memberships,
        currentStore,
        currentRole,
        isPlatformAdmin,
        signOut,
        refresh,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStoreContext() {
  const c = useContext(StoreContext);
  if (!c) throw new Error("useStoreContext must be used inside <StoreProvider>");
  return c;
}

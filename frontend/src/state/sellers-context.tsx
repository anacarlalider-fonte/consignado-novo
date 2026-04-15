import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { isDeprecatedSellerName } from "../constants/deprecated-sellers";
import { DASHBOARD_SELLERS } from "../data/dashboard-data";

export type Cargo = "Vendedora" | "Gestora" | "Adm";

export type Seller = {
  id: string;
  name: string;
  active: boolean;
  cargo: Cargo;
  senha?: string;
};

type SellersCtx = {
  sellers: Seller[];
  addSeller: (name: string, cargo?: Cargo, senha?: string) => void;
  updateSeller: (id: string, patch: Partial<Omit<Seller, "id">>) => void;
  renameSeller: (id: string, name: string) => void;
  toggleSeller: (id: string) => void;
  removeSeller: (id: string) => void;
};

const STORAGE_KEY = "crm-kato-sellers-v1";

/** Ex-vendedoras que não devem mais ficar ativas no time (migração localStorage). */
const REMOVED_VENDEDORA_LC = new Set(["ana caroline", "dieine alves", "dieine"]);

function loadSellers(): Seller[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as any[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        let migrated = false;
        const next = parsed.map((s) => {
          const base = {
            ...s,
            cargo: (s.cargo || "Vendedora") as Cargo,
            senha: s.senha || undefined,
          };
          const nameLc = String(s.name ?? "").trim().toLowerCase();
          if (isDeprecatedSellerName(nameLc) || REMOVED_VENDEDORA_LC.has(nameLc)) {
            migrated = true;
            return { ...base, active: false };
          }
          return base;
        });
        if (migrated) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      }
    } catch {
      /* ignore */
    }
  }
  const defaults = DASHBOARD_SELLERS.map((name, idx) => ({
    id: `s-${idx}`,
    name,
    active: true,
    cargo: "Vendedora" as Cargo,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

const SellersContext = createContext<SellersCtx | null>(null);

export function SellersProvider({ children }: { children: ReactNode }) {
  const [sellers, setSellers] = useState<Seller[]>(loadSellers);

  function save(next: Seller[]) {
    setSellers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addSeller(name: string, cargo: Cargo = "Vendedora", senha?: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    save([...sellers, { id: `s-${Date.now()}`, name: trimmed, active: true, cargo, senha: senha || undefined }]);
  }

  function updateSeller(id: string, patch: Partial<Omit<Seller, "id">>) {
    save(sellers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function renameSeller(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    save(sellers.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
  }

  function toggleSeller(id: string) {
    save(sellers.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }

  function removeSeller(id: string) {
    save(sellers.filter((s) => s.id !== id));
  }

  const value = useMemo<SellersCtx>(
    () => ({ sellers, addSeller, updateSeller, renameSeller, toggleSeller, removeSeller }),
    [sellers]
  );

  return <SellersContext.Provider value={value}>{children}</SellersContext.Provider>;
}

export function useSellers() {
  const ctx = useContext(SellersContext);
  if (!ctx) throw new Error("useSellers deve ser usado dentro de SellersProvider");
  return ctx;
}

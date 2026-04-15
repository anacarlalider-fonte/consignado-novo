import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useCRM } from "./crm-context";
import { useSellers } from "./sellers-context";
import { isDashVendedoraName, SELLER_COLORS } from "../data/dashboard-data";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type KpiStatus = "green" | "yellow" | "red" | "empty";

/** A single KPI definition + meta + realizado + status */
export type KpiResult = {
  id: string;
  label: string;
  unit: "number" | "percent" | "currency";
  higherIsBetter: boolean;
  meta: number;
  realizado: number;
  pct: number;        // realizado / meta * 100 (capped at 200)
  status: KpiStatus;
};

export type SellerResult = {
  name: string;
  initials: string;
  color: string;
  kpis: KpiResult[];
  overallStatus: KpiStatus;
};

export type TeamGoals = {
  period: string;
  leadsAtivos: number;
  conversoes: number;
  taxaConversao: number;   // %
  followupsPrazo: number;  // % follow-ups realizados no prazo
  pedidosCriticos: number; // meta = 0 idealmente
  valorPipeline: number;   // R$
};

export type SellerGoals = {
  leadsAtivos: number;
  conversoes: number;
  taxaConversao: number;
  followupsVencidos: number; // lower is better (meta = 0)
};

type GoalsStore = {
  team: TeamGoals;
  sellers: Record<string, SellerGoals>; // keyed by seller name
};

type GoalsCtx = {
  store: GoalsStore;
  teamResults: KpiResult[];
  sellerResults: SellerResult[];
  updateTeamGoals: (patch: Partial<TeamGoals>) => void;
  updateSellerGoals: (sellerName: string, patch: Partial<SellerGoals>) => void;
};

/* ─── Defaults ───────────────────────────────────────────────────────────── */

const DEFAULT_TEAM: TeamGoals = {
  period: (() => {
    const d = new Date();
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })(),
  leadsAtivos: 20,
  conversoes: 8,
  taxaConversao: 40,
  followupsPrazo: 80,
  pedidosCriticos: 2,
  valorPipeline: 150000
};

const DEFAULT_SELLER: SellerGoals = {
  leadsAtivos: 5,
  conversoes: 2,
  taxaConversao: 40,
  followupsVencidos: 0
};

const STORAGE_KEY = "crm-kato-goals-v1";

function loadStore(): GoalsStore {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as GoalsStore;
    } catch {/* ignore */}
  }
  return { team: DEFAULT_TEAM, sellers: {} };
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function calcStatus(pct: number, higherIsBetter: boolean): KpiStatus {
  if (higherIsBetter) {
    if (pct >= 100) return "green";
    if (pct >= 70) return "yellow";
    return "red";
  } else {
    // lower is better: pct = realizado / meta (meta = "max acceptable")
    if (pct <= 100) return "green";
    if (pct <= 150) return "yellow";
    return "red";
  }
}

function makeKpi(
  id: string,
  label: string,
  unit: KpiResult["unit"],
  higherIsBetter: boolean,
  meta: number,
  realizado: number
): KpiResult {
  const safeMeta = meta > 0 ? meta : 1;
  const pct = Math.round((realizado / safeMeta) * 100);
  const status: KpiStatus = meta === 0 ? "empty" : calcStatus(pct, higherIsBetter);
  return { id, label, unit, higherIsBetter, meta, realizado, pct: Math.min(pct, 200), status };
}

function worstStatus(kpis: KpiResult[]): KpiStatus {
  if (kpis.some((k) => k.status === "red")) return "red";
  if (kpis.some((k) => k.status === "yellow")) return "yellow";
  if (kpis.every((k) => k.status === "green")) return "green";
  return "empty";
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/* ─── Context ────────────────────────────────────────────────────────────── */

const GoalsContext = createContext<GoalsCtx | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const { leads, opportunities, orders } = useCRM();
  const { sellers } = useSellers();
  const activeSellers = sellers.filter((s) => {
    if (!s.active) return false;
    const role = String(s.cargo ?? "Vendedora").trim().toLowerCase();
    return role !== "gestora" && role !== "adm" && isDashVendedoraName(s.name);
  });

  const [store, setStore] = useState<GoalsStore>(loadStore);

  function save(next: GoalsStore) {
    setStore(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function updateTeamGoals(patch: Partial<TeamGoals>) {
    save({ ...store, team: { ...store.team, ...patch } });
  }

  function updateSellerGoals(sellerName: string, patch: Partial<SellerGoals>) {
    const current = store.sellers[sellerName] ?? DEFAULT_SELLER;
    save({ ...store, sellers: { ...store.sellers, [sellerName]: { ...current, ...patch } } });
  }

  /* ── computed realizado ───────────────────────────────────────────────── */
  const { teamResults, sellerResults } = useMemo(() => {
    const totalLeads = leads.filter((l) => l.status !== "Perdido").length;
    const converted = opportunities.filter((o) => o.etapa === "Fechado").length;
    const txConv = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0;
    const criticos = orders.filter((o) => o.urgencia === "CRITICO").length;
    const valorPipeline = opportunities.reduce((s, o) => s + o.valor, 0);

    const overdueOrders = orders.filter((o) => {
      if (!o.proximoFollowup) return false;
      const parts = o.proximoFollowup.split("/");
      if (parts.length !== 3) return false;
      const [d, m, y] = parts.map(Number);
      return new Date(y, m - 1, d).getTime() < Date.now();
    });
    const totalFollowups = orders.filter((o) => !!o.proximoFollowup).length;
    const onTimePct =
      totalFollowups > 0
        ? Math.round(((totalFollowups - overdueOrders.length) / totalFollowups) * 100)
        : 100;

    const g = store.team;
    const teamResults: KpiResult[] = [
      makeKpi("leadsAtivos",      "Leads Ativos",          "number",   true,  g.leadsAtivos,      totalLeads),
      makeKpi("conversoes",       "Conversões",            "number",   true,  g.conversoes,       converted),
      makeKpi("taxaConversao",    "Taxa de Conversão",     "percent",  true,  g.taxaConversao,    txConv),
      makeKpi("followupsPrazo",   "Follow-ups no Prazo",   "percent",  true,  g.followupsPrazo,   onTimePct),
      makeKpi("pedidosCriticos",  "Pedidos Críticos",      "number",   false, g.pedidosCriticos,  criticos),
      makeKpi("valorPipeline",    "Valor Pipeline",        "currency", true,  g.valorPipeline,    valorPipeline),
    ];

    const sellerResults: SellerResult[] = activeSellers.map((seller, idx) => {
      const name = seller.name;
      const sg = store.sellers[name] ?? DEFAULT_SELLER;

      const sellerLeads = leads.filter((l) => l.responsavel === name && l.status !== "Perdido").length;
      const sellerConverted = opportunities.filter((o) => o.vendedor === name && o.etapa === "Fechado").length;
      const sellerBase = Math.max(1, leads.filter((l) => l.responsavel === name).length);
      const sellerTx = Math.round((sellerConverted / sellerBase) * 100);
      const sellerOverdue = overdueOrders.filter((o) => o.vendedor === name).length;

      const kpis: KpiResult[] = [
        makeKpi("leadsAtivos",      "Leads Ativos",        "number",  true,  sg.leadsAtivos,      sellerLeads),
        makeKpi("conversoes",       "Conversões",          "number",  true,  sg.conversoes,       sellerConverted),
        makeKpi("taxaConversao",    "Taxa Conversão",      "percent", true,  sg.taxaConversao,    sellerTx),
        makeKpi("followupsVencidos","F.U. Vencidos",       "number",  false, sg.followupsVencidos + 1, sellerOverdue),
      ];

      return {
        name,
        initials: initialsOf(name),
        color: SELLER_COLORS[idx % SELLER_COLORS.length],
        kpis,
        overallStatus: worstStatus(kpis)
      };
    });

    return { teamResults, sellerResults };
  }, [leads, opportunities, orders, activeSellers, store]);

  const value = useMemo<GoalsCtx>(
    () => ({ store, teamResults, sellerResults, updateTeamGoals, updateSellerGoals }),
    [store, teamResults, sellerResults]
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoals deve ser usado dentro de GoalsProvider");
  return ctx;
}

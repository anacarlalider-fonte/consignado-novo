/** Vendedoras do time comercial: únicas que entram em dashboard, relatórios por vendedora e metas. */
export const DASHBOARD_SELLERS = ["Simone Bosso", "Tatiane Souza"] as const;

const DASH_VENDEDORA_KEYS = new Set<string>([
  ...DASHBOARD_SELLERS.map((n) => n.trim().toLowerCase()),
  "simone",
  "tatiane",
]);

export function isDashVendedoraName(name: string): boolean {
  return DASH_VENDEDORA_KEYS.has(name.trim().toLowerCase());
}

/** Agrupa registros do CRM (responsavel/vendedor) na linha canônica do relatório (Simone Bosso / Tatiane Souza). */
export function crmVendedorBelongsToDashSeller(vendedorRaw: string, canonicalSellerName: string): boolean {
  const v = vendedorRaw.trim().toLowerCase();
  const canon = canonicalSellerName.trim().toLowerCase();
  if (canon === "simone bosso") return v === "simone bosso" || v === "simone";
  if (canon === "tatiane souza") return v === "tatiane souza" || v === "tatiane";
  return v === canon;
}

/** Todas as chaves normalizadas que contam como vendedora do dash nos relatórios. */
export function allDashVendedoraNormKeys(): Set<string> {
  return new Set(DASH_VENDEDORA_KEYS);
}

export type MonthlySeries = {
  month: string;
  leads: number;
  converted: number;
};

export const MONTHLY_CONVERSION_SERIES: MonthlySeries[] = [
  { month: "Nov", leads: 62, converted: 21 },
  { month: "Dez", leads: 58, converted: 19 },
  { month: "Jan", leads: 71, converted: 26 },
  { month: "Fev", leads: 66, converted: 24 },
  { month: "Mar", leads: 78, converted: 30 },
  { month: "Abr", leads: 73, converted: 28 }
];

export const SELLER_COLORS: string[] = ["#B07458", "#C9956B", "#00C896", "#FFB020", "#FF4D6A", "#D4A07A"];

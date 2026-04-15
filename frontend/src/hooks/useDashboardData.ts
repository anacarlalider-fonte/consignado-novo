import { useMemo } from "react";
import { isDashVendedoraName, SELLER_COLORS } from "../data/dashboard-data";
import { useCRM } from "../state/crm-context";
import { useSellers } from "../state/sellers-context";

type FunnelRow = {
  label: string;
  value: number;
  pct: number;
};

type SellerRow = {
  name: string;
  initials: string;
  color: string;
  activeLeads: number;
  converted: number;
  overdueFollowUps: number;
  conversionRate: number;
  contatos: number;
  ticketMedio: number;
};

export type AgendaRow = {
  id: string;
  time: string;
  seller: string;
  sellerInitials: string;
  sellerColor: string;
  leadName: string;
  stage: string;
  overdue: boolean;
  done: boolean;
};

export type MonthlySeries = {
  month: string;
  leads: number;
  converted: number;
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function parseDueDate(raw?: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d, 18, 0, 0);
}

function timeForIndex(idx: number) {
  const hour = 8 + (idx % 10);
  const minutes = idx % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export function useDashboardData(filterSeller?: string) {
  const { leads: allLeads, opportunities: allOpps, orders: allOrders, interactions: allInteractions } = useCRM();
  const { sellers } = useSellers();
  const activeSellers = sellers.filter((s) => s.active);

  return useMemo(() => {
    const leads = filterSeller ? allLeads.filter((l) => l.responsavel === filterSeller) : allLeads;
    const opportunities = filterSeller ? allOpps.filter((o) => o.vendedor === filterSeller) : allOpps;
    const orders = filterSeller ? allOrders.filter((o) => o.vendedor === filterSeller) : allOrders;
    const interactions = filterSeller ? allInteractions.filter((i) => i.vendedor === filterSeller) : allInteractions;

    const totalLeads = leads.length;
    const activeOpps = opportunities.filter((o) => o.etapa !== "Perdido");
    const converted = opportunities.filter((op) => op.etapa === "Fechado").length;
    const openOrders = orders.filter((order) => order.etapaCRM !== "Concluido").length;
    const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

    const fechados = opportunities.filter((o) => o.etapa === "Fechado");
    const ticketMedio = fechados.length > 0 ? Math.round(fechados.reduce((s, o) => s + o.valor, 0) / fechados.length) : 0;

    let cicloMedio = 0;
    const fechadosComDatas = fechados.filter((o) => o.criadoEm && o.fechadoEm);
    if (fechadosComDatas.length > 0) {
      const totalDias = fechadosComDatas.reduce((s, o) => {
        const diff = new Date(o.fechadoEm!).getTime() - new Date(o.criadoEm).getTime();
        return s + Math.max(0, diff / 86_400_000);
      }, 0);
      cicloMedio = Math.round(totalDias / fechadosComDatas.length);
    }

    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endToday = startToday + 24 * 60 * 60 * 1000 - 1;
    const now = today.getTime();

    const yesterdayStart = startToday - 86_400_000;
    const weekStart = new Date(startToday);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const agendaRows: AgendaRow[] = orders
      .filter((o) => !!o.proximoFollowup)
      .map((order, idx) => {
        const due = parseDueDate(order.proximoFollowup);
        const dueTime = due?.getTime() ?? startToday + idx * 60_000;
        const overdue = dueTime < now;
        const done = order.etapaCRM === "Concluido";
        return {
          id: `${order.pedido}`,
          time: timeForIndex(idx),
          seller: order.vendedor,
          sellerInitials: initialsOf(order.vendedor),
          sellerColor: SELLER_COLORS[idx % SELLER_COLORS.length],
          leadName: order.cliente,
          stage: order.etapaCRM,
          overdue,
          done
        };
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    const followUpsToday = orders.filter((o) => {
      const due = parseDueDate(o.proximoFollowup);
      if (!due) return false;
      const t = due.getTime();
      return t >= startToday && t <= endToday;
    }).length;

    const overdueFollowUps = agendaRows.filter((row) => row.overdue && !row.done).length;

    const rankingSellers = activeSellers.filter((s) => {
      const role = String(s.cargo ?? "Vendedora").trim().toLowerCase();
      return role !== "gestora" && role !== "adm" && isDashVendedoraName(s.name);
    });
    const sellerRows: SellerRow[] = rankingSellers.map((seller, idx) => {
      const name = seller.name;
      const sLeads = allLeads.filter((l) => l.responsavel === name);
      const sActiveLeads = sLeads.filter((l) => l.status !== "Perdido").length;
      const sOpps = allOpps.filter((o) => o.vendedor === name);
      const sFechadas = sOpps.filter((o) => o.etapa === "Fechado");
      const sConvertedCount = sFechadas.length;
      const sellerLeadsBase = Math.max(1, sLeads.length, sConvertedCount + sActiveLeads);
      const rate = Math.round((sConvertedCount / sellerLeadsBase) * 100);
      const overdueBySeller = agendaRows.filter((a) => a.seller === name && a.overdue && !a.done).length;
      const sContatos = allInteractions.filter((i) => i.vendedor === name).length;
      const sTicket = sFechadas.length > 0 ? Math.round(sFechadas.reduce((s, o) => s + o.valor, 0) / sFechadas.length) : 0;
      return {
        name,
        initials: initialsOf(name),
        color: SELLER_COLORS[idx % SELLER_COLORS.length],
        activeLeads: sActiveLeads,
        converted: sConvertedCount,
        overdueFollowUps: overdueBySeller,
        conversionRate: rate,
        contatos: sContatos,
        ticketMedio: sTicket,
      };
    }).sort((a, b) => b.conversionRate - a.conversionRate);

    const lostOpps = opportunities.filter((o) => o.etapa === "Perdido").length;
    const lostLeads = leads.filter((l) => l.status === "Perdido").length;

    const funnelRaw = [
      { label: "🆕 Novo Contato", value: leads.filter((l) => l.status === "Novo").length },
      { label: "📞 Em Conversa", value: leads.filter((l) => l.status === "Em contato").length },
      { label: "📐 Proposta Enviada", value: activeOpps.filter((o) => o.etapa === "Proposta").length },
      { label: "💰 Em Negociação", value: activeOpps.filter((o) => o.etapa === "Negociacao").length },
      { label: "⏳ Aguardando Decisão", value: orders.filter((o) => o.etapaCRM === "Aguardando pagamento").length },
      { label: "✅ Convertido", value: converted },
      { label: "❌ Perdido", value: lostOpps + lostLeads }
    ];
    const funnelTotal = Math.max(1, funnelRaw.reduce((sum, row) => sum + row.value, 0));
    const funnel: FunnelRow[] = funnelRaw.map((row) => ({
      ...row,
      pct: Math.round((row.value / funnelTotal) * 100)
    }));

    const todayStart2 = new Date();
    todayStart2.setHours(0, 0, 0, 0);
    const weekStart2 = new Date(todayStart2);
    weekStart2.setDate(weekStart2.getDate() - weekStart2.getDay());

    const contatosHoje = interactions.filter((i) => new Date(i.criadoEm) >= todayStart2).length;
    const contatosSemana = interactions.filter((i) => new Date(i.criadoEm) >= weekStart2).length;

    // Trends: compare this week vs previous week
    const leadsThisWeek = leads.filter((l) => l.criadoEm && new Date(l.criadoEm).getTime() >= weekStart.getTime()).length;
    const leadsPrevWeek = leads.filter((l) => {
      if (!l.criadoEm) return false;
      const t = new Date(l.criadoEm).getTime();
      return t >= prevWeekStart.getTime() && t < weekStart.getTime();
    }).length;
    const leadsTrend = leadsPrevWeek > 0 ? Math.round(((leadsThisWeek - leadsPrevWeek) / leadsPrevWeek) * 100) : 0;

    const contatosOntem = interactions.filter((i) => {
      const t = new Date(i.criadoEm).getTime();
      return t >= yesterdayStart && t < startToday;
    }).length;

    const kpis = {
      activeLeads: leads.filter((l) => l.status !== "Perdido").length,
      followUpsToday,
      converted,
      openOrders,
      conversionRate,
      overdueFollowUps,
      contatosHoje,
      contatosSemana,
      ticketMedio,
      cicloMedio,
      leadsTrend,
      contatosOntem,
    };

    // Monthly series from real data (last 6 months)
    const monthlySeries: MonthlySeries[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const mStart = d.getTime();
      const mEnd = monthEnd.getTime();

      const mLeads = leads.filter((l) => {
        if (!l.criadoEm) return false;
        const t = new Date(l.criadoEm).getTime();
        return t >= mStart && t <= mEnd;
      }).length;

      const mConverted = opportunities.filter((o) => {
        if (o.etapa !== "Fechado") return false;
        const ts = o.fechadoEm ? new Date(o.fechadoEm).getTime() : (o.criadoEm ? new Date(o.criadoEm).getTime() : 0);
        return ts >= mStart && ts <= mEnd;
      }).length;

      monthlySeries.push({ month: monthLabel(d), leads: mLeads, converted: mConverted });
    }

    const forecastValue = activeOpps
      .filter((o) => o.etapa !== "Fechado")
      .reduce((s, o) => s + o.valor * ((o.probabilidade ?? 50) / 100), 0);

    return {
      kpis,
      funnel,
      sellerRows,
      agendaRows,
      monthlySeries,
      forecastValue,
    };
  }, [allLeads, allOpps, allOrders, allInteractions, activeSellers, filterSeller]);
}

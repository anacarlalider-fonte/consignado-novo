import { useMemo, useState } from "react";
import { useCRM } from "../state/crm-context";
import { useAuth } from "../state/auth-context";
import { useToast } from "../state/toast-context";
import { downloadCsv } from "../utils/csv";
import {
  allDashVendedoraNormKeys,
  crmVendedorBelongsToDashSeller,
  DASHBOARD_SELLERS,
  SELLER_COLORS,
} from "../data/dashboard-data";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PCT = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

function normReportName(n: string): string {
  return n.trim().toLowerCase();
}

type PeriodPreset = "7d" | "30d" | "month" | "prevMonth" | "90d" | "year" | "custom" | "all";

function getPresetRange(preset: PeriodPreset): { start: Date; end: Date } | null {
  if (preset === "all") return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "7d": return { start: new Date(todayStart.getTime() - 6 * 86_400_000), end: today };
    case "30d": return { start: new Date(todayStart.getTime() - 29 * 86_400_000), end: today };
    case "month": return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: today };
    case "prevMonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    case "90d": return { start: new Date(todayStart.getTime() - 89 * 86_400_000), end: today };
    case "year": return { start: new Date(now.getFullYear(), 0, 1), end: today };
    default: return null;
  }
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ margin: "0 0 14px", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", fontWeight: 700 }}>
      {children}
    </h3>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <article className="dash-kpi" style={accent ? { borderLeftColor: accent } : {}}>
      <div className="dash-kpi-head">
        <span>{label}</span>
      </div>
      <strong style={{ fontSize: 34, color: accent ?? "var(--primary)" }}>{value}</strong>
      {sub && <p style={{ marginTop: 4 }}>{sub}</p>}
    </article>
  );
}

type PeriodFilter = "current" | "previous" | "all";

function getTimestampFromOppId(id: string): number | null {
  const match = id.match(/^O-(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function CommissionReport({
  opportunities,
  activeSellers,
}: {
  opportunities: { id: string; etapa: string; valor: number; vendedor: string }[];
  activeSellers: { id: string; name: string; active: boolean }[];
}) {
  const [period, setPeriod] = useState<PeriodFilter>("current");
  const { pushToast } = useToast();

  const commissionData = useMemo(() => {
    let commissions: Record<string, number> = {};
    try {
      commissions = JSON.parse(localStorage.getItem("crm-kato-commissions") ?? "{}");
    } catch { /* use defaults */ }

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    const filteredOpps = opportunities.filter((o) => {
      if (o.etapa !== "Fechado") return false;
      if (period === "all") return true;
      const ts = getTimestampFromOppId(o.id);
      if (!ts) return true;
      if (period === "current") return ts >= currentMonthStart;
      return ts >= prevMonthStart && ts < currentMonthStart;
    });

    return activeSellers.map((seller) => {
      const myOpps = filteredOpps.filter((o) => crmVendedorBelongsToDashSeller(o.vendedor, seller.name));
      const totalVendido = myOpps.reduce((s, o) => s + o.valor, 0);
      const pct = commissions[seller.name] ?? 5;
      const valorComissao = totalVendido * (pct / 100);
      return { name: seller.name, totalVendido, pct, valorComissao };
    });
  }, [opportunities, activeSellers, period]);

  function exportCommissionCsv() {
    const periodLabel =
      period === "current" ? "mes_atual" : period === "previous" ? "mes_anterior" : "todo_periodo";
    downloadCsv(
      `relatorio_comissao_${periodLabel}_realsynk.csv`,
      ["Vendedora", "Total Vendido", "% Comissão", "Valor Comissão"],
      commissionData.map((r) => [
        r.name,
        BRL.format(r.totalVendido),
        `${r.pct}%`,
        BRL.format(r.valorComissao),
      ])
    );
    pushToast("success", "Relatório de comissão exportado.");
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <SectionTitle>Relatório de Comissão</SectionTitle>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            style={{ fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
          >
            <option value="current">Mês atual</option>
            <option value="previous">Mês anterior</option>
            <option value="all">Todo período</option>
          </select>
          <button type="button" className="btn-ghost" onClick={exportCommissionCsv}>
            ↓ Comissão CSV
          </button>
        </div>
      </div>

      {commissionData.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Nenhuma vendedora ativa configurada.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Vendedora</th>
                <th style={{ textAlign: "right" }}>Total Vendido</th>
                <th style={{ textAlign: "right" }}>% Comissão</th>
                <th style={{ textAlign: "right" }}>Valor Comissão</th>
              </tr>
            </thead>
            <tbody>
              {commissionData.map((r) => (
                <tr key={r.name}>
                  <td><strong>{r.name}</strong></td>
                  <td style={{ textAlign: "right" }}>{BRL.format(r.totalVendido)}</td>
                  <td style={{ textAlign: "right", color: "var(--muted)" }}>{r.pct}%</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                    {BRL.format(r.valorComissao)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td><strong>Total</strong></td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>
                  {BRL.format(commissionData.reduce((s, r) => s + r.totalVendido, 0))}
                </td>
                <td />
                <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                  {BRL.format(commissionData.reduce((s, r) => s + r.valorComissao, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ReportsPage() {
  const { isAdm } = useAuth();
  const { leads: allLeads, opportunities: allOpps, orders: allOrders, interactions: allInteractions } = useCRM();
  const dashReportNormKeys = useMemo(() => allDashVendedoraNormKeys(), []);

  const comissaoSellerRows = useMemo(
    () =>
      DASHBOARD_SELLERS.map((name, i) => ({
        id: `dash-rep-${i}`,
        name,
        active: true as const,
      })),
    []
  );

  const { pushToast } = useToast();

  /* ── Period filter state ── */
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customStart, setCustomStart] = useState(() => toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => toISODate(new Date()));

  const dateRange = useMemo(() => {
    if (preset === "custom") {
      const s = parseLocalDate(customStart);
      const e = parseLocalDate(customEnd);
      if (s && e) return { start: s, end: new Date(e.getTime() + 86_400_000 - 1) };
      return null;
    }
    return getPresetRange(preset);
  }, [preset, customStart, customEnd]);

  function inRange(isoDate: string | undefined): boolean {
    if (!dateRange || !isoDate) return !dateRange;
    const ts = new Date(isoDate).getTime();
    return ts >= dateRange.start.getTime() && ts <= dateRange.end.getTime();
  }

  function inRangeBR(brDate: string | undefined): boolean {
    if (!dateRange || !brDate) return !dateRange;
    const parts = brDate.split("/");
    if (parts.length !== 3) return !dateRange;
    const [d, m, y] = parts.map(Number);
    const ts = new Date(y, m - 1, d).getTime();
    return ts >= dateRange.start.getTime() && ts <= dateRange.end.getTime();
  }

  /* ── Filtered data ── */
  const leads = useMemo(() => allLeads.filter((l) => inRange(l.criadoEm)), [allLeads, dateRange]);
  const opportunities = useMemo(() => allOpps.filter((o) => inRange(o.criadoEm)), [allOpps, dateRange]);
  const interactions = useMemo(() => allInteractions.filter((i) => inRange(i.criadoEm)), [allInteractions, dateRange]);

  /** Atendimentos só das vendedoras do relatório (exclui linhas da gestora/adm no histórico). */
  const interactionsVendedoras = useMemo(() => {
    return interactions.filter((i) => {
      const n = normReportName(i.vendedor);
      if (!n || n === "—" || n === "-") return false;
      return dashReportNormKeys.has(n);
    });
  }, [interactions, dashReportNormKeys]);
  const orders = useMemo(() => {
    if (!dateRange) return allOrders;
    return allOrders.filter((o) => {
      if (o.proximoFollowup && inRangeBR(o.proximoFollowup)) return true;
      const ts = Date.now() - (o.diasAberto ?? 0) * 86_400_000;
      return ts >= dateRange.start.getTime() && ts <= dateRange.end.getTime();
    });
  }, [allOrders, dateRange]);

  const periodLabel = useMemo(() => {
    if (!dateRange) return "Todo o período";
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${fmt(dateRange.start)} a ${fmt(dateRange.end)}`;
  }, [dateRange]);

  const report = useMemo(() => {
    /* ── leads ── */
    const leadsByStatus = {
      Novo:         leads.filter((l) => l.status === "Novo").length,
      "Em contato": leads.filter((l) => l.status === "Em contato").length,
      Qualificado:  leads.filter((l) => l.status === "Qualificado").length,
      Perdido:      leads.filter((l) => l.status === "Perdido").length,
    };

    /* ── pipeline ── */
    const oppByStage = {
      Prospeccao:  opportunities.filter((o) => o.etapa === "Prospeccao"),
      Diagnostico: opportunities.filter((o) => o.etapa === "Diagnostico"),
      Proposta:    opportunities.filter((o) => o.etapa === "Proposta"),
      Negociacao:  opportunities.filter((o) => o.etapa === "Negociacao"),
      Fechado:     opportunities.filter((o) => o.etapa === "Fechado"),
    };
    const totalPipeline   = opportunities.reduce((s, o) => s + o.valor, 0);
    const totalFechado    = oppByStage.Fechado.reduce((s, o) => s + o.valor, 0);
    const taxaConversao   = PCT(oppByStage.Fechado.length, opportunities.length);

    /* ── pedidos ── */
    const pedidosByUrgencia = {
      CRITICO: orders.filter((o) => o.urgencia === "CRITICO"),
      ATENCAO: orders.filter((o) => o.urgencia === "ATENCAO"),
      RECENTE: orders.filter((o) => o.urgencia === "RECENTE"),
    };
    const totalAFaturar = orders.reduce((s, o) => s + o.aFaturar, 0);

    /* ── follow-ups vencidos ── */
    const now = Date.now();
    const overdueOrders = orders.filter((o) => {
      if (!o.proximoFollowup) return false;
      const parts = o.proximoFollowup.split("/");
      if (parts.length !== 3) return false;
      const [d, m, y] = parts.map(Number);
      return new Date(y, m - 1, d).getTime() < now;
    });

    /* ── interações ── */
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(todayStart); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const interByTipo: Record<string, number> = {};
    const interByResultado: Record<string, number> = {};
    for (const i of interactionsVendedoras) {
      interByTipo[i.tipo] = (interByTipo[i.tipo] ?? 0) + 1;
      interByResultado[i.resultado] = (interByResultado[i.resultado] ?? 0) + 1;
    }
    const contatosMes  = interactionsVendedoras.filter((i) => new Date(i.criadoEm) >= monthStart).length;
    const contatosSemana = interactionsVendedoras.filter((i) => new Date(i.criadoEm) >= weekStart).length;
    const contatosHoje = interactionsVendedoras.filter((i) => new Date(i.criadoEm) >= todayStart).length;

    /* ── por vendedora: linhas fixas do time (Simone / Tatiane), sem depender do cadastro em Admin ── */
    const sellerStats = DASHBOARD_SELLERS.map((canonical, idx) => {
      const myLeads = leads.filter((l) => crmVendedorBelongsToDashSeller(l.responsavel, canonical));
      const myOpps = opportunities.filter((o) => crmVendedorBelongsToDashSeller(o.vendedor, canonical));
      const myFechadas = myOpps.filter((o) => o.etapa === "Fechado");
      const myInteractions = interactionsVendedoras.filter((i) => crmVendedorBelongsToDashSeller(i.vendedor, canonical));
      const myOverdue = overdueOrders.filter((o) => crmVendedorBelongsToDashSeller(o.vendedor, canonical)).length;
      const pipeline = myOpps.reduce((s, o) => s + o.valor, 0);
      return {
        name: canonical,
        initials: initialsOf(canonical),
        color: SELLER_COLORS[idx % SELLER_COLORS.length],
        leads: myLeads.length,
        opps: myOpps.length,
        fechadas: myFechadas.length,
        taxa: PCT(myFechadas.length, myOpps.length),
        pipeline,
        contatos: myInteractions.length,
        overdueFollowUps: myOverdue,
      };
    }).sort((a, b) => b.fechadas - a.fechadas);

    return {
      leadsByStatus,
      oppByStage,
      totalPipeline, totalFechado, taxaConversao,
      pedidosByUrgencia, totalAFaturar,
      overdueOrders,
      interByTipo, interByResultado,
      contatosHoje, contatosSemana, contatosMes,
      sellerStats,
    };
  }, [leads, opportunities, orders, interactionsVendedoras]);

  const lossReasons = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) {
      if (l.status === "Perdido" && l.motivoPerda) {
        counts[l.motivoPerda] = (counts[l.motivoPerda] ?? 0) + 1;
      }
    }
    for (const o of opportunities) {
      if (o.etapa === "Perdido" && o.motivoPerda) {
        counts[o.motivoPerda] = (counts[o.motivoPerda] ?? 0) + 1;
      }
    }
    const total = Math.max(1, Object.values(counts).reduce((s, v) => s + v, 0));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count, pct: Math.round((count / total) * 100) }));
  }, [leads, opportunities]);

  const originStats = useMemo(() => {
    const origins: Record<string, { total: number; converted: number }> = {};
    for (const l of leads) {
      const o = l.origem || "Desconhecida";
      if (!origins[o]) origins[o] = { total: 0, converted: 0 };
      origins[o].total++;
      if (l.status === "Qualificado") origins[o].converted++;
    }
    return Object.entries(origins)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([origem, { total, converted }]) => ({
        origem, total, converted, rate: total > 0 ? Math.round((converted / total) * 100) : 0
      }));
  }, [leads]);

  /* ── CSV exports ─────────────────────────────────────────────────────── */
  function exportResumo() {
    downloadCsv(
      "relatorio_resumo_realsynk.csv",
      ["Indicador", "Valor"],
      [
        ["Total Leads",                leads.length],
        ["Leads Qualificados",          report.leadsByStatus.Qualificado],
        ["Leads Perdidos",              report.leadsByStatus.Perdido],
        ["Total Oportunidades",         opportunities.length],
        ["Oportunidades Fechadas",      report.oppByStage.Fechado.length],
        ["Taxa de Conversao",           report.taxaConversao],
        ["Pipeline Total",              BRL.format(report.totalPipeline)],
        ["Valor Fechado",               BRL.format(report.totalFechado)],
        ["Pedidos Criticos",            report.pedidosByUrgencia.CRITICO.length],
        ["A Faturar Total",             BRL.format(report.totalAFaturar)],
        ["Follow-ups Vencidos",         report.overdueOrders.length],
        ["Contatos Registrados (mes)",  report.contatosMes],
      ]
    );
    pushToast("success", "Resumo exportado.");
  }

  function exportVendedoras() {
    downloadCsv(
      "relatorio_vendedoras_realsynk.csv",
      ["Vendedora", "Leads", "Oportunidades", "Fechadas", "Taxa Conv.", "Pipeline", "Contatos", "FU Vencidos"],
      report.sellerStats.map((s) => [
        s.name, s.leads, s.opps, s.fechadas, s.taxa,
        BRL.format(s.pipeline), s.contatos, s.overdueFollowUps
      ])
    );
    pushToast("success", "Relatório de vendedoras exportado.");
  }

  function exportInteracoes() {
    downloadCsv(
      "relatorio_atendimentos_realsynk.csv",
      ["ID", "Data", "Cliente", "Vendedora", "Tipo", "Resultado", "Resumo", "Prox.Retorno"],
      interactionsVendedoras.map((i) => [
        i.id,
        new Date(i.criadoEm).toLocaleString("pt-BR"),
        i.cliente,
        i.vendedor,
        i.tipo,
        i.resultado,
        i.resumo,
        i.proximoRetorno
      ])
    );
    pushToast("success", "Histórico de atendimentos exportado.");
  }

  const URGENCIA_COLOR: Record<string, string> = {
    CRITICO: "var(--danger)",
    ATENCAO: "var(--warning)",
    RECENTE: "var(--success)"
  };

  const RESULTADO_COLOR: Record<string, string> = {
    Positivo: "var(--success)",
    Neutro: "var(--muted)",
    Negativo: "var(--danger)",
    "Sem resposta": "var(--warning)"
  };

  return (
    <div className="stack">
      {/* ── Header ── */}
      <section className="pipeline-hero">
        <div>
          <h2>Relatórios comerciais</h2>
          <p className="reports-hero-purpose">
            Análises por período (filtro abaixo), comparativos e exportação em CSV. O <strong>Dashboard</strong> mostra o resumo operacional do dia a dia.
          </p>
          <p className="reports-hero-note">Dados calculados em tempo real neste navegador.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn-ghost" onClick={exportResumo}>↓ Resumo CSV</button>
          <button type="button" className="btn-ghost" onClick={exportVendedoras}>↓ Vendedoras CSV</button>
          <button type="button" className="cta-lead ripple-btn" onClick={exportInteracoes}>↓ Atendimentos CSV</button>
        </div>
      </section>

      {/* ── Period Filter ── */}
      <section style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>Período:</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([
            ["7d", "7 dias"],
            ["30d", "30 dias"],
            ["month", "Mês atual"],
            ["prevMonth", "Mês anterior"],
            ["90d", "90 dias"],
            ["year", "Ano"],
            ["custom", "Personalizado"],
            ["all", "Todos"],
          ] as [PeriodPreset, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: preset === key ? "2px solid var(--primary)" : "1px solid var(--border)",
                background: preset === key ? "var(--primary)" : "var(--card)",
                color: preset === key ? "#fff" : "var(--text)",
                fontSize: 13,
                fontWeight: preset === key ? 700 : 400,
                cursor: "pointer",
                transition: "all .15s ease",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{ fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface, var(--card))", color: "var(--text)" }}
            />
            <span style={{ color: "var(--muted)" }}>até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{ fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface, var(--card))", color: "var(--text)" }}
            />
          </div>
        )}
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {periodLabel}
        </span>
      </section>

      {/* ── KPIs Principais ── */}
      <section>
        <SectionTitle>Visão Geral</SectionTitle>
        <div className="dash-kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
          <StatCard label="Total de Leads" value={leads.length} sub={`${report.leadsByStatus.Qualificado} qualificados`} accent="var(--primary)" />
          <StatCard label="Pipeline Total" value={BRL.format(report.totalPipeline)} sub={`${opportunities.length} oportunidades`} accent="var(--secondary)" />
          <StatCard label="Valor Fechado" value={BRL.format(report.totalFechado)} sub={`Taxa: ${report.taxaConversao}`} accent="var(--success)" />
          <StatCard label="A Faturar" value={BRL.format(report.totalAFaturar)} sub={`${orders.length} pedidos em aberto`} accent="var(--warning)" />
        </div>
      </section>

      {/* ── Leads + Pipeline ── */}
      <section className="dash-row split-50-50" style={{ padding: 0, boxShadow: "none", border: "none" }}>
        <section>
          <SectionTitle>Leads por Status</SectionTitle>
          <div className="report-bar-list">
            {Object.entries(report.leadsByStatus).map(([status, count]) => {
              const total = Math.max(1, leads.length);
              const pct = Math.round((count / total) * 100);
              return (
                <div key={status} className="report-bar-row">
                  <div className="report-bar-label">
                    <span>{status}</span>
                    <strong>{count} <small>({pct}%)</small></strong>
                  </div>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${pct}%`, background: status === "Perdido" ? "var(--danger)" : status === "Qualificado" ? "var(--success)" : "var(--primary)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle>Pipeline por Etapa</SectionTitle>
          <div className="report-bar-list">
            {Object.entries(report.oppByStage).map(([etapa, opps]) => {
              const val = opps.reduce((s, o) => s + o.valor, 0);
              const pct = report.totalPipeline > 0 ? Math.round((val / report.totalPipeline) * 100) : 0;
              return (
                <div key={etapa} className="report-bar-row">
                  <div className="report-bar-label">
                    <span>{etapa}</span>
                    <strong>{BRL.format(val)} <small>({opps.length})</small></strong>
                  </div>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${Math.max(pct, 4)}%`, background: etapa === "Fechado" ? "var(--success)" : "var(--primary)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </section>

      {/* ── Pedidos + Atendimentos ── */}
      <section className="dash-row split-50-50" style={{ padding: 0, boxShadow: "none", border: "none" }}>
        <section>
          <SectionTitle>Pedidos por Urgência</SectionTitle>
          <div className="report-bar-list">
            {Object.entries(report.pedidosByUrgencia).map(([urg, list]) => {
              const val = list.reduce((s, o) => s + o.aFaturar, 0);
              const pct = report.totalAFaturar > 0 ? Math.round((val / report.totalAFaturar) * 100) : 0;
              return (
                <div key={urg} className="report-bar-row">
                  <div className="report-bar-label">
                    <span style={{ color: URGENCIA_COLOR[urg] }}>{urg}</span>
                    <strong>{BRL.format(val)} <small>({list.length} pedidos)</small></strong>
                  </div>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${Math.max(pct, 4)}%`, background: URGENCIA_COLOR[urg] }} />
                  </div>
                </div>
              );
            })}
          </div>
          {report.overdueOrders.length > 0 && (
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>
              ⚠️ {report.overdueOrders.length} follow-up{report.overdueOrders.length > 1 ? "s" : ""} vencido{report.overdueOrders.length > 1 ? "s" : ""}
            </p>
          )}
        </section>

        <section>
          <SectionTitle>Atendimentos Registrados</SectionTitle>
          <div className="dash-kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
            <StatCard label="Hoje" value={report.contatosHoje} accent="var(--primary)" />
            <StatCard label="Semana" value={report.contatosSemana} accent="var(--secondary)" />
            <StatCard label="Mês" value={report.contatosMes} accent="var(--success)" />
          </div>
          {interactionsVendedoras.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Nenhum atendimento de vendedoras no período.</p>
          ) : (
            <div className="report-bar-list">
              {Object.entries(report.interByResultado).map(([res, count]) => {
                const pct = Math.round((count / interactionsVendedoras.length) * 100);
                return (
                  <div key={res} className="report-bar-row">
                    <div className="report-bar-label">
                      <span style={{ color: RESULTADO_COLOR[res] ?? "var(--muted)" }}>{res}</span>
                      <strong>{count} <small>({pct}%)</small></strong>
                    </div>
                    <div className="report-bar-track">
                      <div className="report-bar-fill" style={{ width: `${Math.max(pct, 4)}%`, background: RESULTADO_COLOR[res] ?? "var(--muted)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <section className="dash-row split-50-50" style={{ padding: 0, boxShadow: "none", border: "none" }}>
        <section>
          <SectionTitle>Motivos de Perda</SectionTitle>
          {lossReasons.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Nenhuma perda registrada com motivo.</p>
          ) : (
            <div className="report-bar-list">
              {lossReasons.map((r) => (
                <div key={r.reason} className="report-bar-row">
                  <div className="report-bar-label">
                    <span>{r.reason}</span>
                    <strong>{r.count} <small>({r.pct}%)</small></strong>
                  </div>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${Math.max(r.pct, 4)}%`, background: "var(--danger)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Conversão por Origem</SectionTitle>
          {originStats.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Nenhum lead cadastrado.</p>
          ) : (
            <div className="report-bar-list">
              {originStats.map((r) => (
                <div key={r.origem} className="report-bar-row">
                  <div className="report-bar-label">
                    <span>{r.origem}</span>
                    <strong>{r.converted}/{r.total} <small>({r.rate}%)</small></strong>
                  </div>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${Math.max(r.rate, 4)}%`, background: "var(--success)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      {/* ── Performance por Vendedora ── */}
      <section data-reports-sellers="simone-tatiane-only">
        <SectionTitle>Performance por Vendedora</SectionTitle>
        <p style={{ margin: "-6px 0 14px", fontSize: 12, color: "var(--muted)" }}>
          Time comercial: <strong>Simone Bosso</strong> e <strong>Tatiane Souza</strong>. Se a tabela listar outras pessoas, o navegador está com cache antigo — use <strong>Ctrl+Shift+R</strong> ou publique de novo o build.
        </p>
        {report.sellerStats.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Nenhuma vendedora ativa configurada.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Vendedora</th>
                  <th>Leads</th>
                  <th>Oportunidades</th>
                  <th>Fechadas</th>
                  <th>Taxa Conv.</th>
                  <th>Pipeline</th>
                  <th>Contatos</th>
                  <th>FU Vencidos</th>
                </tr>
              </thead>
              <tbody>
                {report.sellerStats.map((s) => (
                  <tr key={s.name}>
                    <td>
                      <div className="seller-main">
                        <span className="seller-avatar" style={{ background: s.color }}>
                          {s.initials}
                        </span>
                        <strong>{s.name}</strong>
                      </div>
                    </td>
                    <td>{s.leads}</td>
                    <td>{s.opps}</td>
                    <td style={{ color: "var(--success)", fontWeight: 700 }}>{s.fechadas}</td>
                    <td>{s.taxa}</td>
                    <td>{BRL.format(s.pipeline)}</td>
                    <td style={{ color: s.contatos > 0 ? "var(--primary)" : "var(--muted)" }}>{s.contatos}</td>
                    <td style={{ color: s.overdueFollowUps > 0 ? "var(--danger)" : "var(--success)", fontWeight: s.overdueFollowUps > 0 ? 700 : 400 }}>
                      {s.overdueFollowUps}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Histórico recente de atendimentos ── */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <SectionTitle>Últimos Atendimentos Registrados</SectionTitle>
          {interactionsVendedoras.length > 0 && (
            <small style={{ color: "var(--muted)" }}>{interactionsVendedoras.length} no período (só vendedoras)</small>
          )}
        </div>
        {interactionsVendedoras.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Nenhum atendimento de vendedoras no período. Atendimentos da gestora/admin não aparecem nesta lista.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Vendedora</th>
                <th>Tipo</th>
                <th>Resultado</th>
                <th>Resumo</th>
                <th>Prox. Retorno</th>
              </tr>
            </thead>
            <tbody>
              {[...interactionsVendedoras]
                .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
                .slice(0, 30)
                .map((i) => (
                <tr key={i.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--muted)" }}>
                    {new Date(i.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td><strong>{i.cliente}</strong></td>
                  <td>{i.vendedor}</td>
                  <td>{i.tipo}</td>
                  <td style={{ color: RESULTADO_COLOR[i.resultado] ?? "var(--muted)", fontWeight: 600 }}>
                    {i.resultado}
                  </td>
                  <td style={{ maxWidth: 260, fontSize: 13 }}>{i.resumo}</td>
                  <td style={{ fontSize: 12 }}>{i.proximoRetorno || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Relatório de Comissão ── */}
      {isAdm && (
        <CommissionReport opportunities={opportunities} activeSellers={comissaoSellerRows} />
      )}
    </div>
  );
}

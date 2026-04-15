import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCRM } from "../state/crm-context";
import { useSellers } from "../state/sellers-context";
import { useAuth } from "../state/auth-context";
import { isDashVendedoraName } from "../data/dashboard-data";
import { useDashboardData } from "../hooks/useDashboardData";
import { RegisterContactModal } from "../components/RegisterContactModal";
import type { AgendaRow } from "../hooks/useDashboardData";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function getWeekdayDateLabel() {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
  return `${weekday}, ${date}`;
}

function stageClass(stage: string) {
  if (stage.includes("Negociacao")) return "amber";
  if (stage.includes("Concluido")) return "green";
  if (stage.includes("Aguardando")) return "purple";
  return "cyan";
}

function useCountUp(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      setValue(Math.round(target * progress));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function trendLabel(val: number, unit = "") {
  if (val > 0) return `▲ ${val}${unit}`;
  if (val < 0) return `▼ ${Math.abs(val)}${unit}`;
  return "—";
}

function KpiCard({
  title,
  value,
  suffix = "",
  trend,
  icon,
  tone,
  pulse = false,
  onClick
}: {
  title: string;
  value: number;
  suffix?: string;
  trend: string;
  icon: string;
  tone: "cyan" | "green" | "amber" | "red" | "purple";
  pulse?: boolean;
  onClick?: () => void;
}) {
  const animated = useCountUp(value);
  return (
    <article className={`dash-kpi tone-${tone} ${pulse ? "pulse-alert" : ""}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : {}}>
      <div className="dash-kpi-head">
        <span>{title}</span>
        <small>{icon}</small>
      </div>
      <strong>
        {animated}
        {suffix}
      </strong>
      <p>{trend}</p>
    </article>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { isLoading, leads, opportunities, orders, interactions } = useCRM();
  const { sellers } = useSellers();
  const { isGestora, currentSellerName } = useAuth();
  const dashFilterSellers = useMemo(
    () => sellers.filter((s) => s.active && isDashVendedoraName(s.name)),
    [sellers]
  );
  const [registeringRow, setRegisteringRow] = useState<AgendaRow | null>(null);
  const [filterSeller, setFilterSeller] = useState<string>("");
  const [drillDown, setDrillDown] = useState<string | null>(null);

  const effectiveFilter = isGestora ? (filterSeller || undefined) : currentSellerName;
  const { kpis, funnel, sellerRows, agendaRows, monthlySeries, forecastValue } = useDashboardData(effectiveFilter);
  const hasAlerts = kpis.overdueFollowUps > 0;

  const chartMax = useMemo(() => {
    const values = monthlySeries.flatMap((item) => [item.leads, item.converted]);
    return Math.max(1, ...values);
  }, [monthlySeries]);

  return (
    <div className="dash-wrap">
      <section className="dash-hero">
        <div>
          <h2>Dashboard</h2>
          <p>{getWeekdayDateLabel()} · Olá, {isGestora ? "time comercial" : currentSellerName}</p>
          <p className="dash-hero-purpose">
            Visão geral do momento: prioridades do dia, KPIs, funil e agenda. Para análises por período e exportação, use <strong>Relatórios</strong> no menu.
          </p>
        </div>
        <div className="dash-hero-actions">
          <button type="button" className="cta-lead ripple-btn" onClick={() => navigate("/leads")}>
            + Novo Lead
          </button>
          <button type="button" className={`notify-btn ${hasAlerts ? "has-alert" : ""}`} aria-label="Notificacoes" onClick={() => navigate("/agenda")}>
            <span>🔔</span>
            {hasAlerts ? <em>{kpis.overdueFollowUps}</em> : null}
          </button>
          {isGestora && (
            <>
              <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)} className="seller-filter-select">
                <option value="">Todas as vendedoras</option>
                {dashFilterSellers.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              {filterSeller && (
                <button type="button" className="btn-ghost" onClick={() => setFilterSeller("")} style={{ fontSize: 12 }}>
                  Limpar filtro
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {isLoading ? (
        <section className="dash-skeleton-grid">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="skeleton-row" />
          ))}
        </section>
      ) : (
        <>
          <section className="dash-kpi-grid">
            <KpiCard
              title="Leads Ativos"
              value={kpis.activeLeads}
              trend={kpis.leadsTrend !== 0 ? `${trendLabel(kpis.leadsTrend, "% vs sem. ant.")}` : "Estável"}
              icon="◻"
              tone="cyan"
              onClick={() => setDrillDown("leads")}
            />
            <KpiCard
              title="Follow-ups Hoje"
              value={kpis.followUpsToday}
              trend={kpis.overdueFollowUps > 0 ? `${kpis.overdueFollowUps} atrasados` : "Em dia"}
              icon="◻"
              tone="red"
              pulse={kpis.followUpsToday > 0 || kpis.overdueFollowUps > 0}
              onClick={() => setDrillDown("followups")}
            />
            <KpiCard title="Convertidos" value={kpis.converted} trend={`Ticket médio: ${BRL.format(kpis.ticketMedio)}`} icon="◻" tone="green" onClick={() => setDrillDown("converted")} />
            <KpiCard title="Pedidos em Aberto" value={kpis.openOrders} trend="Acompanhar entrega" icon="◻" tone="amber" onClick={() => setDrillDown("orders")} />
            <KpiCard title="Taxa de Conversão" value={kpis.conversionRate} suffix="%" trend={kpis.cicloMedio > 0 ? `Ciclo médio: ${kpis.cicloMedio}d` : "Sem dados de ciclo"} icon="◻" tone="purple" onClick={() => setDrillDown("conversion")} />
            <KpiCard
              title="Contatos Hoje"
              value={kpis.contatosHoje}
              trend={kpis.contatosOntem > 0 ? `Ontem: ${kpis.contatosOntem} · Semana: ${kpis.contatosSemana}` : `${kpis.contatosSemana} esta semana`}
              icon="◻"
              tone="cyan"
              onClick={() => setDrillDown("contacts")}
            />
          </section>

          {/* Forecast bar */}
          {forecastValue > 0 && (
            <section className="dash-forecast">
              <div className="dash-forecast-inner">
                <span>📊 Forecast ponderado (pipeline ativo × probabilidade):</span>
                <strong>{BRL.format(forecastValue)}</strong>
              </div>
            </section>
          )}

          <section className="dash-row split-60-40">
            {isGestora ? (
            <article className="dash-card">
              <header className="dash-card-head">
                <h3>Ranking de Vendedoras</h3>
              </header>
              <div className="seller-table-header">
                <span className="seller-th" style={{ flex: 2 }}>Vendedora</span>
                <span className="seller-th">Leads</span>
                <span className="seller-th">Conv.</span>
                <span className="seller-th" style={{ flex: 1.5 }}>Taxa</span>
                <span className="seller-th">Contatos</span>
                <span className="seller-th">F.U. Venc.</span>
              </div>
              <div className="seller-table">
                {sellerRows.map((row) => (
                  <div key={row.name} className="seller-row">
                    <div className="seller-main" style={{ flex: 2 }}>
                      <span className="seller-avatar" style={{ background: row.color }}>
                        {row.initials}
                      </span>
                      <strong>{row.name}</strong>
                    </div>
                    <span>{row.activeLeads}</span>
                    <span className="ok">{row.converted}</span>
                    <div className="rate-bar-wrap" style={{ flex: 1.5 }}>
                      <div className="rate-bar">
                        <i style={{ width: `${row.conversionRate}%` }} className={row.conversionRate >= 70 ? "ok" : row.conversionRate >= 40 ? "warn" : "bad"} />
                      </div>
                      <small>{row.conversionRate}%</small>
                    </div>
                    <span style={{ color: row.contatos > 0 ? "var(--primary)" : "var(--muted)" }}>{row.contatos}</span>
                    <span className={row.overdueFollowUps > 0 ? "bad" : ""}>{row.overdueFollowUps}</span>
                  </div>
                ))}
              </div>
            </article>
            ) : null}

            <article className="dash-card">
              <header className="dash-card-head">
                <h3>Funil de Atendimento</h3>
              </header>
              <div className="funnel-list">
                {funnel.map((row) => (
                  <div key={row.label} className="funnel-row">
                    <div className="funnel-label">
                      <span>{row.label}</span>
                      <small>
                        {row.value} · {row.pct}%
                      </small>
                    </div>
                    <div className="funnel-bar">
                      <i style={{ width: `${Math.max(row.pct, 6)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="dash-row split-50-50">
            <article className="dash-card">
              <header className="dash-card-head">
                <h3>Agenda de Hoje</h3>
                <small>{agendaRows.length} itens</small>
              </header>
              <div className="agenda-list">
                {agendaRows.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                    Nenhum follow-up agendado para hoje.
                  </div>
                )}
                {agendaRows.map((row) => (
                  <div key={row.id} className={`agenda-row ${row.overdue && !row.done ? "late" : ""} ${row.done ? "done" : ""}`}>
                    <strong className="time">{row.time}</strong>
                    <span className="seller-avatar" style={{ background: row.sellerColor }}>
                      {row.sellerInitials}
                    </span>
                    <div>
                      <strong>{row.leadName}</strong>
                      <div>
                        <span className={`stage-badge ${stageClass(row.stage)}`}>{row.stage}</span>
                        {row.overdue && !row.done ? <em className="warning">! atrasado</em> : null}
                      </div>
                    </div>
                    <button type="button" className="cta-lead ripple-btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setRegisteringRow(row)}>
                      Registrar
                    </button>
                  </div>
                ))}
              </div>
            </article>

            <article className="dash-card">
              <header className="dash-card-head">
                <h3>Conversão dos Últimos 6 Meses</h3>
              </header>
              <div className="line-chart">
                {monthlySeries.map((row) => (
                  <div key={row.month} className="chart-col">
                    <div className="chart-bars">
                      <span className="bar-cyan" style={{ height: `${Math.max(8, (row.leads / chartMax) * 100)}%` }} title={`Leads: ${row.leads}`} />
                      <span className="bar-green" style={{ height: `${Math.max(8, (row.converted / chartMax) * 100)}%` }} title={`Convertidos: ${row.converted}`} />
                    </div>
                    <small>{row.month}</small>
                  </div>
                ))}
              </div>
              <footer className="chart-legend">
                <span>
                  <i className="lg-cyan" /> Leads recebidos
                </span>
                <span>
                  <i className="lg-green" /> Convertidos
                </span>
              </footer>
            </article>
          </section>
        </>
      )}

      {registeringRow && (
        <RegisterContactModal
          refType="order"
          refId={registeringRow.id}
          cliente={registeringRow.leadName}
          vendedor={registeringRow.seller}
          currentStage={registeringRow.stage}
          onClose={() => setRegisteringRow(null)}
        />
      )}

      {drillDown && (
        <div className="modal-backdrop" onClick={() => setDrillDown(null)}>
          <div className="modal-box" style={{ maxWidth: 640, width: "95vw", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>
                {drillDown === "leads" && "Leads Ativos"}
                {drillDown === "followups" && "Follow-ups Atrasados"}
                {drillDown === "converted" && "Oportunidades Fechadas"}
                {drillDown === "orders" && "Pedidos em Aberto"}
                {drillDown === "conversion" && "Funil de Conversão"}
                {drillDown === "contacts" && "Contatos Recentes"}
              </h3>
              <button className="modal-close" onClick={() => setDrillDown(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: "auto", flex: 1 }}>
              {drillDown === "leads" && (
                <table className="table">
                  <thead><tr><th>Nome</th><th>Origem</th><th>Responsável</th><th>Score</th><th>Status</th></tr></thead>
                  <tbody>
                    {leads.filter((l) => l.status !== "Perdido").slice(0, 30).map((l) => (
                      <tr key={l.id}><td><strong>{l.nome}</strong></td><td>{l.origem}</td><td>{l.responsavel}</td><td>{l.score}</td><td>{l.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {drillDown === "converted" && (
                <table className="table">
                  <thead><tr><th>Título</th><th>Cliente</th><th>Vendedora</th><th>Valor</th></tr></thead>
                  <tbody>
                    {opportunities.filter((o) => o.etapa === "Fechado").map((o) => (
                      <tr key={o.id}><td><strong>{o.titulo}</strong></td><td>{o.cliente}</td><td>{o.vendedor}</td><td>{BRL.format(o.valor)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {drillDown === "orders" && (
                <table className="table">
                  <thead><tr><th>#</th><th>Cliente</th><th>Vendedora</th><th>A Faturar</th><th>Dias</th><th>Urgência</th></tr></thead>
                  <tbody>
                    {orders.filter((o) => o.etapaCRM !== "Concluido").map((o) => (
                      <tr key={o.pedido}><td>{o.pedido}</td><td>{o.cliente}</td><td>{o.vendedor}</td><td>{BRL.format(o.aFaturar)}</td><td>{o.diasAberto}</td><td style={{ color: o.urgencia === "CRITICO" ? "var(--danger)" : o.urgencia === "ATENCAO" ? "var(--warning)" : "var(--success)" }}>{o.urgencia}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {drillDown === "contacts" && (
                <table className="table">
                  <thead><tr><th>Data</th><th>Cliente</th><th>Vendedora</th><th>Tipo</th><th>Resultado</th></tr></thead>
                  <tbody>
                    {[...interactions].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 20).map((i) => (
                      <tr key={i.id}><td style={{ fontSize: 12 }}>{new Date(i.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td><strong>{i.cliente}</strong></td><td>{i.vendedor}</td><td>{i.tipo}</td><td>{i.resultado}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {drillDown === "followups" && (
                <div style={{ fontSize: 13, color: "var(--muted)", padding: 20, textAlign: "center" }}>
                  <p>Veja todos os follow-ups na <strong>Agenda</strong>.</p>
                </div>
              )}
              {drillDown === "conversion" && (
                <div style={{ fontSize: 13, color: "var(--muted)", padding: 20, textAlign: "center" }}>
                  <p>Veja o detalhamento completo nos <strong>Relatórios</strong>.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

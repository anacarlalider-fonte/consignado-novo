import { useMemo, useState } from "react";
import { useCRM } from "../state/crm-context";
import { useAuth } from "../state/auth-context";
import { useGoals } from "../state/goals-context";
import { useToast } from "../state/toast-context";
import type { KpiResult, KpiStatus, SellerGoals, TeamGoals } from "../state/goals-context";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function fmt(value: number, unit: KpiResult["unit"]) {
  if (unit === "currency") return BRL.format(value);
  if (unit === "percent") return `${value}%`;
  return String(value);
}

function farolDot(status: KpiStatus) {
  const map: Record<KpiStatus, { emoji: string; cls: string; label: string }> = {
    green:  { emoji: "🟢", cls: "green",  label: "Atingido"  },
    yellow: { emoji: "🟡", cls: "yellow", label: "Atenção"   },
    red:    { emoji: "🔴", cls: "red",    label: "Abaixo"    },
    empty:  { emoji: "⚪", cls: "empty",  label: "Sem meta"  }
  };
  return map[status];
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function KpiCard({ kpi, editMode, value, onChange }: {
  kpi: KpiResult;
  editMode: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const dot = farolDot(kpi.status);
  const barPct = Math.min(kpi.pct, 100);

  return (
    <article className={`goal-card tone-${dot.cls}`}>
      <div className="goal-card-top">
        <span className="goal-label">{kpi.label}</span>
        <span className="goal-farol" title={dot.label}>{dot.emoji}</span>
      </div>

      <div className="goal-numbers">
        <strong className={`goal-realizado status-${dot.cls}`}>
          {fmt(kpi.realizado, kpi.unit)}
        </strong>
        <span className="goal-sep">/</span>
        {editMode ? (
          <input
            className="goal-meta-input"
            type="number"
            min={0}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            title="Meta"
          />
        ) : (
          <span className="goal-meta">{fmt(kpi.meta, kpi.unit)}</span>
        )}
      </div>

      <div className="goal-bar-wrap">
        <div className="goal-bar">
          <i
            className={`goal-bar-fill fill-${dot.cls}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        <small className={`goal-pct status-${dot.cls}`}>
          {kpi.meta === 0 ? "—" : `${kpi.pct}%`}
        </small>
      </div>

      <footer className="goal-card-footer">
        <span>Realizado</span>
        <span className={`goal-status-badge status-${dot.cls}`}>{dot.label}</span>
      </footer>
    </article>
  );
}

function StatusPill({ status }: { status: KpiStatus }) {
  const dot = farolDot(status);
  return (
    <span className={`goal-status-badge status-${dot.cls}`}>
      {dot.emoji} {dot.label}
    </span>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */

export function GoalsPage() {
  const { store, teamResults, sellerResults, updateTeamGoals, updateSellerGoals } = useGoals();
  const { pushToast } = useToast();
  const { leads, opportunities, orders, interactions } = useCRM();
  const { isGestora, currentSellerName } = useAuth();

  const visibleSellerResults = useMemo(() => {
    if (isGestora) return sellerResults;
    return sellerResults.filter((s) => s.name === currentSellerName);
  }, [sellerResults, isGestora, currentSellerName]);

  const [editMode, setEditMode] = useState(false);

  /* draft state while editing */
  const [draftTeam, setDraftTeam] = useState<TeamGoals>(store.team);
  const [draftSellers, setDraftSellers] = useState<Record<string, SellerGoals>>(
    () => Object.fromEntries(
      visibleSellerResults.map((s) => [s.name, (store.sellers[s.name] ?? {
        leadsAtivos: 5, conversoes: 2, taxaConversao: 40, followupsVencidos: 0
      })])
    )
  );

  function startEdit() {
    setDraftTeam({ ...store.team });
    setDraftSellers(
      Object.fromEntries(
        visibleSellerResults.map((s) => [
          s.name,
          store.sellers[s.name] ?? { leadsAtivos: 5, conversoes: 2, taxaConversao: 40, followupsVencidos: 0 }
        ])
      )
    );
    setEditMode(true);
  }

  function saveEdit() {
    updateTeamGoals(draftTeam);
    for (const [name, goals] of Object.entries(draftSellers)) {
      updateSellerGoals(name, goals);
    }
    setEditMode(false);
    pushToast("success", "Metas salvas com sucesso!");
  }

  function cancelEdit() {
    setEditMode(false);
  }

  function setTeamField(key: keyof TeamGoals, raw: string) {
    setDraftTeam((prev) => ({ ...prev, [key]: key === "period" ? raw : Number(raw) || 0 }));
  }

  function setSellerField(name: string, key: keyof SellerGoals, raw: string) {
    setDraftSellers((prev) => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), [key]: Number(raw) || 0 }
    }));
  }

  /* map teamResults to draft values for inputs */
  const teamDraftMap: Record<string, string> = {
    leadsAtivos:     String(draftTeam.leadsAtivos),
    conversoes:      String(draftTeam.conversoes),
    taxaConversao:   String(draftTeam.taxaConversao),
    followupsPrazo:  String(draftTeam.followupsPrazo),
    pedidosCriticos: String(draftTeam.pedidosCriticos),
    valorPipeline:   String(draftTeam.valorPipeline),
  };

  const sellerKpiKeys: Array<{ id: string; field: keyof SellerGoals; label: string; unit: KpiResult["unit"] }> = [
    { id: "leadsAtivos",      field: "leadsAtivos",      label: "Leads Ativos",   unit: "number"  },
    { id: "conversoes",       field: "conversoes",       label: "Conversões",     unit: "number"  },
    { id: "taxaConversao",    field: "taxaConversao",    label: "Taxa Conv.",     unit: "percent" },
    { id: "followupsVencidos",field: "followupsVencidos",label: "F.U. Vencidos",  unit: "number"  },
  ];

  /* summary counts */
  const greenCount  = visibleSellerResults.filter((s) => s.overallStatus === "green").length;
  const yellowCount = visibleSellerResults.filter((s) => s.overallStatus === "yellow").length;
  const redCount    = visibleSellerResults.filter((s) => s.overallStatus === "red").length;

  const sellerAnalysis = useMemo(() => {
    return visibleSellerResults.map((seller) => {
      const name = seller.name;
      const myInteractions = interactions.filter((i) => i.vendedor === name);
      const myOpps = opportunities.filter((o) => o.vendedor === name);
      const myFechadas = myOpps.filter((o) => o.etapa === "Fechado");
      const myLeads = leads.filter((l) => l.responsavel === name);

      const totalContatos = myInteractions.length;
      const positivos = myInteractions.filter((i) => i.resultado === "Positivo").length;
      const taxaPositivo = totalContatos > 0 ? Math.round((positivos / totalContatos) * 100) : 0;

      const ticketMedio = myFechadas.length > 0
        ? Math.round(myFechadas.reduce((s, o) => s + o.valor, 0) / myFechadas.length)
        : 0;

      let cicloMedio = 0;
      const comDatas = myFechadas.filter((o) => o.criadoEm && o.fechadoEm);
      if (comDatas.length > 0) {
        cicloMedio = Math.round(comDatas.reduce((s, o) => {
          return s + Math.max(0, (new Date(o.fechadoEm!).getTime() - new Date(o.criadoEm).getTime()) / 86_400_000);
        }, 0) / comDatas.length);
      }

      const strengths: string[] = [];
      const improvements: string[] = [];

      if (seller.kpis.find((k) => k.id === "conversoes")?.status === "green") strengths.push("Boa taxa de conversão");
      if (taxaPositivo >= 60) strengths.push("Alto engajamento positivo");
      if (ticketMedio > 30000) strengths.push("Ticket médio alto");
      if (totalContatos >= 10) strengths.push("Volume de contatos alto");

      if (seller.kpis.find((k) => k.id === "followupsVencidos")?.status === "red") improvements.push("Reduzir follow-ups vencidos");
      if (totalContatos < 3) improvements.push("Aumentar volume de contatos");
      if (taxaPositivo < 40 && totalContatos > 0) improvements.push("Melhorar qualidade dos contatos");
      if (cicloMedio > 60) improvements.push("Encurtar ciclo de venda");
      if (myLeads.filter((l) => l.status === "Novo").length > 3) improvements.push("Ativar leads novos parados");

      return {
        name,
        initials: seller.initials,
        color: seller.color,
        totalContatos,
        taxaPositivo,
        ticketMedio,
        cicloMedio,
        strengths,
        improvements,
        overallStatus: seller.overallStatus,
      };
    });
  }, [visibleSellerResults, leads, opportunities, interactions]);

  return (
    <div className="stack">
      {/* ── HEADER ── */}
      <section className="goals-hero">
        <div>
          <h2>Farol de Metas</h2>
          <p className="goals-period">
            Período:{" "}
            {editMode ? (
              <input
                className="period-input"
                value={draftTeam.period}
                onChange={(e) => setTeamField("period", e.target.value)}
                placeholder="Ex: Abril 2026"
              />
            ) : (
              <strong>{store.team.period}</strong>
            )}
          </p>
        </div>
        <div className="goals-hero-summary">
          <span className="goal-status-badge status-green">🟢 {greenCount} atingidas</span>
          <span className="goal-status-badge status-yellow">🟡 {yellowCount} atenção</span>
          <span className="goal-status-badge status-red">🔴 {redCount} abaixo</span>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          {isGestora && (
            editMode ? (
              <>
                <button type="button" className="cta-lead ripple-btn" onClick={saveEdit}>
                  Salvar metas
                </button>
                <button type="button" className="btn-ghost" onClick={cancelEdit}>
                  Cancelar
                </button>
              </>
            ) : (
              <button type="button" className="cta-lead ripple-btn" onClick={startEdit}>
                ✏ Editar metas
              </button>
            )
          )}
        </div>
      </section>

      {/* ── METAS DO TIME (gestora only) ── */}
      {isGestora && (
      <section>
        <h3 className="goals-section-title">Metas do Time</h3>
        <p className="goals-section-sub">KPIs consolidados de toda a equipe comercial</p>
        <div className="goals-kpi-grid">
          {teamResults.map((kpi) => (
            <KpiCard
              key={kpi.id}
              kpi={kpi}
              editMode={editMode}
              value={teamDraftMap[kpi.id] ?? String(kpi.meta)}
              onChange={(v) => setTeamField(kpi.id as keyof TeamGoals, v)}
            />
          ))}
        </div>
      </section>
      )}

      {/* ── METAS POR VENDEDORA ── */}
      <section>
        <h3 className="goals-section-title">{isGestora ? "Metas por Vendedora" : "Minhas Metas"}</h3>
        <p className="goals-section-sub">
          Resultado individual · clique em "Editar metas" para ajustar as metas de cada uma
        </p>

        {visibleSellerResults.length === 0 ? (
          <p style={{ opacity: 0.6, marginTop: 12 }}>
            Nenhuma vendedora ativa. Configure o time em Administração.
          </p>
        ) : (
          <div className="seller-goals-table-wrap">
            <table className="table seller-goals-table">
              <thead>
                <tr>
                  <th>Vendedora</th>
                  {sellerKpiKeys.map((k) => (
                    <th key={k.id}>{k.label}</th>
                  ))}
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {visibleSellerResults.map((seller) => {
                  const draft = draftSellers[seller.name] ?? { leadsAtivos: 5, conversoes: 2, taxaConversao: 40, followupsVencidos: 0 };
                  return (
                    <tr key={seller.name} className={`seller-goals-row status-row-${seller.overallStatus}`}>
                      <td>
                        <div className="seller-main">
                          <span className="seller-avatar" style={{ background: seller.color }}>
                            {seller.initials}
                          </span>
                          <strong>{seller.name}</strong>
                        </div>
                      </td>
                      {seller.kpis.map((kpi) => {
                        const dot = farolDot(kpi.status);
                        const field = sellerKpiKeys.find((k) => k.id === kpi.id)?.field;
                        return (
                          <td key={kpi.id} className="goal-cell">
                            <div className="goal-cell-inner">
                              <span className={`goal-cell-val status-${dot.cls}`}>
                                {fmt(kpi.realizado, kpi.unit)}
                              </span>
                              <span className="goal-cell-sep">/</span>
                              {editMode && field ? (
                                <input
                                  className="goal-inline-input"
                                  type="number"
                                  min={0}
                                  value={draft[field]}
                                  onChange={(e) => setSellerField(seller.name, field, e.target.value)}
                                />
                              ) : (
                                <span className="goal-cell-meta">{fmt(kpi.meta, kpi.unit)}</span>
                              )}
                              <span className="goal-farol-sm">{dot.emoji}</span>
                            </div>
                            <div className="goal-bar goal-bar-sm">
                              <i
                                className={`goal-bar-fill fill-${dot.cls}`}
                                style={{ width: `${Math.min(kpi.pct, 100)}%` }}
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td>
                        <StatusPill status={seller.overallStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── LEGENDA ── */}
      <section className="goals-legend-section">
        <h3 className="goals-section-title">Legenda</h3>
        <div className="goals-legend-grid">
          <div className="legend-item">
            <span>🟢</span>
            <div>
              <strong>Atingido</strong>
              <p>Realizado ≥ 100% da meta (ou ≤ meta para KPIs onde menor é melhor)</p>
            </div>
          </div>
          <div className="legend-item">
            <span>🟡</span>
            <div>
              <strong>Atenção</strong>
              <p>Realizado entre 70% e 99% da meta</p>
            </div>
          </div>
          <div className="legend-item">
            <span>🔴</span>
            <div>
              <strong>Abaixo</strong>
              <p>Realizado abaixo de 70% da meta — requer ação imediata</p>
            </div>
          </div>
          <div className="legend-item">
            <span>⚪</span>
            <div>
              <strong>Sem meta</strong>
              <p>Meta ainda não definida para este KPI</p>
            </div>
          </div>
        </div>
        <p className="goals-legend-note">
          Os valores <strong>realizados</strong> são calculados automaticamente a partir dos dados do CRM em tempo real.
          As <strong>metas</strong> são editáveis clicando em "Editar metas" e ficam salvas localmente neste navegador.
        </p>
      </section>

      {/* ── COMPARATIVO DE PERFORMANCE ── */}
      <section>
        <h3 className="goals-section-title">Comparativo de Performance</h3>
        <p className="goals-section-sub">Métricas detalhadas por vendedora</p>
        {sellerAnalysis.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Vendedora</th>
                  <th style={{ textAlign: "right" }}>Contatos</th>
                  <th style={{ textAlign: "right" }}>% Positivos</th>
                  <th style={{ textAlign: "right" }}>Ticket Médio</th>
                  <th style={{ textAlign: "right" }}>Ciclo (dias)</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {sellerAnalysis.map((s) => (
                  <tr key={s.name}>
                    <td>
                      <div className="seller-main">
                        <span className="seller-avatar" style={{ background: s.color }}>{s.initials}</span>
                        <strong>{s.name}</strong>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>{s.totalContatos}</td>
                    <td style={{ textAlign: "right", color: s.taxaPositivo >= 60 ? "var(--success)" : s.taxaPositivo >= 40 ? "var(--warning)" : "var(--danger)" }}>{s.taxaPositivo}%</td>
                    <td style={{ textAlign: "right" }}>{s.ticketMedio > 0 ? BRL.format(s.ticketMedio) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{s.cicloMedio > 0 ? `${s.cicloMedio}d` : "—"}</td>
                    <td><StatusPill status={s.overallStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── PAINEL DE COACHING ── */}
      <section>
        <h3 className="goals-section-title">Painel de Coaching</h3>
        <p className="goals-section-sub">Pontos fortes e melhorias identificados automaticamente</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {/* ── Card consolidado do time ── */}
          {isGestora && sellerAnalysis.length > 0 && (() => {
            const totalContatos = sellerAnalysis.reduce((s, a) => s + a.totalContatos, 0);
            const avgPositivo = sellerAnalysis.length > 0
              ? Math.round(sellerAnalysis.reduce((s, a) => s + a.taxaPositivo, 0) / sellerAnalysis.length)
              : 0;
            const ticketsValidos = sellerAnalysis.filter((a) => a.ticketMedio > 0);
            const avgTicket = ticketsValidos.length > 0
              ? Math.round(ticketsValidos.reduce((s, a) => s + a.ticketMedio, 0) / ticketsValidos.length)
              : 0;
            const ciclosValidos = sellerAnalysis.filter((a) => a.cicloMedio > 0);
            const avgCiclo = ciclosValidos.length > 0
              ? Math.round(ciclosValidos.reduce((s, a) => s + a.cicloMedio, 0) / ciclosValidos.length)
              : 0;

            const teamStrengths: string[] = [];
            const teamImprovements: string[] = [];

            if (greenCount > redCount) teamStrengths.push(`${greenCount} vendedora${greenCount > 1 ? "s" : ""} atingindo metas`);
            if (avgPositivo >= 60) teamStrengths.push(`Engajamento positivo médio alto (${avgPositivo}%)`);
            if (avgTicket > 30000) teamStrengths.push(`Ticket médio do time elevado (${BRL.format(avgTicket)})`);
            if (totalContatos >= sellerAnalysis.length * 5) teamStrengths.push("Bom volume geral de contatos");

            if (redCount > 0) teamImprovements.push(`${redCount} vendedora${redCount > 1 ? "s" : ""} abaixo das metas`);
            if (avgPositivo < 40 && totalContatos > 0) teamImprovements.push("Melhorar qualidade dos atendimentos do time");
            if (avgCiclo > 45) teamImprovements.push(`Ciclo de venda longo (média ${avgCiclo}d)`);
            if (totalContatos < sellerAnalysis.length * 3) teamImprovements.push("Aumentar volume de contatos do time");
            const semContatos = sellerAnalysis.filter((a) => a.totalContatos === 0);
            if (semContatos.length > 0) teamImprovements.push(`${semContatos.length} vendedora${semContatos.length > 1 ? "s" : ""} sem nenhum contato registrado`);

            return (
              <article style={{ background: "var(--card)", borderRadius: 12, padding: 20, border: "2px solid var(--primary)", gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span className="team-avatar" style={{ background: "var(--primary)" }}>TM</span>
                  <div>
                    <strong style={{ fontSize: 16 }}>Visao do Time</strong>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                      {sellerAnalysis.length} vendedora{sellerAnalysis.length !== 1 ? "s" : ""} · {totalContatos} contatos · Ticket medio {avgTicket > 0 ? BRL.format(avgTicket) : "—"} · Ciclo medio {avgCiclo > 0 ? `${avgCiclo}d` : "—"}
                    </p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <small style={{ color: "var(--success)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>Pontos fortes do time</small>
                    {teamStrengths.length > 0
                      ? teamStrengths.map((str) => <p key={str} style={{ fontSize: 13, margin: "4px 0 0", color: "var(--text)" }}>✅ {str}</p>)
                      : <p style={{ fontSize: 13, margin: "4px 0 0", color: "var(--muted)" }}>Dados insuficientes</p>
                    }
                  </div>
                  <div>
                    <small style={{ color: "var(--warning)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>Melhorias para o time</small>
                    {teamImprovements.length > 0
                      ? teamImprovements.map((imp) => <p key={imp} style={{ fontSize: 13, margin: "4px 0 0", color: "var(--text)" }}>⚡ {imp}</p>)
                      : <p style={{ fontSize: 13, margin: "4px 0 0", color: "var(--muted)" }}>Nenhuma melhoria identificada</p>
                    }
                  </div>
                </div>
              </article>
            );
          })()}

          {/* ── Cards individuais ── */}
          {sellerAnalysis.map((s) => (
            <article key={s.name} style={{ background: "var(--card)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
              <div className="seller-main" style={{ marginBottom: 12 }}>
                <span className="seller-avatar" style={{ background: s.color }}>{s.initials}</span>
                <strong>{s.name}</strong>
              </div>
              {s.strengths.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <small style={{ color: "var(--success)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>Pontos fortes</small>
                  {s.strengths.map((str) => (
                    <p key={str} style={{ fontSize: 13, margin: "4px 0 0", color: "var(--text)" }}>✅ {str}</p>
                  ))}
                </div>
              )}
              {s.improvements.length > 0 && (
                <div>
                  <small style={{ color: "var(--warning)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>Melhorias sugeridas</small>
                  {s.improvements.map((imp) => (
                    <p key={imp} style={{ fontSize: 13, margin: "4px 0 0", color: "var(--text)" }}>⚡ {imp}</p>
                  ))}
                </div>
              )}
              {s.strengths.length === 0 && s.improvements.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Dados insuficientes para análise.</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

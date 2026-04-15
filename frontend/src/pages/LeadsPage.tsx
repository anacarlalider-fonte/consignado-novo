import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCRM } from "../state/crm-context";
import { useAuth } from "../state/auth-context";
import { useToast } from "../state/toast-context";
import { Pagination } from "../components/Pagination";
import { normalizeCpf, type Interaction, type Lead } from "../data/mock-data";
import { LeadColdImporter } from "../components/LeadColdImporter";
import { splitLeadTelefones } from "../utils/lead-to-client";

const STATUS_OPTIONS: Lead["status"][] = ["Novo", "Em contato", "Qualificado", "Perdido"];

function fmtBrDateShort(iso: string | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

function moneyCell(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const LOSS_REASONS = [
  "Preço alto",
  "Escolheu concorrente",
  "Desistiu do projeto",
  "Sem retorno",
  "Prazo não atendido",
  "Outro",
] as const;

function getLeadTemp(lead: Lead, interactions: Interaction[]): { label: string; color: string; icon: string } {
  const lastContact = interactions
    .filter((i) => i.cliente.toLowerCase() === lead.nome.toLowerCase())
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];

  const daysSinceContact = lastContact
    ? Math.floor((Date.now() - new Date(lastContact.criadoEm).getTime()) / 86_400_000)
    : (lead.criadoEm ? Math.floor((Date.now() - new Date(lead.criadoEm).getTime()) / 86_400_000) : 999);

  const scoreFactor = lead.score >= 70 ? 2 : lead.score >= 40 ? 1 : 0;
  const recencyFactor = daysSinceContact <= 3 ? 2 : daysSinceContact <= 7 ? 1 : 0;
  const total = scoreFactor + recencyFactor;

  if (total >= 3) return { label: "Quente", color: "#FF4D6A", icon: "🔥" };
  if (total >= 2) return { label: "Morno", color: "#FFB020", icon: "🌤" };
  return { label: "Frio", color: "#94A3B8", icon: "❄️" };
}

function calcAutoScore(lead: Lead, interactions: Interaction[]): number {
  let s = 0;

  // Origin bonus
  const originBonus: Record<string, number> = {
    Indicacao: 20,
    "Visita loja": 18,
    Telefone: 15,
    WhatsApp: 12,
    Instagram: 10,
    Google: 8,
    Site: 6,
    Feira: 10,
    "Base fria (CSV)": 8,
  };
  s += originBonus[lead.origem] ?? 5;

  // Has contact info
  if (lead.telefone) s += 10;
  if (lead.email) s += 5;

  // Engagement (interactions count)
  const myInts = interactions.filter((i) => i.cliente.toLowerCase() === lead.nome.toLowerCase());
  if (myInts.length >= 3) s += 15;
  else if (myInts.length >= 1) s += 8;

  // Positive results
  const positives = myInts.filter((i) => i.resultado === "Positivo").length;
  s += positives * 5;

  // Recency of last contact
  if (myInts.length > 0) {
    const last = myInts.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
    const days = Math.floor((Date.now() - new Date(last.criadoEm).getTime()) / 86_400_000);
    if (days <= 1) s += 15;
    else if (days <= 3) s += 10;
    else if (days <= 7) s += 5;
  }

  // Status progression
  if (lead.status === "Em contato") s += 10;
  if (lead.status === "Qualificado") s += 20;

  return Math.min(100, Math.max(0, s));
}

type LeadsView = "lista" | "importar-fria";

export function LeadsPage() {
  const navigate = useNavigate();
  const { leads: rawLeads, addLead, updateLead, addOpportunity, interactions, isLoading } = useCRM();
  const { isGestora, currentSellerName } = useAuth();
  const { pushToast } = useToast();

  const allLeads = useMemo(() => {
    if (isGestora) return rawLeads;
    return rawLeads.filter((l) => l.responsavel === currentSellerName);
  }, [rawLeads, isGestora, currentSellerName]);

  const [view, setView] = useState<LeadsView>("lista");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState("");
  const [responsavel, setResponsavel] = useState(isGestora ? "" : currentSellerName);
  const [score, setScore] = useState("50");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Convert modal state
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [convertTitulo, setConvertTitulo] = useState("");
  const [convertValor, setConvertValor] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  // Loss reason modal state
  const [lossLead, setLossLead] = useState<Lead | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [lossCustom, setLossCustom] = useState("");
  const [isSavingLoss, setIsSavingLoss] = useState(false);

  const leads = useMemo(() => {
    const q = search.toLowerCase().trim();
    const qDigits = search.replace(/\D/g, "");
    return allLeads.filter((lead) => {
      const okName = !q || lead.nome.toLowerCase().includes(q);
      const okCpf =
        qDigits.length >= 3 &&
        lead.cpf &&
        normalizeCpf(lead.cpf).includes(qDigits);
      const okSearch = okName || okCpf;
      const okStatus = !statusFilter || lead.status === statusFilter;
      return okSearch && okStatus;
    });
  }, [allLeads, search, statusFilter]);

  useEffect(() => setPage(1), [search, statusFilter]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(leads.length / pageSize));
  const visible = leads.slice((page - 1) * pageSize, page * pageSize);

  /* ── Add new lead ─────────────────────────────────────────────────── */

  async function handleAddLead() {
    if (isSubmitting) return;
    if (!nome.trim() || nome.trim().length < 3) {
      pushToast("error", "Informe nome do lead com pelo menos 3 caracteres.");
      return;
    }
    const scoreNum = Number(score);
    if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      pushToast("error", "Score deve estar entre 0 e 100.");
      return;
    }
    try {
      setIsSubmitting(true);
      await addLead({
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        origem: origem || "Manual",
        responsavel: responsavel || "Nao definido",
        score: scoreNum,
        status: "Novo",
      });
      setNome("");
      setTelefone("");
      setEmail("");
      setOrigem("");
      setResponsavel("");
      setScore("50");
      pushToast("success", "Lead criado com sucesso.");
    } catch {
      pushToast("error", "Falha ao criar lead.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ── Status change per row ────────────────────────────────────────── */

  function handleStatusChange(lead: Lead, newStatus: Lead["status"]) {
    if (newStatus === lead.status) return;

    if (newStatus === "Perdido") {
      setLossLead(lead);
      setLossReason("");
      setLossCustom("");
      return;
    }

    updateLead(lead.id, { status: newStatus });
    pushToast("success", `Status de "${lead.nome}" alterado para ${newStatus}.`);
  }

  /* ── Loss reason modal confirm ────────────────────────────────────── */

  async function handleConfirmLoss() {
    if (!lossLead) return;
    const reason = lossReason === "Outro" ? lossCustom.trim() : lossReason;
    if (!reason) {
      pushToast("error", "Informe o motivo da perda.");
      return;
    }
    setIsSavingLoss(true);
    try {
      updateLead(lossLead.id, { status: "Perdido", motivoPerda: reason });
      pushToast("success", `Lead "${lossLead.nome}" marcado como Perdido.`);
      setLossLead(null);
    } catch {
      pushToast("error", "Falha ao salvar motivo da perda.");
    } finally {
      setIsSavingLoss(false);
    }
  }

  /* ── Convert to pipeline ──────────────────────────────────────────── */

  function openConvertModal(lead: Lead) {
    setConvertLead(lead);
    setConvertTitulo(`Oportunidade - ${lead.nome}`);
    setConvertValor("");
  }

  async function handleConfirmConvert() {
    if (!convertLead) return;
    if (!convertTitulo.trim()) {
      pushToast("error", "Informe o título da oportunidade.");
      return;
    }
    const valor = convertValor ? Number(convertValor) : 0;
    if (!Number.isFinite(valor) || valor < 0) {
      pushToast("error", "Informe um valor estimado válido.");
      return;
    }

    setIsConverting(true);
    try {
      const realId = await addOpportunity({
        titulo: convertTitulo.trim(),
        cliente: convertLead.nome,
        vendedor: convertLead.responsavel,
        valor,
        etapa: "Prospeccao",
        origemLead: convertLead.origem,
        convertidoDeLeadId: convertLead.id,
        telefoneCliente: convertLead.telefone,
        emailCliente: convertLead.email,
      });

      updateLead(convertLead.id, {
        status: "Qualificado",
        convertidoParaOportunidadeId: realId,
      });

      pushToast("success", `Lead "${convertLead.nome}" convertido em oportunidade.`);
      setConvertLead(null);
    } catch {
      pushToast("error", "Falha ao converter lead.");
    } finally {
      setIsConverting(false);
    }
  }

  function isPipelineConvertDisabled(lead: Lead) {
    return !!lead.convertidoParaOportunidadeId || lead.status === "Perdido";
  }

  function isClienteConvertDisabled(lead: Lead) {
    return !!lead.convertidoParaClienteId || lead.status === "Perdido";
  }

  function openCadastroCliente(lead: Lead) {
    navigate("/clientes", { state: { prefillFromLead: lead } });
  }

  /* ── Render ───────────────────────────────────────────────────────── */

  if (view === "importar-fria") {
    return (
      <div className="stack">
        <section>
          <button type="button" className="btn-ghost" onClick={() => setView("lista")} style={{ marginBottom: 8 }}>
            ← Voltar para leads
          </button>
          <h2>Importar base fria (CSV)</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Mesma planilha consignado dos clientes; registros entram como leads (origem &quot;Base fria (CSV)&quot;) para qualificar antes do cadastro completo.
          </p>
        </section>
        <section>
          <LeadColdImporter onDone={() => setView("lista")} />
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2>Leads</h2>
            <p>Gestao de entrada e qualificacao para prospeccao ativa.</p>
          </div>
          <button type="button" className="cta-lead ripple-btn" onClick={() => setView("importar-fria")}>
            Importar base fria (CSV)
          </button>
        </div>
        <div className="filters-row">
          <input
            placeholder="Buscar por nome ou CPF"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="Novo">Novo</option>
            <option value="Em contato">Em contato</option>
            <option value="Qualificado">Qualificado</option>
            <option value="Perdido">Perdido</option>
          </select>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setView("importar-fria")}
            style={{ whiteSpace: "nowrap" }}
            title="Importar planilha consignado (um ou dois arquivos) como leads"
          >
            Importar CSV — base fria
          </button>
        </div>
        <div className="form-row">
          <input placeholder="Nome do lead *" value={nome} onChange={(e) => setNome(e.target.value)} />
          <input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">Origem</option>
            <option value="Instagram">Instagram</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Google">Google</option>
            <option value="Indicacao">Indicação</option>
            <option value="Feira">Feira / Evento</option>
            <option value="Site">Site</option>
            <option value="Telefone">Telefone</option>
            <option value="Visita loja">Visita na loja</option>
            <option value="Outro">Outro</option>
            <option value="Base fria (CSV)">Base fria (CSV)</option>
          </select>
          <input
            placeholder="Responsável"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
          />
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="Score"
            style={{ maxWidth: 80 }}
          />
          <button type="button" onClick={() => void handleAddLead()} disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Novo lead"}
          </button>
        </div>
      </section>

      <section>
        {isLoading ? (
          <div className="skeleton-table">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="skeleton-row" />
            ))}
          </div>
        ) : (
          <div className="leads-fria-table-wrap">
            <table className="table leads-fria-table">
              <colgroup>
                <col className="lf-c lf-c-num" />
                <col className="lf-c lf-c-cpf" />
                <col className="lf-c lf-c-nome" />
                <col className="lf-c lf-c-nb" />
                <col className="lf-c lf-c-dt" />
                <col className="lf-c lf-c-dt" />
                <col className="lf-c lf-c-idade" />
                <col className="lf-c lf-c-esp" />
                <col className="lf-c lf-c-tel" />
                <col className="lf-c lf-c-tel" />
                <col className="lf-c lf-c-tel" />
                <col className="lf-c lf-c-money" />
                <col className="lf-c lf-c-money" />
                <col className="lf-c lf-c-money" />
                <col className="lf-c lf-c-money" />
                <col className="lf-c lf-c-money" />
                <col className="lf-c lf-c-money" />
                <col className="lf-c lf-c-money" />
                <col className="lf-c lf-c-money" />
                <col className="lf-c lf-c-city" />
                <col className="lf-c lf-c-uf" />
                <col className="lf-c lf-c-orig" />
                <col className="lf-c lf-c-resp" />
                <col className="lf-c lf-c-score" />
                <col className="lf-c lf-c-temp" />
                <col className="lf-c lf-c-status" />
                <col className="lf-c lf-c-acoes" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>CPF</th>
                  <th>Nome</th>
                  <th>NB</th>
                  <th>Data nasc.</th>
                  <th>DDB</th>
                  <th>Idade</th>
                  <th>Espécie benefício</th>
                  <th>Tel. 1</th>
                  <th>Tel. 2</th>
                  <th>Tel. 3</th>
                  <th>Salário</th>
                  <th>Margem 35%</th>
                  <th>Margem RMC</th>
                  <th>Margem RCC</th>
                  <th>Vlr lib. 35%</th>
                  <th>Vlr lib. RMC</th>
                  <th>Vlr lib. RCC</th>
                  <th>Total</th>
                  <th>Cidade</th>
                  <th>UF</th>
                  <th>Origem</th>
                  <th>Resp.</th>
                  <th>Score</th>
                  <th>Temp.</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead, idx) => {
                  const d = lead.dadosConsignado;
                  const [tel1, tel2, tel3] = splitLeadTelefones(lead);
                  const cpfFmt =
                    lead.cpf && normalizeCpf(lead.cpf).length === 11
                      ? normalizeCpf(lead.cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                      : "—";
                  const uf = (d?.estado ?? "").trim().slice(0, 2).toUpperCase();
                  const lastInt = interactions
                    .filter((i) => i.cliente.toLowerCase() === lead.nome.toLowerCase())
                    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
                  const days = lastInt
                    ? Math.floor((Date.now() - new Date(lastInt.criadoEm).getTime()) / 86_400_000)
                    : lead.criadoEm
                      ? Math.floor((Date.now() - new Date(lead.criadoEm).getTime()) / 86_400_000)
                      : null;
                  const temp = getLeadTemp(lead, interactions);
                  const auto = calcAutoScore(lead, interactions);
                  const diff = auto - lead.score;
                  return (
                    <tr key={lead.id}>
                      <td className="leads-fria-td">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="leads-fria-td leads-fria-td-mono">{cpfFmt}</td>
                      <td className="leads-fria-td leads-fria-td-nome">
                        <div className="leads-fria-cell-clip">
                          <strong className="leads-fria-nome-text">{lead.nome}</strong>
                          {days !== null && days > 5 && (
                            <small
                              className="leads-fria-days"
                              style={{
                                color: days > 10 ? "var(--danger)" : "var(--warning)",
                              }}
                            >
                              {days}d sem contato
                            </small>
                          )}
                        </div>
                      </td>
                      <td className="leads-fria-td leads-fria-td-mono">{d?.nb ?? "—"}</td>
                      <td className="leads-fria-td">{fmtBrDateShort(d?.dataNascimento)}</td>
                      <td className="leads-fria-td">{fmtBrDateShort(d?.dataDespachoBeneficio)}</td>
                      <td className="leads-fria-td">{d?.idadeRef != null ? String(d.idadeRef) : "—"}</td>
                      <td className="leads-fria-td leads-fria-td-esp">
                        <div className="leads-fria-cell-clip">{d?.especieBeneficio?.trim() || "—"}</div>
                      </td>
                      <td className="leads-fria-td">
                        {tel1 ? (
                          <span className="leads-fria-tel-wrap">
                            <span>{tel1}</span>
                            <button
                              type="button"
                              className="leads-wa-btn"
                              onClick={() => {
                                const digits = tel1.replace(/\D/g, "");
                                const num = digits.startsWith("55") ? digits : `55${digits}`;
                                window.open(`https://wa.me/${num}`, "_blank");
                              }}
                              title="WhatsApp"
                            >
                              WA
                            </button>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="leads-fria-td">{tel2 || "—"}</td>
                      <td className="leads-fria-td">{tel3 || "—"}</td>
                      <td className="leads-fria-td leads-fria-td-money">{moneyCell(d?.salarioBrutoReferencia)}</td>
                      <td className="leads-fria-td leads-fria-td-money">{moneyCell(d?.margemPct35)}</td>
                      <td className="leads-fria-td leads-fria-td-money">{moneyCell(d?.margemRmc)}</td>
                      <td className="leads-fria-td leads-fria-td-money">{moneyCell(d?.margemRcc)}</td>
                      <td className="leads-fria-td leads-fria-td-money">{moneyCell(d?.vlrLiberado35)}</td>
                      <td className="leads-fria-td leads-fria-td-money">{moneyCell(d?.vlrLiberadoRmc)}</td>
                      <td className="leads-fria-td leads-fria-td-money">{moneyCell(d?.vlrLiberadoRcc)}</td>
                      <td className="leads-fria-td leads-fria-td-money">{moneyCell(d?.totalLiberado)}</td>
                      <td className="leads-fria-td">{d?.cidade ?? "—"}</td>
                      <td className="leads-fria-td">{uf.length === 2 ? uf : d?.estado ?? "—"}</td>
                      <td className="leads-fria-td">{lead.origem}</td>
                      <td className="leads-fria-td">{lead.responsavel}</td>
                      <td className="leads-fria-td">
                        <span style={{ fontWeight: 700 }}>{lead.score}</span>
                        {Math.abs(diff) >= 5 && (
                          <span
                            style={{
                              fontSize: 10,
                              color: diff > 0 ? "var(--success)" : "var(--danger)",
                              fontWeight: 600,
                              marginLeft: 4,
                            }}
                            title={`Calculado: ${auto}`}
                          >
                            ({diff > 0 ? "+" : ""}
                            {diff})
                          </span>
                        )}
                      </td>
                      <td className="leads-fria-td">
                        <span style={{ fontWeight: 600, color: temp.color }} title="Temperatura estimada">
                          {temp.icon} {temp.label}
                        </span>
                      </td>
                      <td className="leads-fria-td">
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead, e.target.value as Lead["status"])}
                          style={{ fontSize: 12, maxWidth: "100%" }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="leads-fria-td leads-fria-td-acoes">
                        <div className="leads-actions-cell">
                          <button
                            type="button"
                            className="btn-ghost leads-action-btn"
                            disabled={isClienteConvertDisabled(lead)}
                            onClick={() => openCadastroCliente(lead)}
                            title={
                              lead.convertidoParaClienteId
                                ? "Já convertido em cliente"
                                : "Abrir cadastro de cliente com dados do lead"
                            }
                          >
                            {lead.convertidoParaClienteId ? "Já é cliente" : "Converter em cliente"}
                          </button>
                          <button
                            type="button"
                            className="cta-lead ripple-btn leads-action-btn"
                            disabled={isPipelineConvertDisabled(lead)}
                            onClick={() => openConvertModal(lead)}
                            title={
                              isPipelineConvertDisabled(lead)
                                ? "Já convertido ou status final"
                                : "Criar oportunidade no pipeline"
                            }
                          >
                            {lead.convertidoParaOportunidadeId ? "Oportunidade" : "Pipeline"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      {/* ── Convert to Pipeline Modal ─────────────────────────────────── */}
      {convertLead && (
        <div className="modal-backdrop" onClick={() => setConvertLead(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>Converter Lead em Oportunidade</span>
              <button className="modal-close" onClick={() => setConvertLead(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Lead: <strong>{convertLead.nome}</strong>
              </p>
              <label className="modal-field">
                Título da oportunidade
                <input
                  value={convertTitulo}
                  onChange={(e) => setConvertTitulo(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="modal-field">
                Valor estimado (R$) — opcional
                <input
                  type="number"
                  min={0}
                  value={convertValor}
                  onChange={(e) => setConvertValor(e.target.value)}
                  placeholder="Ex: 15000"
                />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setConvertLead(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="cta-lead ripple-btn"
                onClick={() => void handleConfirmConvert()}
                disabled={isConverting}
              >
                {isConverting ? "Convertendo..." : "Confirmar Conversão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loss Reason Modal ─────────────────────────────────────────── */}
      {lossLead && (
        <div className="modal-backdrop" onClick={() => setLossLead(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>Motivo da Perda</span>
              <button className="modal-close" onClick={() => setLossLead(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Lead: <strong>{lossLead.nome}</strong>
              </p>
              <label className="modal-field">
                Motivo
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  autoFocus
                >
                  <option value="">Selecione o motivo...</option>
                  {LOSS_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              {lossReason === "Outro" && (
                <label className="modal-field">
                  Descreva o motivo
                  <input
                    value={lossCustom}
                    onChange={(e) => setLossCustom(e.target.value)}
                    placeholder="Motivo personalizado..."
                  />
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setLossLead(null)}>
                Cancelar
              </button>
              <button
                className="btn-danger ripple-btn"
                onClick={() => void handleConfirmLoss()}
                disabled={isSavingLoss || (!lossReason || (lossReason === "Outro" && !lossCustom.trim()))}
              >
                {isSavingLoss ? "Salvando..." : "Confirmar Perda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

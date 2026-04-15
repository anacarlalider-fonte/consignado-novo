import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCRM } from "../state/crm-context";
import { useToast } from "../state/toast-context";
import { Pagination } from "../components/Pagination";
import { ClientImporter } from "../components/ClientImporter";
import { PdfImporter } from "../components/PdfImporter";
import { ClientCadastroConsignadoWizard } from "../components/ClientCadastroConsignadoWizard";
import { normalizeCpf, type Client, type Lead, type NewClient } from "../data/mock-data";
import { leadToWizardPrefill } from "../utils/lead-to-client";

type View = "lista" | "cadastro" | "importar-csv" | "importar-pdf";
type ModalTab = "dados" | "historico";

type TimelineItem = {
  id: string;
  type: "Lead" | "Oportunidade" | "Pedido" | "Atendimento";
  icon: string;
  date: string;
  summary: string;
  status: string;
  sortTs: number;
};

type RefOption = { label: string; refType: "opportunity" | "order" | "lead"; refId: string };

/* ── helpers ────────────────────────────────────────────────────────────── */

const emptyForm: NewClient = {
  nome: "", telefone: "", telefone2: "", telefone3: "", email: "", endereco: "", numero: "",
  complemento: "", bairro: "", cidade: "", estado: "", cep: "", observacoes: ""
};

function firstPhoneForWhatsApp(c: Pick<Client, "telefone" | "telefone2" | "telefone3">): string {
  for (const t of [c.telefone, c.telefone2, c.telefone3]) {
    if (t && t.replace(/\D/g, "").length >= 8) return t;
  }
  return c.telefone || "";
}

function clientToNewClient(c: Client): NewClient {
  const { id: _id, criadoEm: _ce, ...rest } = c;
  return rest;
}

function cleanPhone(raw: string) {
  return raw.replace(/\D/g, "");
}

function openWhatsApp(phone: string, toast: (t: "success" | "error" | "info", m: string) => void) {
  const digits = cleanPhone(phone);
  if (digits.length < 8) { toast("error", "Cliente sem telefone válido para WhatsApp."); return; }
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  window.open(`https://wa.me/${num}`, "_blank");
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
}

const BADGE_BG: Record<TimelineItem["type"], string> = {
  Lead: "#B07458",
  Oportunidade: "#C9956B",
  Pedido: "#8b5cf6",
  Atendimento: "#10b981",
};

/* ── component ──────────────────────────────────────────────────────────── */

export function CustomersPage() {
  const {
    clients, leads, opportunities, orders, interactions,
    addClient, updateClient, removeClient,
    addOpportunity, addInteraction, updateLead,
  } = useCRM();
  const { pushToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  /* view navigation */
  const [view, setView] = useState<View>("lista");
  const [clientPage, setClientPage] = useState(1);
  const [search, setSearch] = useState("");
  /** Lead da base fria ao abrir cadastro por “Converter em cliente”. */
  const [prefillFromLead, setPrefillFromLead] = useState<Lead | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  /* edit modal */
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState<NewClient>(emptyForm);
  const [modalTab, setModalTab] = useState<ModalTab>("dados");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  /* timeline inline forms */
  const [showNewOpp, setShowNewOpp] = useState(false);
  const [oppForm, setOppForm] = useState({ titulo: "", vendedor: "", valor: "" });
  const [showNewInt, setShowNewInt] = useState(false);
  const [intForm, setIntForm] = useState({
    vendedor: "",
    tipo: "WhatsApp" as "Ligação" | "WhatsApp" | "Visita" | "Email" | "Reunião",
    resumo: "",
    resultado: "Neutro" as "Positivo" | "Neutro" | "Negativo" | "Sem resposta",
    proximoRetorno: "",
    refIdx: 0,
  });

  /* ── Abrir cadastro vindo da tela de leads (state do router) ─────────── */
  useEffect(() => {
    const s = location.state as { prefillFromLead?: Lead } | null;
    if (s?.prefillFromLead) {
      setPrefillFromLead(s.prefillFromLead);
      setView("cadastro");
      navigate("/clientes", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  /* ── close modal on Escape ───────────────────────────────────────────── */
  useEffect(() => {
    if (!editingClient) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setEditingClient(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editingClient]);

  /* ── filtered & paginated clients ────────────────────────────────────── */

  const existingCpfs = useMemo(
    () => new Set(clients.map((c) => normalizeCpf(c.cpf)).filter((x) => x.length === 11)),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    const qDigits = q.replace(/\D/g, "");
    return clients.filter((c) => {
      const cpfFmt = normalizeCpf(c.cpf);
      return (
        c.nome.toLowerCase().includes(q) ||
        [c.telefone, c.telefone2, c.telefone3].some((t) => t && t.includes(q)) ||
        c.cidade.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && cpfFmt.includes(qDigits))
      );
    });
  }, [clients, search]);

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const visible = filteredClients.slice((clientPage - 1) * pageSize, clientPage * pageSize);

  /* ── timeline items for edited client ────────────────────────────────── */

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!editingClient) return [];
    const name = editingClient.nome.toLowerCase();
    const items: TimelineItem[] = [];

    for (const l of leads) {
      if (l.nome.toLowerCase() === name) {
        items.push({
          id: l.id, type: "Lead", icon: "🎯",
          date: "—",
          summary: `${l.nome} — Origem: ${l.origem}, Resp.: ${l.responsavel}, Score: ${l.score}`,
          status: l.status, sortTs: Date.now(),
        });
      }
    }
    for (const o of opportunities) {
      if (o.cliente.toLowerCase() === name) {
        items.push({
          id: o.id, type: "Oportunidade", icon: "💰",
          date: "—",
          summary: `${o.titulo} — ${o.vendedor}, R$ ${o.valor.toLocaleString("pt-BR")}`,
          status: o.etapa, sortTs: Date.now() - 1,
        });
      }
    }
    for (const ord of orders) {
      if (ord.cliente.toLowerCase() === name) {
        const ts = Date.now() - ord.diasAberto * 86_400_000;
        items.push({
          id: `P-${ord.pedido}`, type: "Pedido", icon: "📦",
          date: fmtDate(new Date(ts).toISOString()),
          summary: `Pedido #${ord.pedido} — ${ord.vendedor}, A faturar: R$ ${ord.aFaturar.toLocaleString("pt-BR")}`,
          status: `${ord.etapaCRM} · ${ord.urgencia}`, sortTs: ts,
        });
      }
    }
    for (const i of interactions) {
      if (i.cliente.toLowerCase() === name) {
        items.push({
          id: i.id, type: "Atendimento", icon: "📞",
          date: fmtDate(i.criadoEm),
          summary: `${i.tipo}: ${i.resumo} — ${i.vendedor}`,
          status: i.resultado, sortTs: new Date(i.criadoEm).getTime(),
        });
      }
    }

    items.sort((a, b) => b.sortTs - a.sortTs);
    return items;
  }, [editingClient, leads, opportunities, orders, interactions]);

  /** Reference entities for the interaction form dropdown */
  const refOptions = useMemo<RefOption[]>(() => {
    if (!editingClient) return [];
    const name = editingClient.nome.toLowerCase();
    const opts: RefOption[] = [];
    for (const o of opportunities) {
      if (o.cliente.toLowerCase() === name)
        opts.push({ label: `Oportunidade: ${o.titulo}`, refType: "opportunity", refId: o.id });
    }
    for (const ord of orders) {
      if (ord.cliente.toLowerCase() === name)
        opts.push({ label: `Pedido #${ord.pedido}`, refType: "order", refId: String(ord.pedido) });
    }
    for (const l of leads) {
      if (l.nome.toLowerCase() === name)
        opts.push({ label: `Lead: ${l.nome}`, refType: "lead", refId: l.id });
    }
    return opts;
  }, [editingClient, opportunities, orders, leads]);

  /* ── form helpers ────────────────────────────────────────────────────── */

  function setEditField<K extends keyof NewClient>(key: K, value: NewClient[K]) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  function openEditModal(c: Client) {
    setEditingClient(c);
    setEditForm(clientToNewClient(c));
    setModalTab("dados");
    setShowNewOpp(false);
    setShowNewInt(false);
  }

  /* ── handlers ────────────────────────────────────────────────────────── */

  async function handleCadastroConsignado(payload: NewClient) {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const clientId = await addClient(payload);
      if (prefillFromLead) {
        updateLead(prefillFromLead.id, {
          convertidoParaClienteId: clientId,
          status: "Qualificado",
        });
        setPrefillFromLead(null);
        pushToast("success", "Cliente cadastrado. Lead convertido da base fria.");
      } else {
        pushToast("success", "Cliente cadastrado.");
      }
      setClientPage(1);
      setView("lista");
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Não foi possível salvar o cliente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingClient || isSavingEdit) return;
    const nome = editForm.nome.trim();
    if (nome.length < 2) { pushToast("error", "Informe o nome do cliente."); return; }
    const anyTel = [editForm.telefone, editForm.telefone2, editForm.telefone3].some(
      (t) => (t || "").replace(/\D/g, "").length >= 8
    );
    if (!anyTel) { pushToast("error", "Informe pelo menos um telefone válido (mín. 8 dígitos)."); return; }
    try {
      setIsSavingEdit(true);
      updateClient(editingClient.id, {
        ...editForm,
        nome,
        telefone: editForm.telefone.trim(),
        telefone2: editForm.telefone2?.trim() || undefined,
        telefone3: editForm.telefone3?.trim() || undefined,
        email: editForm.email.trim(),
        endereco: editForm.endereco.trim(), numero: editForm.numero.trim(),
        complemento: editForm.complemento.trim(), bairro: editForm.bairro.trim(),
        cidade: editForm.cidade.trim(), estado: editForm.estado.trim().slice(0, 2).toUpperCase(),
        cep: editForm.cep.trim(), observacoes: editForm.observacoes.trim(),
      });
      pushToast("success", "Cliente atualizado.");
      setEditingClient(null);
    } catch {
      pushToast("error", "Erro ao salvar cliente.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleCreateOpp() {
    if (!editingClient) return;
    const titulo = oppForm.titulo.trim();
    if (!titulo) { pushToast("error", "Informe o título da oportunidade."); return; }
    await addOpportunity({
      titulo,
      cliente: editingClient.nome,
      vendedor: oppForm.vendedor.trim() || "—",
      valor: Number(oppForm.valor) || 0,
      etapa: "Prospeccao",
      telefoneCliente: firstPhoneForWhatsApp(editingClient),
      emailCliente: editingClient.email,
    });
    pushToast("success", "Oportunidade criada.");
    setOppForm({ titulo: "", vendedor: "", valor: "" });
    setShowNewOpp(false);
  }

  async function handleCreateInt() {
    if (!editingClient) return;
    if (!intForm.resumo.trim()) { pushToast("error", "Informe o resumo do atendimento."); return; }
    const ref = refOptions[intForm.refIdx];
    await addInteraction({
      refType: ref?.refType ?? "opportunity",
      refId: ref?.refId ?? "",
      cliente: editingClient.nome,
      vendedor: intForm.vendedor.trim() || "—",
      tipo: intForm.tipo,
      resumo: intForm.resumo.trim(),
      resultado: intForm.resultado,
      proximoRetorno: intForm.proximoRetorno,
    });
    pushToast("success", "Atendimento registrado.");
    setIntForm({ vendedor: "", tipo: "WhatsApp", resumo: "", resultado: "Neutro", proximoRetorno: "", refIdx: 0 });
    setShowNewInt(false);
  }

  /* ── Tela de cadastro ────────────────────────────────────────────────── */
  if (view === "cadastro") {
    const prefill = prefillFromLead ? leadToWizardPrefill(prefillFromLead) : null;
    return (
      <div className="stack">
        <section>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setPrefillFromLead(null);
              setView("lista");
            }}
            style={{ marginBottom: 8 }}
          >
            ← Voltar para lista
          </button>
          {prefillFromLead && (
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--muted)" }}>
              Convertendo o lead <strong>{prefillFromLead.nome}</strong> em cliente. Revise os dados trazidos da base e complete o que faltar.
            </p>
          )}
        </section>
        <ClientCadastroConsignadoWizard
          key={prefillFromLead?.id ?? "novo"}
          existingCpfs={existingCpfs}
          initialPrefill={prefill}
          onCancel={() => {
            setPrefillFromLead(null);
            setView("lista");
          }}
          onSubmit={handleCadastroConsignado}
        />
      </div>
    );
  }

  if (view === "importar-csv") {
    return (
      <div className="stack">
        <section>
          <button type="button" className="btn-ghost" onClick={() => setView("lista")} style={{ marginBottom: 8 }}>← Voltar para lista</button>
          <h2>Importar clientes via CSV</h2>
        </section>
        <section><ClientImporter onDone={() => setView("lista")} /></section>
      </div>
    );
  }

  if (view === "importar-pdf") {
    return (
      <div className="stack">
        <section>
          <button type="button" className="btn-ghost" onClick={() => setView("lista")} style={{ marginBottom: 8 }}>← Voltar para lista</button>
          <h2>Importar PDF (relatório ERP)</h2>
        </section>
        <section><PdfImporter onDone={() => setView("lista")} /></section>
      </div>
    );
  }

  /* ── Tela principal: lista de clientes ───────────────────────────────── */
  return (
    <div className="stack">
      <section>
        <div className="customers-header">
          <div>
            <h2>Clientes</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
              {clients.length} cliente{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="customers-actions">
            <button type="button" className="cta-lead ripple-btn" onClick={() => setView("cadastro")}>
              + Novo cliente
            </button>
            <div className="customers-import-dropdown">
              <button type="button" className="btn-ghost customers-import-btn">
                Importar ▾
              </button>
              <div className="customers-import-menu">
                <button type="button" onClick={() => setView("importar-csv")}>📊 Importar CSV</button>
                <button type="button" onClick={() => setView("importar-pdf")}>📄 Importar PDF</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div style={{ marginBottom: 12 }}>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setClientPage(1); }}
            placeholder="Buscar por nome, CPF, telefone, cidade, e-mail..."
            style={{ maxWidth: 400, width: "100%" }}
          />
        </div>

        {search && filteredClients.length !== clients.length && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>
            {filteredClients.length} resultado{filteredClients.length !== 1 ? "s" : ""} encontrado{filteredClients.length !== 1 ? "s" : ""}
          </p>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Cidade / UF</th>
              <th>Endereço</th>
              <th style={{ width: 1 }} />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 20, opacity: 0.6, textAlign: "center" }}>
                  {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado. Clique em \"+ Novo cliente\" para começar."}
                </td>
              </tr>
            ) : (
              visible.map((c) => (
                <tr key={c.id} onClick={() => openEditModal(c)} style={{ cursor: "pointer" }}>
                  <td><strong>{c.nome}</strong></td>
                  <td style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
                    {normalizeCpf(c.cpf).length === 11
                      ? normalizeCpf(c.cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                      : "—"}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {[c.telefone, c.telefone2, c.telefone3].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td>{c.email || "—"}</td>
                  <td>{[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}</td>
                  <td style={{ maxWidth: 260 }}>
                    {[c.endereco, c.numero].filter(Boolean).join(", ")}
                    {c.bairro ? ` — ${c.bairro}` : ""}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="wa-btn"
                        title="Abrir WhatsApp"
                        style={{
                          background: "#25D366", color: "#fff", border: "none",
                          borderRadius: 6, padding: "5px 10px", fontSize: 13,
                          cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
                        }}
                        onClick={() => openWhatsApp(firstPhoneForWhatsApp(c), pushToast)}
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-danger"
                        onClick={() => void removeClient(c.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filteredClients.length > pageSize && (
          <Pagination page={clientPage} totalPages={totalPages} onChange={setClientPage} />
        )}
      </section>

      {/* ── Edit Modal ──────────────────────────────────────────────────── */}
      {editingClient && (
        <div className="modal-backdrop" onClick={() => setEditingClient(null)}>
          <div
            className="modal-box"
            style={{ maxWidth: 720, width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="modal-head" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ flex: 1, margin: 0 }}>Editar cliente</h3>
              <button
                type="button"
                className="wa-btn"
                style={{
                  background: "#25D366", color: "#fff", border: "none",
                  borderRadius: 6, padding: "5px 12px", fontSize: 13,
                  cursor: "pointer", fontWeight: 600,
                }}
                onClick={() =>
                  openWhatsApp(firstPhoneForWhatsApp({ ...editingClient, ...editForm }), pushToast)
                }
              >
                WhatsApp
              </button>
              <button className="modal-close" onClick={() => setEditingClient(null)}>✕</button>
            </div>

            {/* tabs */}
            <div className="modal-tabs">
              <button
                type="button"
                className={`modal-tab${modalTab === "dados" ? " active" : ""}`}
                onClick={() => setModalTab("dados")}
              >
                Dados
              </button>
              <button
                type="button"
                className={`modal-tab${modalTab === "historico" ? " active" : ""}`}
                onClick={() => setModalTab("historico")}
              >
                Histórico ({timeline.length})
              </button>
            </div>

            {/* body */}
            <div className="modal-body" style={{ flex: 1, overflowY: "auto" }}>
              {modalTab === "dados" ? (
                <div className="client-form-grid">
                  <label className="modal-field">Nome *<input value={editForm.nome} onChange={(e) => setEditField("nome", e.target.value)} /></label>
                  <label className="modal-field">Telefone 1<input value={editForm.telefone} onChange={(e) => setEditField("telefone", e.target.value)} placeholder="Principal" /></label>
                  <label className="modal-field">Telefone 2<input value={editForm.telefone2 ?? ""} onChange={(e) => setEditField("telefone2", e.target.value)} /></label>
                  <label className="modal-field">Telefone 3<input value={editForm.telefone3 ?? ""} onChange={(e) => setEditField("telefone3", e.target.value)} /></label>
                  <label className="modal-field">E-mail<input type="email" value={editForm.email} onChange={(e) => setEditField("email", e.target.value)} /></label>
                  <label className="modal-field">CEP<input value={editForm.cep} onChange={(e) => setEditField("cep", e.target.value)} /></label>
                  <label className="modal-field full-span">Endereço<input value={editForm.endereco} onChange={(e) => setEditField("endereco", e.target.value)} /></label>
                  <label className="modal-field">Número<input value={editForm.numero} onChange={(e) => setEditField("numero", e.target.value)} /></label>
                  <label className="modal-field">Complemento<input value={editForm.complemento} onChange={(e) => setEditField("complemento", e.target.value)} /></label>
                  <label className="modal-field">Bairro<input value={editForm.bairro} onChange={(e) => setEditField("bairro", e.target.value)} /></label>
                  <label className="modal-field">Cidade<input value={editForm.cidade} onChange={(e) => setEditField("cidade", e.target.value)} /></label>
                  <label className="modal-field">UF<input value={editForm.estado} onChange={(e) => setEditField("estado", e.target.value)} maxLength={2} /></label>
                  <label className="modal-field full-span">Observações<textarea value={editForm.observacoes} onChange={(e) => setEditField("observacoes", e.target.value)} rows={3} /></label>
                </div>
              ) : (
                /* ── Timeline tab ─────────────────────────────────────────── */
                <div className="timeline-container">
                  {/* action buttons */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="cta-lead ripple-btn"
                      style={{ fontSize: 13 }}
                      onClick={() => { setShowNewOpp((v) => !v); setShowNewInt(false); }}
                    >
                      + Nova oportunidade
                    </button>
                    <button
                      type="button"
                      className="cta-lead ripple-btn"
                      style={{ fontSize: 13 }}
                      onClick={() => { setShowNewInt((v) => !v); setShowNewOpp(false); }}
                    >
                      + Registrar atendimento
                    </button>
                  </div>

                  {/* new opportunity form */}
                  {showNewOpp && (
                    <div className="timeline-inline-form" style={{ background: "var(--surface, #f8f9fa)", borderRadius: 8, padding: 14, marginBottom: 16, border: "1px solid var(--border, #e2e8f0)" }}>
                      <strong style={{ fontSize: 14, marginBottom: 8, display: "block" }}>Nova oportunidade</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <label className="modal-field">Título *<input value={oppForm.titulo} onChange={(e) => setOppForm((p) => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Cozinha planejada" /></label>
                        <label className="modal-field">Vendedor<input value={oppForm.vendedor} onChange={(e) => setOppForm((p) => ({ ...p, vendedor: e.target.value }))} placeholder="Nome do vendedor" /></label>
                        <label className="modal-field">Valor (R$)<input type="number" value={oppForm.valor} onChange={(e) => setOppForm((p) => ({ ...p, valor: e.target.value }))} placeholder="0" /></label>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                        <button type="button" className="btn-ghost" onClick={() => setShowNewOpp(false)}>Cancelar</button>
                        <button type="button" className="cta-lead ripple-btn" onClick={() => void handleCreateOpp()}>Criar oportunidade</button>
                      </div>
                    </div>
                  )}

                  {/* new interaction form */}
                  {showNewInt && (
                    <div className="timeline-inline-form" style={{ background: "var(--surface, #f8f9fa)", borderRadius: 8, padding: 14, marginBottom: 16, border: "1px solid var(--border, #e2e8f0)" }}>
                      <strong style={{ fontSize: 14, marginBottom: 8, display: "block" }}>Registrar atendimento</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <label className="modal-field">
                          Tipo
                          <select value={intForm.tipo} onChange={(e) => setIntForm((p) => ({ ...p, tipo: e.target.value as typeof p.tipo }))}>
                            <option>Ligação</option><option>WhatsApp</option><option>Visita</option><option>Email</option><option>Reunião</option>
                          </select>
                        </label>
                        <label className="modal-field">
                          Vendedor
                          <input value={intForm.vendedor} onChange={(e) => setIntForm((p) => ({ ...p, vendedor: e.target.value }))} placeholder="Nome do vendedor" />
                        </label>
                        {refOptions.length > 0 && (
                          <label className="modal-field">
                            Referência
                            <select value={intForm.refIdx} onChange={(e) => setIntForm((p) => ({ ...p, refIdx: Number(e.target.value) }))}>
                              {refOptions.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
                            </select>
                          </label>
                        )}
                        <label className="modal-field">
                          Resultado
                          <select value={intForm.resultado} onChange={(e) => setIntForm((p) => ({ ...p, resultado: e.target.value as typeof p.resultado }))}>
                            <option>Positivo</option><option>Neutro</option><option>Negativo</option><option>Sem resposta</option>
                          </select>
                        </label>
                        <label className="modal-field full-span">
                          Resumo *
                          <input value={intForm.resumo} onChange={(e) => setIntForm((p) => ({ ...p, resumo: e.target.value }))} placeholder="O que foi tratado?" />
                        </label>
                        <label className="modal-field">
                          Próximo retorno
                          <input value={intForm.proximoRetorno} onChange={(e) => setIntForm((p) => ({ ...p, proximoRetorno: e.target.value }))} placeholder="dd/mm/aaaa" />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                        <button type="button" className="btn-ghost" onClick={() => setShowNewInt(false)}>Cancelar</button>
                        <button type="button" className="cta-lead ripple-btn" onClick={() => void handleCreateInt()}>Registrar</button>
                      </div>
                    </div>
                  )}

                  {/* timeline list */}
                  {timeline.length === 0 ? (
                    <p style={{ textAlign: "center", opacity: 0.5, padding: 24 }}>
                      Nenhum registro encontrado para este cliente.
                    </p>
                  ) : (
                    <div className="timeline-list">
                      {timeline.map((item) => (
                        <div key={`${item.type}-${item.id}`} className="timeline-item">
                          <span className="timeline-icon">{item.icon}</span>
                          <div className="timeline-content">
                            <div className="timeline-header">
                              <span
                                className="timeline-badge"
                                style={{ background: BADGE_BG[item.type], color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}
                              >
                                {item.type}
                              </span>
                              <span className="timeline-date" style={{ fontSize: 12, color: "var(--muted, #94a3b8)" }}>{item.date}</span>
                              <span
                                className="timeline-status"
                                style={{ fontSize: 12, marginLeft: "auto", fontWeight: 600, opacity: 0.8 }}
                              >
                                {item.status}
                              </span>
                            </div>
                            <p className="timeline-summary" style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.4 }}>
                              {item.summary}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* footer */}
            <div className="modal-footer">
              {modalTab === "dados" && (
                <>
                  <span style={{ fontSize: 12, color: "var(--muted, #94a3b8)" }}>
                    Criado em {fmtDate(editingClient.criadoEm)}
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button type="button" className="btn-ghost" onClick={() => setEditingClient(null)}>Cancelar</button>
                    <button type="button" className="cta-lead ripple-btn" onClick={() => void handleSaveEdit()} disabled={isSavingEdit}>
                      {isSavingEdit ? "Salvando..." : "Salvar alterações"}
                    </button>
                  </div>
                </>
              )}
              {modalTab === "historico" && (
                <button type="button" className="btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setEditingClient(null)}>
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

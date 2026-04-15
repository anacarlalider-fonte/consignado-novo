import { useMemo, useRef, useState } from "react";
import { useCRM } from "../state/crm-context";
import { useAuth } from "../state/auth-context";
import { useToast } from "../state/toast-context";
import { normalizeMoneyInput } from "../utils/validation";
import { usePipelineLabels } from "../hooks/usePipelineLabels";
import { InteractionHistory } from "../components/RegisterContactModal";
import { ClientAutocomplete } from "../components/ClientAutocomplete";
import type { Opportunity } from "../data/mock-data";

const STAGES: Opportunity["etapa"][] = ["Prospeccao", "Diagnostico", "Proposta", "Negociacao", "Fechado", "Perdido"];

const STAGE_COLORS: Record<Opportunity["etapa"], string> = {
  Prospeccao: "#C9956B",
  Diagnostico: "#B07458",
  Proposta: "#FFB020",
  Negociacao: "#FF8C00",
  Fechado: "#00C896",
  Perdido: "#FF4D6A"
};

const LOSS_REASONS = [
  "Preço alto",
  "Escolheu concorrente",
  "Desistiu do projeto",
  "Sem retorno",
  "Prazo não atendido",
  "Outro",
] as const;

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/* ─── Editable column header ─────────────────────────────────────────────── */

function EditableHeader({
  stage,
  label,
  accent,
  count,
  total,
  onRename,
}: {
  stage: Opportunity["etapa"];
  label: string;
  accent: string;
  count: number;
  total: number;
  onRename: (stage: Opportunity["etapa"], name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(label);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed) onRename(stage, trimmed);
    setEditing(false);
  }

  const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <header className="kanban-header" style={{ borderBottom: `3px solid ${accent}` }}>
      <div className="kanban-header-left">
        {editing ? (
          <input
            ref={inputRef}
            className="kanban-label-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="kanban-label-btn"
            onClick={startEdit}
            title="Clique para renomear esta etapa"
          >
            {label}
            <span className="kanban-label-edit-icon">✏</span>
          </button>
        )}
        <small className="kanban-count">{count}</small>
      </div>
      <span style={{ fontSize: 12, color: accent, fontWeight: 700 }}>
        {brlFmt.format(total)}
      </span>
    </header>
  );
}

/* ─── Edit Modal ──────────────────────────────────────────────────────────── */

type EditModalProps = {
  op: Opportunity;
  stageLabels: Record<Opportunity["etapa"], string>;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Opportunity, "id">>) => Promise<void>;
  onDelete: () => Promise<void>;
};

function EditModal({ op, stageLabels, onClose, onSave, onDelete }: EditModalProps) {
  const [titulo, setTitulo] = useState(op.titulo);
  const [cliente, setCliente] = useState(op.cliente);
  const [vendedor, setVendedor] = useState(op.vendedor);
  const [valor, setValor] = useState(String(op.valor));
  const [probabilidade, setProbabilidade] = useState(String(op.probabilidade ?? 50));
  const [previsaoFechamento, setPrevisaoFechamento] = useState(op.previsaoFechamento ?? "");
  const [etapa, setEtapa] = useState<Opportunity["etapa"]>(op.etapa);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<"dados" | "historico">("dados");
  const { pushToast } = useToast();

  async function handleSave() {
    if (!titulo.trim() || titulo.trim().length < 3) {
      pushToast("error", "Titulo precisa ter pelo menos 3 caracteres.");
      return;
    }
    if (!cliente.trim()) {
      pushToast("error", "Informe o nome do cliente.");
      return;
    }
    const valorNum = normalizeMoneyInput(valor);
    if (valorNum <= 0) {
      pushToast("error", "Informe um valor maior que zero.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        titulo: titulo.trim(),
        cliente: cliente.trim(),
        vendedor: vendedor.trim() || "Nao definido",
        valor: valorNum,
        etapa,
        probabilidade: Number(probabilidade) || 50,
        previsaoFechamento: previsaoFechamento || undefined,
      });
      pushToast("success", "Oportunidade atualizada.");
      onClose();
    } catch {
      pushToast("error", "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await onDelete();
      pushToast("info", "Oportunidade removida.");
      onClose();
    } catch {
      pushToast("error", "Falha ao remover.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h3>{op.titulo}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>{op.cliente} · {op.vendedor}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        {/* tabs */}
        <div className="modal-tabs">
          <button type="button" className={`modal-tab ${activeTab === "dados" ? "active" : ""}`} onClick={() => setActiveTab("dados")}>
            Dados
          </button>
          <button type="button" className={`modal-tab ${activeTab === "historico" ? "active" : ""}`} onClick={() => setActiveTab("historico")}>
            Histórico de atendimentos
          </button>
        </div>

        {activeTab === "historico" ? (
          <div className="modal-body">
            <InteractionHistory
              refId={op.id}
              cliente={op.cliente}
              vendedor={op.vendedor}
              currentStage={stageLabels[op.etapa]}
            />
          </div>
        ) : (

        <div className="modal-body">
          <label className="modal-field">
            <span>Título *</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Cozinha planejada completa" />
          </label>
          <div className="modal-field">
            <span>Cliente *</span>
            <ClientAutocomplete value={cliente} onChange={setCliente} placeholder="Nome do cliente" />
          </div>
          <div className="modal-row-2">
            <label className="modal-field">
              <span>Vendedora</span>
              <input value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="Nome da vendedora" />
            </label>
            <label className="modal-field">
              <span>Valor estimado (R$)</span>
              <input
                type="number"
                min={0}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
          <div className="modal-row-2">
            <label className="modal-field">
              <span>Probabilidade (%)</span>
              <input type="number" min={0} max={100} value={probabilidade} onChange={(e) => setProbabilidade(e.target.value)} />
            </label>
            <label className="modal-field">
              <span>Previsão de fechamento</span>
              <input type="date" value={previsaoFechamento} onChange={(e) => setPrevisaoFechamento(e.target.value)} />
            </label>
          </div>
          <label className="modal-field">
            <span>Etapa do funil</span>
            <div className="stage-selector">
                  {STAGES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`stage-btn ${etapa === s ? "active" : ""}`}
                      style={etapa === s ? { background: STAGE_COLORS[s], borderColor: STAGE_COLORS[s], color: "#F2E6D5" } : {}}
                      onClick={() => setEtapa(s)}
                    >
                      {stageLabels[s]}
                    </button>
                  ))}
            </div>
          </label>
        </div>
        )}

        {activeTab === "dados" && (
          <footer className="modal-footer">
            {confirmDelete ? (
              <div className="modal-confirm-delete">
                <span>Confirmar remoção?</span>
                <button type="button" className="btn-ghost btn-danger" onClick={() => void handleDelete()} disabled={saving}>
                  Sim, remover
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <button type="button" className="btn-ghost btn-danger" onClick={() => setConfirmDelete(true)}>
                  Remover
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn-ghost" onClick={onClose}>
                    Cancelar
                  </button>
                  <button type="button" className="cta-lead ripple-btn" onClick={() => void handleSave()} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export function PipelinePage() {
  const { opportunities: rawOpps, addOpportunity, updateOpportunity, removeOpportunity, updateOpportunityStage, isLoading } = useCRM();
  const { isGestora, currentSellerName } = useAuth();
  const { pushToast } = useToast();
  const { labels, sla, renameStage, resetLabels } = usePipelineLabels();

  const opportunities = useMemo(() => {
    if (isGestora) return rawOpps;
    return rawOpps.filter((o) => o.vendedor === currentSellerName);
  }, [rawOpps, isGestora, currentSellerName]);

  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState("");
  const [vendedor, setVendedor] = useState(isGestora ? "" : currentSellerName);
  const [valor, setValor] = useState("");
  const [prob, setProb] = useState("50");
  const [previsao, setPrevisao] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingOp, setEditingOp] = useState<Opportunity | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Opportunity["etapa"] | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [lossOp, setLossOp] = useState<Opportunity | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [lossCustom, setLossCustom] = useState("");
  const [isSavingLoss, setIsSavingLoss] = useState(false);

  async function handleAdd() {
    if (isSubmitting) return;
    if (!titulo.trim() || titulo.trim().length < 3 || !cliente.trim()) {
      pushToast("error", "Preencha titulo (min 3 chars) e cliente.");
      return;
    }
    const valorNum = normalizeMoneyInput(valor);
    if (valorNum <= 0) {
      pushToast("error", "Informe um valor maior que zero.");
      return;
    }
    try {
      setIsSubmitting(true);
      await addOpportunity({
        titulo: titulo.trim(),
        cliente: cliente.trim(),
        vendedor: vendedor || "Nao definido",
        valor: valorNum,
        etapa: "Prospeccao",
        probabilidade: Number(prob) || 50,
        previsaoFechamento: previsao || undefined,
      });
      setTitulo(""); setCliente(""); setVendedor(""); setValor(""); setProb("50"); setPrevisao("");
      pushToast("success", "Oportunidade criada.");
    } catch {
      pushToast("error", "Falha ao criar oportunidade.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDrop(stage: Opportunity["etapa"]) {
    if (!draggingId) return;
    setDragOverStage(null);
    const dragged = opportunities.find((o) => o.id === draggingId);
    if (!dragged || dragged.etapa === stage) return;

    if (stage === "Perdido") {
      setLossOp(dragged);
      setLossReason("");
      setLossCustom("");
      setDraggingId(null);
      return;
    }

    setUpdatingId(draggingId);
    void updateOpportunityStage(draggingId, stage)
      .then(() => pushToast("success", `Movido para ${labels[stage]}.`))
      .catch(() => pushToast("error", "Falha ao mover card."))
      .finally(() => { setUpdatingId(null); setDraggingId(null); });
  }

  async function handleConfirmLoss() {
    if (!lossOp) return;
    const reason = lossReason === "Outro" ? lossCustom.trim() : lossReason;
    if (!reason) { pushToast("error", "Informe o motivo da perda."); return; }
    setIsSavingLoss(true);
    try {
      await updateOpportunity(lossOp.id, { etapa: "Perdido", motivoPerda: reason });
      pushToast("success", `"${lossOp.titulo}" marcada como perdida.`);
      setLossOp(null);
    } catch {
      pushToast("error", "Falha ao salvar.");
    } finally {
      setIsSavingLoss(false);
    }
  }

  const activeOpps = opportunities.filter((o) => o.etapa !== "Perdido");
  const totalPipeline = activeOpps.reduce((s, o) => s + o.valor, 0);
  const totalFechado = opportunities.filter((o) => o.etapa === "Fechado").reduce((s, o) => s + o.valor, 0);
  const totalPerdido = opportunities.filter((o) => o.etapa === "Perdido").length;

  return (
    <div className="stack">
      {/* ── header ── */}
      <section className="pipeline-hero">
        <div>
          <h2>Pipeline Comercial</h2>
          <p>
            Clique em um card para editar · Arraste para mover entre etapas ·{" "}
            <button type="button" className="link-btn" onClick={resetLabels} title="Restaurar nomes originais">
              Restaurar nomes originais
            </button>
          </p>
        </div>
        <div className="pipeline-totals">
          <div className="pipeline-total-item">
            <span>Total pipeline</span>
            <strong style={{ color: "var(--primary)" }}>{brl(totalPipeline)}</strong>
          </div>
          <div className="pipeline-total-item">
            <span>Fechado</span>
            <strong style={{ color: "var(--success)" }}>{brl(totalFechado)}</strong>
          </div>
          {totalPerdido > 0 && (
            <div className="pipeline-total-item">
              <span>Perdidos</span>
              <strong style={{ color: "var(--danger)" }}>{totalPerdido}</strong>
            </div>
          )}
        </div>
      </section>

      {/* ── new opportunity form ── */}
      <section>
        <h3 style={{ margin: "0 0 12px", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>
          Nova oportunidade
        </h3>
        <div className="pipeline-form">
          <label className="pipeline-form-field">
            <span>Título *</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Dormitório planejado" />
          </label>
          <div className="pipeline-form-field">
            <span>Cliente *</span>
            <ClientAutocomplete value={cliente} onChange={setCliente} placeholder="Nome do cliente" />
          </div>
          <label className="pipeline-form-field">
            <span>Vendedora</span>
            <input value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="Nome da vendedora" />
          </label>
          <label className="pipeline-form-field">
            <span>Valor estimado (R$)</span>
            <input type="number" min={0} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" />
          </label>
          <label className="pipeline-form-field">
            <span>Probabilidade (%)</span>
            <input type="number" min={0} max={100} value={prob} onChange={(e) => setProb(e.target.value)} placeholder="50" style={{ maxWidth: 80 }} />
          </label>
          <label className="pipeline-form-field">
            <span>Previsão fechamento</span>
            <input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </label>
          <button type="button" className="cta-lead ripple-btn pipeline-form-btn" onClick={() => void handleAdd()} disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "+ Adicionar"}
          </button>
        </div>
      </section>

      {/* ── kanban ── */}
      {isLoading ? (
        <section>
          <div className="skeleton-table">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-row" />)}
          </div>
        </section>
      ) : (
        <div className="kanban">
          {STAGES.map((stage) => {
            const cards = opportunities.filter((op) => op.etapa === stage);
            const stageTotal = cards.reduce((s, o) => s + o.valor, 0);
            const accent = STAGE_COLORS[stage];

            return (
              <section
                key={stage}
                className={`kanban-col ${dragOverStage === stage ? "kanban-col-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage); }}
                onDragLeave={() => { if (dragOverStage === stage) setDragOverStage(null); }}
                onDrop={() => handleDrop(stage)}
              >
                <EditableHeader
                  stage={stage}
                  label={labels[stage]}
                  accent={accent}
                  count={cards.length}
                  total={stageTotal}
                  onRename={renameStage}
                />

                <div className="kanban-cards">
                  {cards.map((op) => {
                    const slaDays = sla[stage] ?? 0;
                    let daysInStage = 0;
                    if (op.criadoEm) {
                      daysInStage = Math.floor((Date.now() - new Date(op.criadoEm).getTime()) / 86_400_000);
                    }
                    const slaExceeded = slaDays > 0 && daysInStage > slaDays;
                    const slaWarning = slaDays > 0 && daysInStage > slaDays * 0.7 && !slaExceeded;

                    return (
                    <article
                      key={op.id}
                      className={`kanban-card kanban-card-clickable ${draggingId === op.id ? "kanban-card-dragging" : ""} ${updatingId === op.id ? "kanban-card-updating" : ""} ${slaExceeded ? "kanban-card-sla-exceeded" : ""} ${slaWarning ? "kanban-card-sla-warning" : ""}`}
                      draggable={updatingId !== op.id}
                      onDragStart={() => setDraggingId(op.id)}
                      onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
                      onClick={() => setEditingOp(op)}
                      title="Clique para editar"
                    >
                      <div className="kanban-card-accent" style={{ background: slaExceeded ? "#FF4D6A" : slaWarning ? "#FFB020" : accent }} />
                      <h4>{op.titulo}</h4>
                      <p>{op.cliente}</p>
                      <div className="kanban-card-footer">
                        <small>{op.vendedor}</small>
                        <strong style={{ color: accent }}>{brl(op.valor)}</strong>
                      </div>
                      {op.telefoneCliente && (
                        <button
                          type="button"
                          className="kanban-wa-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const digits = op.telefoneCliente!.replace(/\D/g, "");
                            const num = digits.startsWith("55") ? digits : `55${digits}`;
                            window.open(`https://wa.me/${num}`, "_blank");
                          }}
                          title={`WhatsApp: ${op.telefoneCliente}`}
                        >
                          WA {op.telefoneCliente}
                        </button>
                      )}
                      {slaDays > 0 && daysInStage > 0 && (
                        <div className="kanban-sla-info" style={{ color: slaExceeded ? "var(--danger)" : slaWarning ? "var(--warning)" : "var(--muted)" }}>
                          {daysInStage}d / {slaDays}d SLA
                        </div>
                      )}
                      <span className="kanban-edit-hint">✏ editar</span>
                    </article>
                    );
                  })}

                  {cards.length === 0 && (
                    <div className="kanban-empty">Nenhuma oportunidade</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── edit modal ── */}
      {editingOp && (
        <EditModal
          op={editingOp}
          stageLabels={labels}
          onClose={() => setEditingOp(null)}
          onSave={(patch) => updateOpportunity(editingOp.id, patch)}
          onDelete={() => removeOpportunity(editingOp.id)}
        />
      )}

      {/* ── loss reason modal ── */}
      {lossOp && (
        <div className="modal-backdrop" onClick={() => setLossOp(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>Motivo da Perda</span>
              <button className="modal-close" onClick={() => setLossOp(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Oportunidade: <strong>{lossOp.titulo}</strong></p>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>{lossOp.cliente} · {brl(lossOp.valor)}</p>
              <label className="modal-field">
                Motivo *
                <select value={lossReason} onChange={(e) => setLossReason(e.target.value)} autoFocus>
                  <option value="">Selecione o motivo...</option>
                  {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              {lossReason === "Outro" && (
                <label className="modal-field">
                  Descreva o motivo
                  <input value={lossCustom} onChange={(e) => setLossCustom(e.target.value)} placeholder="Motivo personalizado..." />
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setLossOp(null)}>Cancelar</button>
              <button
                className="btn-danger ripple-btn"
                onClick={() => void handleConfirmLoss()}
                disabled={isSavingLoss || !lossReason || (lossReason === "Outro" && !lossCustom.trim())}
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

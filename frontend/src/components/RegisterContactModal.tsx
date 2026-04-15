import { useState } from "react";
import { useCRM } from "../state/crm-context";
import { useToast } from "../state/toast-context";
import type { Interaction, NewInteraction } from "../data/mock-data";

const TIPO_OPTIONS: Interaction["tipo"][] = ["Ligação", "WhatsApp", "Visita", "Email", "Reunião"];
const RESULTADO_OPTIONS: Interaction["resultado"][] = ["Positivo", "Neutro", "Negativo", "Sem resposta"];

const RESULTADO_STYLE: Record<Interaction["resultado"], { color: string; bg: string }> = {
  Positivo:       { color: "#00C896", bg: "rgba(0,200,150,0.15)"  },
  Neutro:         { color: "#94A3B8", bg: "rgba(148,163,184,0.15)" },
  Negativo:       { color: "#FF4D6A", bg: "rgba(255,77,106,0.15)" },
  "Sem resposta": { color: "#FFB020", bg: "rgba(255,176,32,0.15)" }
};

type Props = {
  refType: NewInteraction["refType"];
  refId: string;
  cliente: string;
  vendedor?: string;
  /** se passado, abre já preenchido para editar fase (usado do pipeline) */
  currentStage?: string;
  onClose: () => void;
  /** callback opcional após salvar (ex: para atualizar próximo follow-up em pedidos) */
  onSaved?: (interaction: Omit<NewInteraction, "refType" | "refId">) => void;
};

export function RegisterContactModal({
  refType, refId, cliente, vendedor = "", currentStage, onClose, onSaved
}: Props) {
  const { addInteraction } = useCRM();
  const { pushToast } = useToast();

  const [tipo, setTipo] = useState<Interaction["tipo"]>("WhatsApp");
  const [resumo, setResumo] = useState("");
  const [resultado, setResultado] = useState<Interaction["resultado"]>("Positivo");
  const [proximoRetorno, setProximoRetorno] = useState("");
  const [vendedorField, setVendedorField] = useState(vendedor);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!resumo.trim() || resumo.trim().length < 5) {
      pushToast("error", "Descreva o que foi tratado (mínimo 5 caracteres).");
      return;
    }
    if (!vendedorField.trim()) {
      pushToast("error", "Informe quem fez o contato.");
      return;
    }
    setSaving(true);
    try {
      const payload: NewInteraction = {
        refType, refId, cliente,
        vendedor: vendedorField.trim(),
        tipo, resumo: resumo.trim(), resultado, proximoRetorno
      };
      await addInteraction(payload);
      pushToast("success", "Atendimento registrado!");
      onSaved?.({ tipo, resumo: resumo.trim(), resultado, proximoRetorno, vendedor: vendedorField.trim(), cliente });
      onClose();
    } catch {
      pushToast("error", "Falha ao registrar atendimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box contact-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h3>Registrar atendimento</h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>
              {cliente}{currentStage ? ` · ${currentStage}` : ""}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        <div className="modal-body">
          {/* Tipo de contato */}
          <label className="modal-field">
            <span>Tipo de contato</span>
            <div className="contact-type-row">
              {TIPO_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`contact-type-btn ${tipo === t ? "active" : ""}`}
                  onClick={() => setTipo(t)}
                >
                  {tipoIcon(t)} {t}
                </button>
              ))}
            </div>
          </label>

          {/* Resumo */}
          <label className="modal-field">
            <span>O que foi tratado? *</span>
            <textarea
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder="Ex: Cliente confirmou interesse no projeto da cozinha. Quer visita técnica na próxima semana..."
              rows={4}
            />
          </label>

          {/* Resultado */}
          <label className="modal-field">
            <span>Resultado do contato</span>
            <div className="resultado-row">
              {RESULTADO_OPTIONS.map((r) => {
                const style = RESULTADO_STYLE[r];
                return (
                  <button
                    key={r}
                    type="button"
                    className={`resultado-btn ${resultado === r ? "active" : ""}`}
                    style={resultado === r ? { background: style.bg, borderColor: style.color, color: style.color } : {}}
                    onClick={() => setResultado(r)}
                  >
                    {resultadoIcon(r)} {r}
                  </button>
                );
              })}
            </div>
          </label>

          <div className="modal-row-2">
            {/* Próximo retorno */}
            <label className="modal-field">
              <span>Próximo retorno</span>
              <input
                value={proximoRetorno}
                onChange={(e) => setProximoRetorno(e.target.value)}
                placeholder="dd/mm/aaaa"
                maxLength={10}
              />
            </label>

            {/* Vendedora */}
            <label className="modal-field">
              <span>Registrado por *</span>
              <input
                value={vendedorField}
                onChange={(e) => setVendedorField(e.target.value)}
                placeholder="Nome da vendedora"
              />
            </label>
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="cta-lead ripple-btn"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar atendimento"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ── Mini-history list (used inside Pipeline modal) ─────────────────────── */

type HistoryListProps = {
  refId: string;
  cliente: string;
  vendedor?: string;
  currentStage?: string;
};

export function InteractionHistory({ refId, cliente, vendedor, currentStage }: HistoryListProps) {
  const { interactions } = useCRM();
  const [showForm, setShowForm] = useState(false);

  const list = interactions
    .filter((i) => i.refId === refId)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  return (
    <div className="history-wrap">
      <div className="history-header">
        <h4>{list.length} atendimento{list.length !== 1 ? "s" : ""} registrado{list.length !== 1 ? "s" : ""}</h4>
        <button
          type="button"
          className="cta-lead ripple-btn"
          style={{ padding: "7px 14px", fontSize: 13 }}
          onClick={() => setShowForm(true)}
        >
          + Registrar contato
        </button>
      </div>

      {list.length === 0 ? (
        <div className="history-empty">
          <span>📋</span>
          <p>Nenhum atendimento registrado ainda.</p>
          <small>Clique em "Registrar contato" para adicionar o primeiro.</small>
        </div>
      ) : (
        <div className="history-list">
          {list.map((item) => {
            const style = RESULTADO_STYLE[item.resultado];
            const data = new Date(item.criadoEm);
            const dateStr = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
            const timeStr = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            return (
              <div key={item.id} className="history-item">
                <div className="history-item-header">
                  <span className="history-tipo">{tipoIcon(item.tipo)} {item.tipo}</span>
                  <span className="history-resultado" style={{ color: style.color, background: style.bg }}>
                    {resultadoIcon(item.resultado)} {item.resultado}
                  </span>
                  <span className="history-date">{dateStr} {timeStr}</span>
                </div>
                <p className="history-resumo">{item.resumo}</p>
                <div className="history-item-footer">
                  <small>por {item.vendedor}</small>
                  {item.proximoRetorno && <small>↩ Retorno: {item.proximoRetorno}</small>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <RegisterContactModal
          refType="opportunity"
          refId={refId}
          cliente={cliente}
          vendedor={vendedor}
          currentStage={currentStage}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function tipoIcon(tipo: Interaction["tipo"]) {
  const map: Record<Interaction["tipo"], string> = {
    "Ligação": "📞", "WhatsApp": "💬", "Visita": "🏠", "Email": "✉️", "Reunião": "🤝"
  };
  return map[tipo] ?? "📋";
}

function resultadoIcon(r: Interaction["resultado"]) {
  const map: Record<Interaction["resultado"], string> = {
    Positivo: "✅", Neutro: "➖", Negativo: "❌", "Sem resposta": "⏳"
  };
  return map[r] ?? "";
}

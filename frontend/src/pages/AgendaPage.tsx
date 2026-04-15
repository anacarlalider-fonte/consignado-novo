import { useMemo, useState } from "react";
import { useCRM } from "../state/crm-context";
import { useAuth } from "../state/auth-context";
import { useToast } from "../state/toast-context";
import { usePipelineLabels } from "../hooks/usePipelineLabels";
import { RegisterContactModal } from "../components/RegisterContactModal";
import type { Interaction, Opportunity, Order } from "../data/mock-data";

/* ─── helpers ──────────────────────────────────────────────────────────── */

function parseDate(ddmmyyyy: string): Date | null {
  const m = ddmmyyyy.match(/^(\d{1,2})\/?(\d{1,2})\/?(\d{2,4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  return new Date(y, mo, d);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtWeekday(d: Date) {
  return d.toLocaleDateString("pt-BR", { weekday: "long" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type FollowUpItem = {
  id: string;
  date: Date;
  dateStr: string;
  cliente: string;
  vendedor: string;
  source: "interaction" | "order" | "opportunity";
  sourceLabel: string;
  /** The interaction/order/opportunity behind this item */
  refId: string;
  refType: "opportunity" | "order";
  resumo: string;
  done: boolean;
};

/* ─── Page ─────────────────────────────────────────────────────────────── */

export function AgendaPage() {
  const { interactions: rawInteractions, orders: rawOrders, opportunities, updateOrder, removeInteraction, updateInteraction } = useCRM();
  const { isGestora, currentSellerName } = useAuth();
  const { pushToast } = useToast();

  const interactions = useMemo(() => {
    if (isGestora) return rawInteractions;
    return rawInteractions.filter((i) => i.vendedor === currentSellerName);
  }, [rawInteractions, isGestora, currentSellerName]);

  const orders = useMemo(() => {
    if (isGestora) return rawOrders;
    return rawOrders.filter((o) => o.vendedor === currentSellerName);
  }, [rawOrders, isGestora, currentSellerName]);
  const { labels } = usePipelineLabels();

  const [filter, setFilter] = useState<"todos" | "hoje" | "atrasados" | "proximos">("todos");
  const [searchQ, setSearchQ] = useState("");
  const [contactModal, setContactModal] = useState<{ refType: "opportunity" | "order"; refId: string; cliente: string; vendedor: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  /* ── Build follow-up list from interactions + orders ──────────────── */
  const items = useMemo<FollowUpItem[]>(() => {
    const result: FollowUpItem[] = [];

    // 1) Interactions with próximo retorno
    for (const int of interactions) {
      if (!int.proximoRetorno) continue;
      const d = parseDate(int.proximoRetorno);
      if (!d) continue;

      let sourceLabel = "";
      if (int.refType === "opportunity") {
        const op = opportunities.find((o) => o.id === int.refId);
        sourceLabel = op ? `Pipeline: ${op.titulo}` : "Pipeline";
      } else {
        sourceLabel = `Pedido #${int.refId}`;
      }

      result.push({
        id: `int-${int.id}`,
        date: d,
        dateStr: int.proximoRetorno,
        cliente: int.cliente,
        vendedor: int.vendedor,
        source: "interaction",
        sourceLabel,
        refId: int.refId,
        refType: int.refType as "opportunity" | "order",
        resumo: int.resumo,
        done: false,
      });
    }

    // 2) Orders with próximo follow-up (that DON'T already have a matching interaction)
    const interactionOrderIds = new Set(
      interactions.filter((i) => i.refType === "order" && i.proximoRetorno).map((i) => i.refId)
    );
    for (const ord of orders) {
      if (!ord.proximoFollowup || interactionOrderIds.has(String(ord.pedido))) continue;
      const d = parseDate(ord.proximoFollowup);
      if (!d) continue;
      result.push({
        id: `ord-${ord.pedido}`,
        date: d,
        dateStr: ord.proximoFollowup,
        cliente: ord.cliente,
        vendedor: ord.vendedor,
        source: "order",
        sourceLabel: `Pedido #${ord.pedido}`,
        refId: String(ord.pedido),
        refType: "order",
        resumo: `Follow-up do pedido #${ord.pedido} · ${ord.etapaCRM}`,
        done: false,
      });
    }

    result.sort((a, b) => a.date.getTime() - b.date.getTime());
    return result;
  }, [interactions, orders, opportunities]);

  /* ── Filtering ─────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = items;

    if (filter === "hoje") {
      list = list.filter((i) => isSameDay(i.date, today));
    } else if (filter === "atrasados") {
      list = list.filter((i) => i.date < today && !isSameDay(i.date, today));
    } else if (filter === "proximos") {
      list = list.filter((i) => i.date > today || isSameDay(i.date, today));
    }

    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter((i) =>
        i.cliente.toLowerCase().includes(q) ||
        i.vendedor.toLowerCase().includes(q) ||
        i.resumo.toLowerCase().includes(q)
      );
    }

    return list;
  }, [items, filter, searchQ, today]);

  /* ── Stats ──────────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const atrasados = items.filter((i) => i.date < today && !isSameDay(i.date, today)).length;
    const hojeCount = items.filter((i) => isSameDay(i.date, today)).length;
    const proximos = items.filter((i) => i.date > today).length;
    return { total: items.length, atrasados, hoje: hojeCount, proximos };
  }, [items, today]);

  /* ── Actions ────────────────────────────────────────────────────────── */
  function handleMarkDone(item: FollowUpItem) {
    setContactModal({
      refType: item.refType,
      refId: item.refId,
      cliente: item.cliente,
      vendedor: item.vendedor,
    });
  }

  function handleDelete(item: FollowUpItem) {
    if (item.source === "interaction") {
      const intId = item.id.replace("int-", "");
      removeInteraction(intId);
      pushToast("info", "Agendamento removido.");
    } else if (item.source === "order") {
      const pedido = parseInt(item.refId, 10);
      void updateOrder(pedido, { proximoFollowup: "" });
      pushToast("info", "Follow-up do pedido removido.");
    }
  }

  function handleSaveDate(item: FollowUpItem) {
    if (!editDate.trim()) return;
    const d = parseDate(editDate);
    if (!d) { pushToast("error", "Data inválida. Use dd/mm/aaaa."); return; }

    if (item.source === "interaction") {
      const intId = item.id.replace("int-", "");
      updateInteraction(intId, { proximoRetorno: editDate.trim() });
      pushToast("success", "Data reagendada.");
    } else if (item.source === "order") {
      const pedido = parseInt(item.refId, 10);
      void updateOrder(pedido, { proximoFollowup: editDate.trim() });
      pushToast("success", "Follow-up reagendado.");
    }
    setEditingId(null);
    setEditDate("");
  }

  function getRowClass(item: FollowUpItem) {
    if (isSameDay(item.date, today)) return "agenda-row-today";
    if (item.date < today) return "agenda-row-late";
    return "";
  }

  function getDateBadge(item: FollowUpItem) {
    if (isSameDay(item.date, today)) return <span className="agenda-badge hoje">Hoje</span>;
    if (item.date < today) {
      const days = Math.ceil((today.getTime() - item.date.getTime()) / 86400000);
      return <span className="agenda-badge atrasado">{days}d atrasado</span>;
    }
    const days = Math.ceil((item.date.getTime() - today.getTime()) / 86400000);
    if (days <= 3) return <span className="agenda-badge proximo">Em {days}d</span>;
    return null;
  }

  return (
    <div className="stack">
      {/* ── Header ── */}
      <section>
        <h2>Agenda de Follow-ups</h2>
        <p style={{ color: "var(--muted)", margin: "4px 0 0" }}>
          Retornos agendados via atendimentos na Pipeline e Pedidos.
          Para criar novos, registre um atendimento no card da oportunidade.
        </p>
      </section>

      {/* ── Stats cards ── */}
      <div className="agenda-stats">
        <button type="button" className={`agenda-stat-card ${filter === "todos" ? "active" : ""}`} onClick={() => setFilter("todos")}>
          <span className="agenda-stat-num">{stats.total}</span>
          <span className="agenda-stat-label">Total</span>
        </button>
        <button type="button" className={`agenda-stat-card late ${filter === "atrasados" ? "active" : ""}`} onClick={() => setFilter("atrasados")}>
          <span className="agenda-stat-num">{stats.atrasados}</span>
          <span className="agenda-stat-label">Atrasados</span>
        </button>
        <button type="button" className={`agenda-stat-card today ${filter === "hoje" ? "active" : ""}`} onClick={() => setFilter("hoje")}>
          <span className="agenda-stat-num">{stats.hoje}</span>
          <span className="agenda-stat-label">Hoje</span>
        </button>
        <button type="button" className={`agenda-stat-card upcoming ${filter === "proximos" ? "active" : ""}`} onClick={() => setFilter("proximos")}>
          <span className="agenda-stat-num">{stats.proximos}</span>
          <span className="agenda-stat-label">Próximos</span>
        </button>
      </div>

      {/* ── Search ── */}
      <section>
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Buscar por cliente, vendedora ou resumo..."
          style={{ maxWidth: 400, width: "100%", marginBottom: 12 }}
        />

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
            {items.length === 0
              ? <>
                  <p style={{ fontSize: 18 }}>Nenhum follow-up agendado</p>
                  <p style={{ fontSize: 13 }}>Para agendar retornos, registre atendimentos nos cards da Pipeline ou nos Pedidos.</p>
                </>
              : <p>Nenhum resultado para este filtro.</p>
            }
          </div>
        ) : (
          <div className="agenda-list">
            {filtered.map((item) => (
              <div key={item.id} className={`agenda-row ${getRowClass(item)}`}>
                <div className="agenda-row-date">
                  <strong>{fmtDate(item.date)}</strong>
                  <small>{fmtWeekday(item.date)}</small>
                  {getDateBadge(item)}
                </div>

                <div className="agenda-row-content">
                  <div className="agenda-row-top">
                    <strong className="agenda-cliente">{item.cliente}</strong>
                    <span className="agenda-source">{item.sourceLabel}</span>
                  </div>
                  <p className="agenda-resumo">{item.resumo}</p>
                  <small className="agenda-vendedor">por {item.vendedor}</small>
                </div>

                <div className="agenda-row-actions">
                  {editingId === item.id ? (
                    <div className="agenda-edit-date">
                      <input
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        placeholder="dd/mm/aaaa"
                        maxLength={10}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveDate(item);
                          if (e.key === "Escape") { setEditingId(null); setEditDate(""); }
                        }}
                      />
                      <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => handleSaveDate(item)}>
                        Salvar
                      </button>
                      <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => { setEditingId(null); setEditDate(""); }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="agenda-action-btn done" title="Registrar atendimento (marcar como feito)" onClick={() => handleMarkDone(item)}>
                        ✓ Atender
                      </button>
                      <button type="button" className="agenda-action-btn reschedule" title="Reagendar" onClick={() => { setEditingId(item.id); setEditDate(item.dateStr); }}>
                        📅 Reagendar
                      </button>
                      <button type="button" className="agenda-action-btn delete" title="Excluir agendamento" onClick={() => handleDelete(item)}>
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Contact modal ── */}
      {contactModal && (
        <RegisterContactModal
          refType={contactModal.refType}
          refId={contactModal.refId}
          cliente={contactModal.cliente}
          vendedor={contactModal.vendedor}
          onClose={() => setContactModal(null)}
          onSaved={() => setContactModal(null)}
        />
      )}
    </div>
  );
}
